# Docker WaitReady Job Polling Bug

## Overview

There is a critical issue with the `docker.waitReady` queue job that causes it to get stuck in an infinite `queued` state, preventing project setup from progressing beyond the "starting_docker" phase (Step 2 of 6).

## Problem Description

### Symptoms
- Projects created with a new setup phase system get stuck at "starting_docker" phase
- The `docker.waitReady` queue job continuously gets rescheduled instead of progressing
- Job `attempts` counter increments (observed: 3+ attempts) but `state` remains "queued"
- Project status eventually becomes "running" (containers are actually working) but `setupPhase` stays "starting_docker" 
- Users see the setup spinner indefinitely, never advancing to the next phase

### Example Scenario
```sql
-- Project created
SELECT setup_phase, status FROM projects WHERE id='ec7d735746b2737a5099b46c';
-- Result: starting_docker | running  (MISMATCH - should be completed)

-- Queue jobs for this project
SELECT type, state, attempts FROM queue_jobs WHERE project_id='ec7d735746b2737a5099b46c';
-- Results:
-- project.create    | succeeded | 1
-- docker.composeUp  | succeeded | 1
-- docker.waitReady  | queued    | 3  ← STUCK HERE
```

## Root Cause Analysis

### The Job Flow
The queue job execution for `docker.waitReady` follows this flow:

1. **Initial Execution**: Queue worker calls `handleDockerWaitReady()`
2. **Health Check**: Checks if preview and opencode services are ready via `checkPreviewReady()` and `checkOpencodeReady()`
3. **Not Ready Case**: If services aren't ready yet, the job calls `ctx.reschedule(POLL_DELAY_MS)` to retry later
4. **RescheduleError**: This throws a `RescheduleError` which should propagate to the queue worker

### The Bug
The issue appears to be in the error handling within `handleDockerWaitReady()`:

**File**: `src/server/queue/handlers/dockerWaitReady.ts`

```typescript
try {
  // ... health checks and logic ...
  
  if (previewReady && opencodeReady) {
    // Success path - enqueue next job
    await enqueueOpencodeSessionCreate({ projectId: project.id });
    return;
  }
  
  // Not ready yet - reschedule
  ctx.reschedule(POLL_DELAY_MS);
  
} catch (error) {
  // Don't catch reschedule errors - those should propagate
  if (error instanceof RescheduleError) {
    throw error;
  }
  const errorMsg = error instanceof Error ? error.message : String(error);
  await updateProjectSetupPhaseAndError(project.id, "failed", errorMsg);
  throw error;
}
```

### Suspected Issues

1. **RescheduleError Not Properly Propagating**
   - Even though we explicitly check `if (error instanceof RescheduleError) throw error`, the error might not be getting to the queue worker
   - The queue worker may not be recognizing the RescheduleError and marking the job properly

2. **Job Not Advancing State**
   - The queue job state stays "queued" instead of transitioning to "running" or completing
   - The job is being rescheduled (attempts increment) but the state machine isn't advancing

3. **Services Actually Ready But Check Failing**
   - `checkPreviewReady()` or `checkOpencodeReady()` might be returning false even when services are up
   - This would cause infinite rescheduling

4. **Timeout Accumulation**
   - The WAIT_TIMEOUT_MS check should fail the setup after 5 minutes, but instead it keeps rescheduling
   - This suggests the timeout logic isn't being reached

## Evidence from Testing

### Database State
After project creation with setup phase system:
```
Project ID: ec7d735746b2737a5099b46c
setup_phase: starting_docker
status: running
setupError: (null)

Queue jobs:
- project.create: succeeded (1 attempt)
- docker.composeUp: succeeded (1 attempt)  
- docker.waitReady: queued (3+ attempts) ← STUCK
```

### Observational Evidence
- Container IS actually running (project status = "running")
- Preview endpoint IS responding (we see "Hello, World!" page)
- OpenCode server IS accessible
- But the job keeps rescheduling instead of detecting success

## Code References

### Handler Location
**File**: `src/server/queue/handlers/dockerWaitReady.ts`
- Lines 43-56: Success path with `enqueueOpencodeSessionCreate()`
- Lines 59-65: Reschedule logic
- Lines 66-73: Error catch block with RescheduleError check

### Queue Worker Location
**File**: `src/server/queue/queue.worker.ts`
- Should have logic to handle RescheduleError
- Should update job state appropriately

### Health Check Functions
**File**: `src/server/projects/health.ts`
- `checkPreviewReady(port: number)` - checks if dev server is responding
- `checkOpencodeReady(port: number)` - checks if opencode server is responding

### Related Constants
**File**: `src/server/queue/handlers/dockerWaitReady.ts`
- `WAIT_TIMEOUT_MS = 300_000` (5 minutes)
- `POLL_DELAY_MS = 1_000` (1 second between polls)

## Investigation Checklist

When debugging this issue, check:

- [ ] Is RescheduleError being thrown correctly when services aren't ready?
- [ ] Is the queue worker properly catching and handling RescheduleError?
- [ ] Are the health check functions (`checkPreviewReady`, `checkOpencodeReady`) actually returning true when services are up?
- [ ] Is the timeout logic (WAIT_TIMEOUT_MS) being reached, or does it get stuck before that?
- [ ] Are there any logs from the queue worker showing job state transitions?
- [ ] Is the job being properly rescheduled with updated runAt timestamp?
- [ ] Check if `ctx.reschedule()` is actually throwing RescheduleError or just returning

## Potential Fixes to Test

1. **Verify RescheduleError Implementation**
   - Ensure RescheduleError is properly exported and used
   - Check if the queue worker correctly recognizes this error type

2. **Add Logging**
   - Add debug logs in dockerWaitReady to see which code path is taken
   - Log when services become ready
   - Log each reschedule attempt

3. **Health Check Validation**
   - Add detailed logging to health check functions
   - Verify ports and timeout values
   - Test health checks independently

4. **Queue Worker Logic**
   - Review how queue worker handles RescheduleError vs regular errors
   - Ensure job state transitions are correct
   - Check if job is being marked as "failed" incorrectly

5. **Timeout Enforcement**
   - Verify the elapsed time calculation is working
   - Ensure timeout actually fails the job instead of rescheduling

## Impact

- **Severity**: High
- **Scope**: All new project creation with queue-integrated setup phases
- **User Impact**: Users cannot complete project setup; get stuck on "Starting containers..." screen
- **Workaround**: Manually set `setupPhase = 'completed'` in database, but this defeats the purpose of the setup system

## Next Steps

1. Review queue worker error handling for RescheduleError
2. Add comprehensive logging to dockerWaitReady handler
3. Test health check functions in isolation
4. Review the complete job execution lifecycle in queue.worker.ts
5. Consider adding a maximum reschedule count to prevent infinite loops
