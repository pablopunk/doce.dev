# Critical Bug Analysis: docker.waitReady Job System

## Executive Summary

Two critical bugs prevent docker.waitReady from completing setup:

1. **Bug #1 (ROOT CAUSE)**: Job polling logic increments `attempts` on every claim, causing jobs to hit `maxAttempts` and get stuck in "queued" state
2. **Bug #2 (SAFETY NET)**: Presence timeout uses project.createdAt instead of per-phase start time, making timeouts global instead of phase-specific

**Relationship**: Bug #1 prevents jobs from completing; Bug #2 catches the symptom after 2 minutes. Bug #1 must be fixed first.

**Complexity**: Both LOW - total 2-3 hours implementation + testing

**Priority**: Fix immediately - blocks all project setup

---

# BUG #1: Queue Job Polling Logic

## Current Flow (Broken)

### Step 1: Initial Job Claim
**File**: `src/server/queue/queue.model.ts` (lines 396-484)

```typescript
export async function claimNextJob(options: ClaimOptions): Promise<QueueJob | null> {
  const stmt = sqlite.prepare(`
    UPDATE queue_jobs
      SET state='running',
          locked_at=@now,
          lock_expires_at=@leaseExpires,
          locked_by=@workerId,
          updated_at=@now,
          attempts=attempts+1  // ← LINE 412: INCREMENTS ON EVERY CLAIM
      WHERE id = (SELECT id FROM queue_jobs WHERE state='queued' ...)
  `);
}
```

**What happens**: 
- When worker claims job, `attempts` increments from 1→2
- Job state changes to "running"
- Job is locked to worker with lease

### Step 2: Polling Without Services Ready
**File**: `src/server/queue/handlers/dockerWaitReady.ts` (lines 100-113)

```typescript
if (!previewReady || !opencodeReady) {
  logger.info("Services not ready, rescheduling");
  ctx.reschedule(POLL_DELAY_MS);  // ← Throws RescheduleError
}
```

**What happens**:
- Handler detects services not ready (normal during startup)
- Calls `ctx.reschedule()` which throws `RescheduleError`
- Should NOT be an error - just needs to wait

### Step 3: Queue Worker Handles Reschedule
**File**: `src/server/queue/queue.worker.ts` (lines 161-169)

```typescript
catch (error) {
  if (error instanceof RescheduleError) {
    await rescheduleJob(job.id, workerId, error.delayMs);
    logger.info({ jobId: job.id, delayMs: error.delayMs, attempts: job.attempts }, 
      "Queue job rescheduled"
    );
    return;
  }
  // ... error retry logic
}
```

**What happens**:
- Catches `RescheduleError` correctly
- Calls `rescheduleJob()` to re-queue
- BUT: `job.attempts` is already 2 (from claim)

### Step 4: Reschedule (Re-queue Job)
**File**: `src/server/queue/queue.model.ts` (lines 353-373)

```typescript
export async function rescheduleJob(
  jobId: string,
  workerId: string,
  delayMs: number
): Promise<void> {
  const now = new Date();
  
  await db.update(queueJobs).set({
    state: "queued",
    runAt: new Date(Date.now() + delayMs),
    lockedAt: null,
    lockExpiresAt: null,
    lockedBy: null,
    updatedAt: now,
    // Note: attempts is NOT decremented - it was already incremented on claim.
    // But we don't set lastError, so this looks like a normal reschedule.
  }).where(and(eq(queueJobs.id, jobId), eq(queueJobs.lockedBy, workerId)));
}
```

**What happens**:
- Sets state back to "queued" (correct)
- Clears lock (correct)
- **CRITICAL**: Does NOT decrement attempts
- Job is now: state="queued", attempts=2, runAt=(1 second later)

### Step 5: Next Claim Cycle
**Back to Step 1** on next poll interval:
- Worker claims same job again
- `claimNextJob()` **increments attempts again**: 2→3
- Job rescheduled again
- Eventually: attempts reaches maxAttempts (default 3)

