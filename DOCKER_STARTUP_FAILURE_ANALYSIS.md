# Docker Container Startup Failure Investigation

**Project ID:** `92a37799eec041bd7e2966b4`
**Project Name:** hello-world-page
**Error:** "Setup timeout: starting_docker exceeded 120000ms"
**Creation Time:** 2025-12-19 23:59:16 UTC
**Investigation Time:** 2025-12-20 01:04 UTC

## Executive Summary

The Docker containers are **actually running and healthy**, but the setup process is marked as **FAILED** due to a critical bug in the queue job retry mechanism combined with a timeout detection system that doesn't account for queue processing delays.

**Root Causes (in order of impact):**
1. **Critical: Queue job max_attempts limit reached prematurely** - `docker.waitReady` job reschedules itself 3 times for polling, incrementing attempts each time, but the code doesn't distinguish between "true failures" and "polling reschedules"
2. **Critical: Job claim condition prevents claiming at 3 attempts** - The SQL WHERE clause `attempts < max_attempts` blocks jobs at exactly max_attempts=3
3. **High: Presence manager timeout is relative to project creation, not phase start** - It calculates elapsed time from project creation time (23:59:16) instead of when the "starting_docker" phase actually began
4. **Medium: Queue worker may not process jobs in time** - Between job enqueue and claim, several seconds can pass, and the presence timeout check fires before the queue worker gets a chance

## Detailed Analysis

### Issue 1: Docker Containers Are Actually Running

**Evidence:**
```
$ docker compose -p "doce_92a37799eec041bd7e2966b4" ps
NAME                                    IMAGE            STATUS
doce_92a37799eec041bd7e2966b4-preview-1    node:22-alpine   Up 4 minutes (healthy)
doce_92a37799eec041bd7e2966b4-opencode-1   node:22-slim     Up 4 minutes (healthy)

$ curl http://127.0.0.1:62770   # preview port
# Returns 200 OK - Astro dev server running

$ curl http://127.0.0.1:62771/doc  # opencode port  
# Returns 200 OK - OpenCode API responding correctly
```

Both containers:
- Are running (UP)
- Are marked healthy
- Respond to health checks
- Have been running for 4+ minutes
- Logs show successful initialization

### Issue 2: Queue Job Stuck at Max Attempts

**Database State:**
```sql
SELECT id, type, state, attempts, max_attempts FROM queue_jobs 
WHERE project_id = '92a37799eec041bd7e2966b4';

cc297750df2f0466ec3444a1a2e798e2|docker.waitReady|queued|3|3
```

**Problem:** The job has `attempts=3` and `max_attempts=3`, but the job is still in `queued` state (not `failed`).

**Why it's stuck:** In `queue.model.ts` line 417:
```sql
WHERE state='queued'
  AND run_at <= @now
  AND attempts < max_attempts  -- <-- THIS CONDITION FAILS: 3 < 3 is FALSE
```

**Root Cause:** The `rescheduleJob()` function (used for polling) doesn't have a special "reschedule without incrementing attempts" mode. Every time the job is claimed, `attempts` is incremented by 1 (see line in `claimNextJob`):
```sql
attempts=attempts+1
```

So the lifecycle was:
1. Job created with attempts=0, max_attempts=3
2. First claim: attempts→1, then reschedule (no error)
3. Second claim: attempts→2, then reschedule (no error)  
4. Third claim: attempts→3, then reschedule (no error)
5. Fourth attempt to claim: FAILS because 3 < 3 is false
6. Job is forever stuck in `queued` state with no way to be claimed

### Issue 3: The Presence Manager Timeout

**Location:** `src/server/presence/manager.ts` lines 129-145

**Code:**
```typescript
if (project.setupPhase !== "not_started" && project.setupPhase !== "completed" && project.setupPhase !== "failed") {
  const phaseTimeout = SETUP_PHASE_TIMEOUTS[project.setupPhase];  // 120_000 for starting_docker
  if (phaseTimeout) {
    const elapsed = Date.now() - project.createdAt.getTime();  // <-- WRONG! Uses project creation time
    if (elapsed > phaseTimeout) {
      // Mark as failed
      const errorMsg = `Setup timeout: ${project.setupPhase} exceeded ${phaseTimeout}ms`;
      await updateProjectSetupPhaseAndError(projectId, "failed", errorMsg);
    }
  }
}
```

**The Bug:** 
- Project created at: 2025-12-19 23:59:16 UTC
- Current time: 2025-12-20 01:04 UTC (64+ minutes elapsed)
- Timeout for "starting_docker": 120,000 ms (2 minutes)
- 64 minutes > 2 minutes ✓ TIMEOUT TRIGGERED

It should measure from when the "starting_docker" phase STARTED, not from project creation!

