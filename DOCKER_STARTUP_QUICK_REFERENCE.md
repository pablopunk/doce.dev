# Docker Startup Failure - Quick Reference

## Problem Statement
Project ID `92a37799eec041bd7e2966b4` shows "Setup timeout: starting_docker exceeded 120000ms" error, but Docker containers are actually running and healthy.

## Root Causes (Most Critical First)

### 1. Queue Job Polling Bug (CRITICAL)
- **What**: `docker.waitReady` job reschedules itself for polling but increments `attempts` each time
- **Result**: After 3 reschedules, `attempts=3` and `max_attempts=3`, blocking further claims
- **Where**: `src/server/queue/handlers/dockerWaitReady.ts` + `queue.worker.ts`
- **Fix**: Track `reschedule_count` separately from `attempts`

### 2. Queue Claim Blocking (CRITICAL)
- **What**: SQL clause `WHERE attempts < max_attempts` prevents claiming when attempts equals max_attempts
- **Result**: Job stuck in "queued" state forever with no way to be processed
- **Where**: `src/server/queue/queue.model.ts` line 417
- **Fix**: Change to `<=` or don't count polling reschedules as attempts

### 3. Presence Timeout Wrong Time Reference (HIGH)
- **What**: Timeout is measured from project creation time, not from phase start
- **Result**: 65 minutes project age > 2 minute timeout, triggers false failure
- **Where**: `src/server/presence/manager.ts` line 132
- **Fix**: Add `setup_started_at` field, measure from that instead

### 4. Race Condition (MEDIUM)
- **What**: Presence heartbeat fires every 15s; if it checks during queue processing, marks setup failed
- **Result**: Job marked failed before queue worker gets chance to process it
- **Where**: `src/server/presence/manager.ts` + `queue.worker.ts`
- **Fix**: Check if queue worker is actively processing before timing out

## Evidence

### Containers Are Running
```bash
$ docker compose -p "doce_92a37799eec041bd7e2966b4" ps
# Shows both containers UP and healthy

$ curl http://127.0.0.1:62770  # preview
# Returns 200 OK with Astro content

$ curl http://127.0.0.1:62771/doc  # opencode
# Returns 200 OK with OpenCode API
```

### Queue Job Is Stuck
```sql
-- Job has max attempts but can't be claimed
SELECT * FROM queue_jobs WHERE project_id = '92a37799eec041bd7e2966b4';
-- Result: state='queued', attempts=3, max_attempts=3
-- Query: 3 < 3 = FALSE → can't be claimed
```

### Timeline Shows False Timeout
```
23:59:16  Project created
23:59:22  docker.waitReady starts polling (within timeout window)
00:01:22  Job hits max attempts (still within 2 min timeout!)
01:04:00  Presence check fires (65 min after creation > 2 min timeout)
          → Setup marked FAILED (false positive!)
```

## Affected Files

```
src/server/queue/queue.model.ts
  - claimNextJob() @ line 417
  - rescheduleJob() @ line 353

src/server/queue/queue.worker.ts
  - runJob() @ line 163-169

src/server/queue/handlers/dockerWaitReady.ts
  - handleDockerWaitReady() @ line 88-113

src/server/presence/manager.ts
  - handlePresenceHeartbeat() @ line 132

src/server/db/schema.ts
  - projects table - missing setup_started_at field
```

## Impact
- **Severity**: CRITICAL (blocks project access)
- **Scope**: ALL new projects
- **User Impact**: Shows error but containers are healthy
- **Recovery**: Manual delete + recreate
- **Data Loss**: None (containers/data are safe)

## Fixes Required

### Immediate (Priority 1)
```typescript
// PROBLEM: rescheduleJob() increments attempts
rescheduleJob(jobId, workerId, delayMs) {
  // attempts=attempts+1  ← WRONG
}

// SOLUTION: Add reschedule_count field to queue_jobs table
// Track reschedule_count separately
// Don't increment attempts on reschedule
```

### Urgent (Priority 2)
```typescript
// PROBLEM: Timeout uses project.createdAt
const elapsed = Date.now() - project.createdAt.getTime();

// SOLUTION: Add setup_started_at to projects
const elapsed = Date.now() - project.setupStartedAt.getTime();
// Set setupStartedAt when phase transitions to starting_docker
```

### High (Priority 3)
```sql
-- PROBLEM: Claim blocked at max_attempts
WHERE attempts < max_attempts  -- 3 < 3 = false

-- SOLUTION: Allow polling operations to reschedule indefinitely
-- OR: Handle max_attempts failure gracefully
```

## How to Verify Fix

1. Create new project
2. Watch queue jobs processing
3. Verify `docker.waitReady` completes successfully
4. Verify setup_phase transitions to "completed"
5. Verify project access not blocked

## Related Issues
- Affects both "hello-world-page" and "dark-notes" projects
- Same pattern will occur in any polling-based queue operation
- Could also affect: `opencode.waitIdle` and future wait operations

## Testing the Current State
```bash
# Project exists with failed setup
cd /Users/pol/src/doce.dev
sqlite3 data/db.sqlite \
  "SELECT name, setup_phase FROM projects \
   WHERE id = '92a37799eec041bd7e2966b4'"
# Returns: hello-world-page|failed

# But containers are running
docker compose -p "doce_92a37799eec041bd7e2966b4" ps
# Both containers show UP

# And health checks pass
curl -s http://127.0.0.1:62770 | head -1
# Returns HTML content (Astro running)
```

## Additional Documentation
- Full analysis: `DOCKER_STARTUP_FAILURE_ANALYSIS.md`
- Visual guide: `DOCKER_STARTUP_VISUAL_GUIDE.txt`
- Summary: `DOCKER_STARTUP_FAILURE_SUMMARY.txt`