### Step 6: Job Gets Stuck
**File**: `src/server/queue/queue.model.ts` (line 418)

```typescript
WHERE id = (
  SELECT id FROM queue_jobs WHERE state='queued'
    AND run_at <= @now
    AND attempts < max_attempts  // ← LINE 418: THIS BLOCKS IT
    AND ...
)
```

**What happens**:
- After ~3 reschedules: attempts=3, maxAttempts=3
- `attempts < max_attempts` condition becomes FALSE
- Job is no longer eligible for claiming
- **Job stuck in "queued" state FOREVER**
- `setupPhase` never advances past "starting_docker"

## Concrete Example

### Timeline of a Stuck Job

```
T=0s:   docker.waitReady job created, attempts=0, state="queued"
T=0s:   Queue worker claims it
        - attempts increments: 0→1
        - state → "running"

T=0s:   Handler checks services
        - Both not ready yet (Docker just starting)
        - calls ctx.reschedule(1000)
        - throws RescheduleError

T=0s:   Queue worker catches RescheduleError
        - calls rescheduleJob()
        - state → "queued"
        - attempts STAYS at 1

T=1s:   Queue worker claims it again
        - attempts increments: 1→2
        - state → "running"

T=1s:   Handler checks services
        - Still not ready
        - reschedule again

T=1s:   rescheduleJob() executes
        - state → "queued"
        - attempts STAYS at 2

T=2s:   Queue worker claims it again
        - attempts increments: 2→3
        - state → "running"

T=2s:   Handler checks services
        - Still not ready
        - reschedule again

T=2s:   rescheduleJob() executes
        - state → "queued"
        - attempts STAYS at 3

T=3s:   Queue worker tries to claim next job
        - Checks: attempts < max_attempts
        - Evaluates: 3 < 3 = FALSE
        - SKIPS THIS JOB
        - Job permanently stuck in "queued" state

T=3s onwards: Job never runs again
        - Containers actually start and become ready at T=5s
        - But job can't be claimed to process success
        - setupPhase stays "starting_docker" forever
```

### Database State (Observed)

```sql
SELECT id, type, state, attempts, max_attempts, run_at FROM queue_jobs
WHERE project_id='ec7d735746b2737a5099b46c'
AND type='docker.waitReady';

-- Result:
id              | type          | state  | attempts | max_attempts | run_at
12ab34cd56ef... | docker.waitReady | queued | 3        | 3            | 2024-12-20 12:05:32

-- The job is stuck:
-- - state='queued' (should be 'running' or 'succeeded')
-- - attempts=3 equals max_attempts=3
-- - Will never be claimed again (WHERE clause filters it out)
```

## Root Cause Analysis

### Why rescheduleJob() Doesn't Decrement Attempts

Looking at the code comment:
```typescript
// Note: attempts is NOT decremented - it was already incremented on claim.
// But we don't set lastError, so this looks like a normal reschedule.
```

This assumes that:
- Polling jobs should consume attempts budget
- Rescheduling should count the same as error retries

**But this is wrong for polling jobs**:
- Polling is not an error - services are starting up
- Each poll is a normal state check, not a failure
- They should NOT count toward maxAttempts

### The Core Misunderstanding

The system conflates two different concepts:

| Concept | Current Behavior | Should Be |
|---------|------------------|-----------|
| **Error Retry** | Inc attempts on claim + error | Inc attempts on claim + error |
| **Polling** | Inc attempts on claim + reschedule | DO NOT inc attempts on reschedule |

This causes polling jobs to "look like" they're failing and retrying when they're actually waiting.

## Problem: Why It Fails

### 1. Attempts Increment on Every Claim (Line 412)
- claimNextJob() increments attempts automatically
- This makes sense for error retries (track failure attempts)
- **Wrong for polling**: Each poll shouldn't count as a failure

### 2. Reschedule Doesn't Decrement (Line 353-373)
- rescheduleJob() leaves attempts unchanged
- Comment suggests this is intentional
- **But prevents polling from being rescheduled indefinitely**