**Timeline of what actually happened:**
1. 23:59:16 - Project created
2. 23:59:20 - `docker.composeUp` job executed successfully
3. 23:59:22 - `docker.waitReady` job enqueued and started polling
4. 23:59:22-01:04 - `docker.waitReady` rescheduling itself every 1 second (polling)
5. 00:01:22 - After 2 minutes: job has been attempted 3 times, hits max_attempts
6. 00:01:22+ - Job is stuck in `queued` state, can't be claimed
7. 01:04 - User checks presence, 4+ minutes have passed since PROJECT creation
8. Presence manager calculates: 64 minutes > 2 minutes = TIMEOUT
9. Error message set, setup marked as failed

### Issue 4: The Reschedule Logic Problem

**Location:** `src/server/queue/handlers/dockerWaitReady.ts` lines 100-113

**Code:**
```typescript
// Not ready yet - reschedule
logger.info(
  {
    projectId: project.id,
    elapsed,
    attempts: ctx.job.attempts,  // This is the problem
    previewReady,
    opencodeReady,
    nextRetryIn: POLL_DELAY_MS,
  },
  "Services not ready, rescheduling"
);

ctx.reschedule(POLL_DELAY_MS);  // Throws RescheduleError
```

The handler calls `ctx.reschedule()` which throws a `RescheduleError`. This error is caught in `queue.worker.ts` and `rescheduleJob()` is called, which:
1. Sets state back to 'queued'
2. Sets runAt to now + POLL_DELAY_MS
3. BUT doesn't reset attempts

Then on next claim:
- `claimNextJob()` increments attempts again
- This repeats until attempts reaches max_attempts
- At that point, the job can never be claimed again

**The issue is architectural:** Polling operations that reschedule themselves should have a separate "reschedule count" mechanism, not use the retry "attempts" counter.

## Database Timeline

```
Job creation time:        1766188760 (2025-12-19 23:59:20)
Job run_at:              1766188762 (2025-12-19 23:59:22)
Project creation time:    1766188756 (2025-12-19 23:59:16)
Current time:            1766189050 (2025-12-20 01:04)

Elapsed since job creation: 290 seconds = 4.8 minutes
Elapsed since project creation: 294 seconds = 4.9 minutes
Expected timeout: 120 seconds = 2 minutes

Result: TIMEOUT TRIGGERED
```

## Why The Presence System Fired

The presence system is designed to detect stuck setup phases. When a viewer heartbeats:

1. It loads the project
2. Checks if setup_phase is NOT in {not_started, completed, failed}
3. If setup_phase is "starting_docker" and elapsed > 120s, marks it failed
4. Returns error to UI

This is a safety mechanism to prevent projects getting stuck forever, BUT:
- It fires based on **project creation time**, not **phase start time**
- The queue worker may still be legitimately trying to process the job
- It doesn't check if the job is actually stuck vs just slow

## Health Check Status

Despite the setup being marked failed, both services pass health checks:

```
Preview (port 62770):
  ✓ Responds to HTTP requests
  ✓ Returns 200 OK
  ✓ Serving Astro template website

OpenCode (port 62771):
  ✓ Responds to /doc endpoint
  ✓ Returns 200 OK with OpenAPI schema
  ✓ Server is initialized and listening
```

## Why This Is a Critical Bug

1. **Docker setup succeeds but is marked as failed** - Containers are healthy but UI shows error
2. **Orphaned jobs in queue** - Jobs at max_attempts can never be processed
3. **Timing-dependent failure** - Works on fast systems, fails on slow ones or under load
4. **No way for user to recover** - The failed setup blocks access to project preview
5. **Two independent timeout systems** - Queue timeout (120s) vs presence timeout (from creation time)

## Code Locations of Issues

### Issue 1: Max attempts blocking
- File: `src/server/queue/queue.model.ts`
- Line: 417
- Function: `claimNextJob()`

### Issue 2: Reschedule doesn't distinguish from retries
- File: `src/server/queue/queue.worker.ts`
- Line: 163-169
- Function: `runJob()` error handling

### Issue 3: Presence timeout uses wrong time
- File: `src/server/presence/manager.ts`
- Line: 132
- Function: `handlePresenceHeartbeat()`

### Issue 4: Docker.waitReady polling uses attempts as reschedule count
- File: `src/server/queue/handlers/dockerWaitReady.ts`
- Line: 88-113
- Function: `handleDockerWaitReady()`

## How to Reproduce

1. Create a new project
2. Wait 2+ minutes without the queue worker claiming the `docker.waitReady` job
3. When presence heartbeat fires after 2 minutes of PROJECT creation time
4. Setup is marked as failed
5. Actual containers continue running and remain healthy

**OR** (faster reproduction):

1. Create a project
2. Deliberately slow down queue processing or pause the queue
3. Let the `docker.waitReady` job reschedule 3 times
4. Queue worker will never claim it again (max attempts reached)
5. Presence heartbeat sees "starting_docker" phase for too long
6. Marks setup as failed even though containers are running

## Impact Assessment

- **Severity:** CRITICAL
- **Scope:** ALL projects using docker setup
- **User Experience:** Projects appear failed but containers are actually running
- **Data Loss Risk:** None (containers are healthy)
- **Recovery:** Manual docker cleanup required, project must be deleted and recreated