### 3. Where Clause Filters by Attempts (Line 418)
- Query: `WHERE ... AND attempts < max_attempts`
- Once polling job hits maxAttempts, query returns NULL
- **Job becomes invisible to queue worker**
- **Job permanently stuck**

### 4. No Distinction Between Polling and Error-Retry
- Both use same `attempts` counter
- But they have fundamentally different semantics
- Polling: "How many times have we checked?"
- Error-retry: "How many times have we failed?"

## Solution

### Option Analysis

#### OPTION A: Decrement Attempts in rescheduleJob()
**Pros:**
- Minimal code change (1 line)
- Preserves attempts semantics for error retries
- Polling jobs can reschedule infinitely

**Cons:**
- Breaks error retry tracking (attempt gets un-counted)
- Confusing: increment on claim, decrement on reschedule

**Verdict:** ❌ Breaks error-retry tracking

#### OPTION B: Track Reschedule Count Separately
**Pros:**
- Clean separation of concerns
- Polling count tracked independently
- Attempts stays for error retries

**Cons:**
- Requires schema change (new column)
- More complex logic

**Verdict:** ✅ Best long-term solution

#### OPTION C: Don't Increment Attempts for Polling Jobs
**Pros:**
- Prevents inflation of polling jobs
- Cleanest semantic

**Cons:**
- Hard to identify polling jobs at claim time
- Requires job type metadata

**Verdict:** ⚠️ Requires job metadata

### RECOMMENDED SOLUTION: Option B + Hybrid Approach

**Best approach**: Combine decrement with metadata

1. **Add reschedule counter to queueJobs schema**
   - `rescheduleCount` INTEGER DEFAULT 0

2. **Modify claimNextJob() WHERE clause**
   - Change: `AND attempts < max_attempts`
   - To: `AND (attempts < max_attempts OR reschedule_count = 0)`
   - Allows first reschedule to NOT count as attempt

3. **Modify rescheduleJob() to increment rescheduleCount**
   - Add: `rescheduleCount: sql\`reschedule_count + 1\``
   - Decrement attempts: `attempts: sql\`attempts - 1\``

4. **Set maxAttempts high for polling jobs**
   - docker.waitReady: maxAttempts = 300 (300 reschedules * 1s = 5 mins)
   - opencode.waitIdle: maxAttempts = 300 (300 reschedules * 2s = 10 mins)

### SIMPLIFIED SOLUTION (Quicker Fix)

**If you don't want schema changes:**

Just modify rescheduleJob() to decrement attempts:

```typescript
export async function rescheduleJob(
  jobId: string,
  workerId: string,
  delayMs: number
): Promise<void> {
  const now = new Date();

  await db.update(queueJobs).set({
    state: "queued",
    runAt: new Date(Date.now() + delayMs),
    lockedAt: null,
    lockExpiresAt: null,
    lockedBy: null,
    updatedAt: now,
    attempts: sql`attempts - 1`,  // ← CHANGE: Decrement attempts
  }).where(and(eq(queueJobs.id, jobId), eq(queueJobs.lockedBy, workerId)));
}
```

And set maxAttempts appropriately when enqueueing:

```typescript
export async function enqueueDockerWaitReady(
  input: DockerWaitReadyPayload
): Promise<QueueJob> {
  return enqueueJob({
    id: randomBytes(16).toString("hex"),
    type: "docker.waitReady",
    projectId: input.projectId,
    payload: { ...input, rescheduleCount: 0 },
    maxAttempts: 300,  // ← CHANGE: Allow many reschedulules
    // No dedupe - allow multiple waits if needed
  });
}
```

**Why this works:**
- Attempts: 1→2 on claim, then 2→1 on reschedule = stays at 1
- With maxAttempts=300, job can reschedule indefinitely
- Prevents attempts from accumulating

## Files to Change

### 1. src/server/queue/queue.model.ts (Line 353-373)
Change `rescheduleJob()` to decrement attempts:
```typescript
attempts: sql`attempts - 1`,
```

### 2. src/server/queue/enqueue.ts (Line 68-81)
Change `enqueueDockerWaitReady()` to set high maxAttempts:
```typescript
maxAttempts: 300,  // Allow 5 mins of 1-second polls
```

### 3. src/server/queue/enqueue.ts (Line 133-143)
Change `enqueueOpencodeWaitIdle()` to set high maxAttempts:
```typescript
maxAttempts: 300,  // Allow 10 mins of 2-second polls
```

### Optional: src/server/queue/queue.worker.ts (Line 165-168)
Add debug log to track reschedules:
```typescript
logger.debug(
  { jobId: job.id, type: job.type, delayMs: error.delayMs, attempts: job.attempts },
  "Queue job rescheduled (polling)"
);
```

## Impact on Other Systems

### Affected Jobs
- ✅ `docker.waitReady` - FIXED: Can reschedule indefinitely
- ✅ `opencode.waitIdle` - FIXED: Can reschedule indefinitely
- ✅ Other error-retry jobs - FIXED: Still work correctly (maxAttempts 3)

### Compatibility
- ✅ No breaking changes to queue.worker.ts
- ✅ No changes to RescheduleError mechanism
- ✅ No database schema changes (simplified solution)
- ✅ All existing jobs continue working

### Monitoring
- Watch job duration for polling jobs (should be ~5 mins max)
- Monitor max reschedule count (should not exceed 300)
- Log when jobs hit reschedule limits

## Complexity Estimate

**Implementation**: 1-2 hours
- 3 code changes (1-2 lines each)
- Write+review+test

**Testing**: 1-2 hours
- Create new project, watch docker.waitReady
- Verify attempts behavior during rescheduling
- Verify setupPhase advances to next stage
- Verify timeout still works (Bug #2)

**Total**: 2-4 hours

---

# BUG #2: Presence Timeout

## Current Flow (Broken)

### Where Timeout is Calculated
**File**: `src/server/presence/manager.ts` (lines 128-145)

```typescript
if (project.setupPhase !== "not_started" && 
    project.setupPhase !== "completed" && 
    project.setupPhase !== "failed") {
  
  const phaseTimeout = SETUP_PHASE_TIMEOUTS[project.setupPhase];
  if (phaseTimeout) {
    const elapsed = Date.now() - project.createdAt.getTime();  // ← LINE 132: BUG
    if (elapsed > phaseTimeout) {
      // Setup has timed out
      await updateProjectSetupPhaseAndError(projectId, "failed", errorMsg);
    }
  }
}
```

### Timeout Constants
**File**: `src/server/presence/manager.ts` (lines 14-21)

```typescript
const SETUP_PHASE_TIMEOUTS: Record<string, number> = {
  "not_started": 10_000,          // 10 seconds
  "creating_files": 30_000,       // 30 seconds
  "starting_docker": 120_000,     // 2 minutes ← Most common timeout
  "initializing_agent": 30_000,   // 30 seconds
  "sending_prompt": 30_000,       // 30 seconds
  "waiting_completion": 600_000,  // 10 minutes
};
```

### What Should Happen (But Doesn't)

#### Scenario: Project Takes 1 Minute to Start Docker
```
T=0s:   Project created (createdAt = T0)
        setupPhase = "not_started"

T=0s:   Queue job project.create runs

T=0s:   Queue job docker.composeUp runs
        setupPhase changed to "creating_docker"
        setupStartedAt SHOULD be set to T=0s (but isn't!)

T=60s:  User views project (presence heartbeat)
        Handler checks timeout:
        elapsed = T=60s - T=0s = 60,000ms
        phaseTimeout = 120,000ms
        60,000 < 120,000 = FALSE ✓ Still within time

        Docker services still starting up (normal)
        Handler reschedules docker.waitReady

T=120s: Phase still at "starting_docker"
        Handler checks timeout:
        elapsed = T=120s - T=0s = 120,000ms
        phaseTimeout = 120,000ms
        120,000 > 120,000 = TRUE ✗ TIMEOUT!
        
        BUT: Phase has only been running for 120 seconds
        It SHOULD have only been running for 120 seconds
        This is correct timeout!
        
        EXCEPT: User wasn't watching for first 60 seconds
        So phase actually started at T=60s
        Real phase time = 120 - 60 = 60 seconds
        Should NOT timeout yet!
```

### The Real Problem: Using createdAt Instead of setupStartedAt

**Project.createdAt** = when project DB record was created
- Time when user submitted form
- Could be days/weeks before setup phase checked

**Project.setupStartedAt** = when setup began (already exists in schema!)
- Should be updated when each phase starts
- Currently NOT being updated

### Actual Broken Scenario

```
T=0s:       Project created (createdAt = T0)
            setupPhase = "not_started"
            setupStartedAt = NULL

T=0s:       Queue jobs start running automatically

T=0s:       docker.composeUp handler runs
            Sets setupPhase = "starting_docker"
            ✗ Does NOT update setupStartedAt!

T=120s:     User first checks project status (presence heartbeat)
            elapsed = T=120s - T=0s = 120,000ms
            phaseTimeout = 120,000ms (starting_docker timeout)
            elapsed > phaseTimeout = TRUE ✗
            
            Sets setupPhase = "failed" ✗ WRONG!
            
            BUT: Phase only been running ~120 seconds
            Which is exactly the limit!
            
            The problem: timeout includes 120 seconds of
            "nobody looking at it" before phase even started
```

### Another Scenario: User Creates Project But Doesn't Check

```
T=0s:       Project created (createdAt = T0)
            Queue jobs auto-start in background

T=0s-120s:  No user viewing project (no presence heartbeats)
            Docker starting up in background

T=120s:     User clicks project to view it
            presence/manager.ts calculates timeout:
            elapsed = 120s - 0s = 120s
            phaseTimeout = 120s for "starting_docker"
            
            elapsed >= phaseTimeout = TRUE
            Sets phase = "failed"
            
            BUT: Containers might be 95% ready!
            Just needed 10 more seconds of Docker startup
            User sees error because they opened it too late
```

## Root Cause Analysis

### Why setupStartedAt Isn't Updated

**File**: `src/server/projects/projects.model.ts` (lines 170-178)

```typescript
export async function updateProjectSetupPhase(
  id: string,
  setupPhase: SetupPhase
): Promise<void> {
  await db.update(projects).set({ setupPhase })  // ← Only updates phase
    .where(eq(projects.id, id));
}
```

The `setupStartedAt` column exists in schema:
```typescript
setupStartedAt: integer("setup_started_at", { mode: "timestamp" }),
```

But it's **never initialized or updated**:
- Not set in createProject()
- Not set in updateProjectSetupPhase()
- Always NULL
- So presence/manager.ts falls back to createdAt

### Time Reference Issues

**Using createdAt (WRONG)**:
```
Project.createdAt = 2024-12-20 10:00:00 (user submitted form)
Phase: "starting_docker" started at 2024-12-20 10:01:30
User checks at 2024-12-20 10:03:00

Elapsed = 10:03:00 - 10:00:00 = 3 minutes
Timeout = 2 minutes
3 > 2 = TIMEOUT ✗ WRONG

Actual phase time = 10:03:00 - 10:01:30 = 1:30
Should NOT timeout yet
```

**Using setupStartedAt (CORRECT)**:
```
Phase: "starting_docker" started at 2024-12-20 10:01:30
User checks at 2024-12-20 10:03:00

Elapsed = 10:03:00 - 10:01:30 = 1:30
Timeout = 2 minutes
1:30 < 2:00 = OK ✓ CORRECT
```

## Problem: Why It Fails

### 1. setupStartedAt is Never Set (Project Creation)
- Project created with setupStartedAt = NULL
- Should be: setupStartedAt = NOW()

### 2. setupStartedAt is Never Updated (Phase Changes)
- Each phase change should update setupStartedAt
- Currently: updateProjectSetupPhase() ignores it

### 3. Presence Uses Wrong Reference (Timeout Calculation)
- Line 132: uses project.createdAt
- Should use: project.setupStartedAt ?? project.createdAt

### 4. Timeout is Global, Not Per-Phase
- Currently times out from project creation
- Should time out from phase start
- Example: "starting_docker" phase should get 120s from when docker.composeUp started

### 5. Timeout and Queue Job Timeouts Conflict
**Two timeout mechanisms with different reference points:**

| Mechanism | Trigger | Reference | Timeout |
|-----------|---------|-----------|---------|
| Presence | Every heartbeat (15s) | project.createdAt | SETUP_PHASE_TIMEOUTS |
| docker.waitReady | Every reschedule (1s) | payload.startedAt | 5 minutes |

These don't align:
- Presence might mark failed after 2 minutes
- Queue job expects up to 5 minutes
- User sees error when queue job still working

## Solution

### FIX #1: Update setupStartedAt on Phase Changes
**File**: `src/server/projects/projects.model.ts` (lines 170-178)

Change from:
```typescript
export async function updateProjectSetupPhase(
  id: string,
  setupPhase: SetupPhase
): Promise<void> {
  await db.update(projects).set({ setupPhase })
    .where(eq(projects.id, id));
}
```

To:
```typescript
export async function updateProjectSetupPhase(
  id: string,
  setupPhase: SetupPhase
): Promise<void> {
  await db.update(projects).set({
    setupPhase,
    setupStartedAt: new Date(),  // ← CHANGE: Track when phase started
  }).where(eq(projects.id, id));
}
```

**Why**: Each phase is a new "wait period" starting fresh at that moment

### FIX #2: Use setupStartedAt for Timeout Calculation
**File**: `src/server/presence/manager.ts` (lines 129-145)

Change from:
```typescript
const phaseTimeout = SETUP_PHASE_TIMEOUTS[project.setupPhase];
if (phaseTimeout) {
  const elapsed = Date.now() - project.createdAt.getTime();  // ← BUG
  if (elapsed > phaseTimeout) {
    // timeout
  }
}
```

To:
```typescript
const phaseTimeout = SETUP_PHASE_TIMEOUTS[project.setupPhase];
if (phaseTimeout) {
  const startTime = project.setupStartedAt?.getTime() ?? project.createdAt.getTime();
  const elapsed = Date.now() - startTime;  // ← CHANGE: Use phase start time
  if (elapsed > phaseTimeout) {
    // timeout
  }
}
```

**Why**: Measures timeout from when phase started, not when project created

### FIX #3: Optional - Align Queue Job Timeouts
**File**: `src/server/queue/handlers/dockerWaitReady.ts` (lines 9-10)

```typescript
// Current: 5 minutes (300,000ms)
const WAIT_TIMEOUT_MS = 300_000;

// Consider aligning with presence timeout:
// const WAIT_TIMEOUT_MS = 120_000;  // Match SETUP_PHASE_TIMEOUTS["starting_docker"]
```

**Why**: Queue and presence timeouts should align to avoid confusion

## Files to Change

### 1. src/server/projects/projects.model.ts
**Function**: `updateProjectSetupPhase()` (lines 170-178)

Change:
```typescript
await db.update(projects).set({ setupPhase })
```

To:
```typescript
await db.update(projects).set({
  setupPhase,
  setupStartedAt: new Date(),
})
```

### 2. src/server/presence/manager.ts
**Function**: `handlePresenceHeartbeat()` (lines 129-145)

Change:
```typescript
const elapsed = Date.now() - project.createdAt.getTime();
```

To:
```typescript
const startTime = project.setupStartedAt?.getTime() ?? project.createdAt.getTime();
const elapsed = Date.now() - startTime;
```

### Optional: Align Timeouts
If queue job timeout needs to match presence timeout:

**File**: `src/server/queue/handlers/dockerWaitReady.ts`

Change:
```typescript
const WAIT_TIMEOUT_MS = 300_000;  // 5 minutes
```

To match presence:
```typescript
const WAIT_TIMEOUT_MS = 120_000;  // Match SETUP_PHASE_TIMEOUTS["starting_docker"]
```

## Impact on Other Systems

### Affected Handlers
- ✅ `docker.composeUp` - Will update setupStartedAt → "starting_docker"
- ✅ `opencode.sessionCreate` - Will update setupStartedAt → "initializing_agent"
- ✅ `opencode.sendInitialPrompt` - Will update setupStartedAt → "sending_prompt"
- ✅ `opencode.waitIdle` - Will update setupStartedAt → "waiting_completion"

### Compatibility
- ✅ No breaking changes
- ✅ No database schema changes (column already exists)
- ✅ Backwards compatible (uses ?? operator for NULL handling)

### Behavior Changes
- Timeouts now per-phase instead of global
- More forgiving: early phase creations don't consume timeout budget
- More accurate: timeout reflects real phase duration

## Complexity Estimate

**Implementation**: 1-2 hours
- 2 code changes (1-2 lines each)
- Write+review+test

**Testing**: 1-2 hours
- Create project, watch setupStartedAt update
- Verify timeout calculated from phase start
- Verify timeout fires after correct duration
- Verify each phase transition updates setupStartedAt

**Total**: 2-4 hours

---

# Comparative Analysis

## Bug Relationship

### Dependencies
```
Bug #1 (Polling)
    ↓
    Prevents job completion
    ↓
Bug #2 (Timeout) catches symptom
    ↓
    Marks phase as "failed"
```

### Timeline
1. Bug #1 occurs first: Job gets stuck in "queued"
2. Bug #2 activates after timeout: Phase marked "failed"
3. User sees error after waiting for timeout duration

### Should Fix Bug #1 First?
**YES - Absolutely**
- Bug #1 is ROOT CAUSE
- Bug #2 is SAFETY NET
- Fixing Bug #1 prevents Bug #2 from triggering
- Fixing just Bug #2 only makes error appear sooner

### Will Fixing Bug #1 Break Bug #2 Fix?
**NO - They're independent**
- Bug #1 fix: Allow infinite rescheduling
- Bug #2 fix: Use correct timeout reference
- Both can coexist
- Both necessary for reliable setup

## Cascading Effects

### If Bug #1 Fixed But Bug #2 Not Fixed
✅ Jobs complete successfully
✅ setupPhase advances normally
✗ But timeouts use createdAt (may false-fail old projects)

### If Bug #2 Fixed But Bug #1 Not Fixed
✗ Jobs still get stuck
✓ Timeouts more accurate (when they trigger)
✗ Users still see stuck spinner

### If Both Fixed
✅ Jobs complete successfully
✅ setupPhase advances normally
✅ Timeouts accurate
✅ Robust error recovery

## Impact on Other Queue Jobs

### Polling Jobs (Affected by Bug #1)
- `docker.waitReady` - BROKEN
- `opencode.waitIdle` - BROKEN
- Any future polling jobs - BROKEN

**Fix Impact**: All can now reschedule indefinitely

### Error-Retry Jobs (Not Affected by Bug #1)
- `project.create` - Works normally
- `docker.composeUp` - Works normally
- `project.delete` - Works normally
- `docker.stop` - Works normally

**Fix Impact**: None - still respect maxAttempts

### Timeout Tracking (Affected by Bug #2)
- All jobs with timeout logic check presence system
- All benefit from accurate per-phase timeouts
- No negative impact on error-retry logic

---

# Implementation Summary

## Priority Order

### MUST FIX (Critical)
1. **Bug #1** - Queue polling logic
   - Blocks all project setup
   - Jobs get stuck permanently
   - High user impact

2. **Bug #2** - Presence timeout
   - Safety net for Bug #1
   - Accurate timeout tracking
   - Better UX

### Implementation Order
**Week 1:**
- Fix Bug #1 (2-4 hours)
- Test thoroughly
- Deploy

**Week 1 (continued):**
- Fix Bug #2 (2-4 hours)
- Test thoroughly
- Deploy

## Code Locations

### Bug #1 Fixes Required

| File | Lines | Change | Why |
|------|-------|--------|-----|
| `queue.model.ts` | 353-373 | Decrement attempts | Stop accumulating attempts |
| `enqueue.ts` | 68-81 | Set maxAttempts=300 | Allow infinite rescheduling |
| `enqueue.ts` | 133-143 | Set maxAttempts=300 | Same for opencode |

### Bug #2 Fixes Required

| File | Lines | Change | Why |
|------|-------|--------|-----|
| `projects.model.ts` | 170-178 | Add setupStartedAt update | Track phase start time |
| `presence/manager.ts` | 129-145 | Use setupStartedAt | Timeout from phase start |

## Testing Checklist

### Bug #1 Testing

- [ ] Create new project
- [ ] Watch docker.waitReady job in queue
- [ ] Verify attempts stays at 1 during rescheduling
- [ ] Verify setupPhase advances to "initializing_agent" after services ready
- [ ] Verify no "maxAttempts" errors in logs
- [ ] Create 5 projects simultaneously, all should complete

### Bug #2 Testing

- [ ] Create project, check setupStartedAt value
- [ ] Verify setupStartedAt updates on each phase change
- [ ] Create project, wait > 2 minutes, verify setupPhase doesn't timeout prematurely
- [ ] Verify timeout calculation uses setupStartedAt (add logs)
- [ ] Check database: SELECT setupStartedAt FROM projects WHERE id='...'

### Integration Testing

- [ ] Full project creation flow succeeds
- [ ] setupPhase progression: not_started → creating_files → starting_docker → ... → completed
- [ ] All queue jobs for project have state="succeeded"
- [ ] Project status transitions: created → starting → running
- [ ] Preview shows correct website

## Effort Estimate

| Task | Hours | Notes |
|------|-------|-------|
| Bug #1 Implementation | 1-2 | 3 simple code changes |
| Bug #1 Testing | 1-2 | Create projects, watch queue |
| Bug #2 Implementation | 1-2 | 2 simple code changes |
| Bug #2 Testing | 1-2 | Verify setupStartedAt behavior |
| Integration Testing | 1-2 | Full flow verification |
| Code Review | 1 | Standard review process |
| **TOTAL** | **6-11 hours** | **Conservative estimate** |

## Risk Assessment

### Bug #1 Fix Risks
- **LOW**: Decrement logic is straightforward
- **Mitigation**: Set high maxAttempts to be safe
- **Rollback**: Simple reversal if issues occur

### Bug #2 Fix Risks
- **LOW**: setupStartedAt column already exists
- **Mitigation**: Use ?? operator for NULL safety
- **Rollback**: Simple reversal if issues occur

### Combined Risk
- **VERY LOW**: Changes are independent and well-isolated
- **High confidence** in fixes
- **Minimal breaking change potential**

---

# Conclusion

## Summary

**Bug #1**: Queue job polling mechanism increments `attempts` on every claim, causing polling jobs to hit `maxAttempts` and get permanently stuck in "queued" state after ~3 reschedules.

**Bug #2**: Presence timeout calculation uses `project.createdAt` instead of per-phase `setupStartedAt`, causing global timeouts from project creation instead of phase-specific timeouts.

**Relationship**: Bug #1 causes jobs to get stuck; Bug #2 catches the symptom after timeout. Both must be fixed.

**Complexity**: Both are LOW - total 2-4 hours each, 6-11 hours integrated

**Priority**: CRITICAL - Blocks all project setup in queue-integrated system

## Recommendations

1. **Fix Bug #1 immediately** - It's the root cause
2. **Fix Bug #2 immediately after** - It's the safety net
3. **Test thoroughly** - Integration testing across full setup flow
4. **Monitor closely** - Watch for any edge cases
5. **Document changes** - Update AGENTS.md with queue behavior

## Success Criteria

- [ ] Project creation completes successfully
- [ ] setupPhase progresses through all stages
- [ ] All queue jobs reach "succeeded" state
- [ ] No "maxAttempts" error messages
- [ ] Timeouts calculated from phase start time
- [ ] setupStartedAt updated on each phase change
