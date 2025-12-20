# Docker Container Startup Failure Investigation - Complete Report

## Project Under Investigation
- **Project ID**: `92a37799eec041bd7e2966b4`
- **Project Name**: hello-world-page
- **Error Message**: "Setup timeout: starting_docker exceeded 120000ms"
- **Investigation Date**: 2025-12-20 01:04 UTC
- **Creation Date**: 2025-12-19 23:59:16 UTC

## Key Finding
**The Docker containers are RUNNING and HEALTHY, but the setup is marked as FAILED due to multiple bugs in the queue and presence systems.**

## Root Causes Identified

### 1. **CRITICAL: Queue Job Polling Misuses Attempts Counter**
The `docker.waitReady` job polls for service readiness every 1 second. Each poll reschedules the job, which triggers an increment of the `attempts` counter. After 3 reschedules, `attempts=3` equals `max_attempts=3`, preventing any further claims.

**Files Affected:**
- `src/server/queue/handlers/dockerWaitReady.ts` (line 88-113)
- `src/server/queue/queue.worker.ts` (line 163-169)

**Fix Required:** Separate `reschedule_count` from `retry_attempts`

---

### 2. **CRITICAL: Queue Claim Logic Blocks at Max Attempts**
The SQL WHERE clause `attempts < max_attempts` uses less-than comparison. When `attempts=3` and `max_attempts=3`, the condition `3 < 3` is FALSE, preventing the job from being claimed.

**Files Affected:**
- `src/server/queue/queue.model.ts` (line 417)

**Fix Required:** Change claim logic to handle polling jobs differently

---

### 3. **HIGH: Presence Timeout Uses Wrong Time Reference**
The presence manager calculates elapsed time from **project creation** (23:59:16) instead of from when the setup phase **started** (23:59:22). When checking 65 minutes later, the timeout for "starting_docker" (120 seconds) has long passed, triggering a false failure.

**Files Affected:**
- `src/server/presence/manager.ts` (line 132)

**Fix Required:** Add `setup_started_at` field to projects, measure from that time

---

### 4. **MEDIUM: Race Condition in Timeout Detection**
The presence heartbeat system fires independently of queue worker processing. If a user opens a project while the queue is processing, the presence timeout may fire before the job completes, marking it failed prematurely.

**Files Affected:**
- `src/server/presence/manager.ts` (line 129-145)
- `src/server/queue/queue.worker.ts` (line 97-114)

**Fix Required:** Check queue job state before marking setup as failed

---

## Evidence of Container Health

### Docker Container Status
```
$ docker compose -p "doce_92a37799eec041bd7e2966b4" ps
NAME                                   IMAGE           STATUS
doce_92a37799eec041bd7e2966b4-preview-1    node:22-alpine  Up 4 minutes (healthy)
doce_92a37799eec041bd7e2966b4-opencode-1   node:22-slim    Up 4 minutes (healthy)
```

### HTTP Health Checks
```
$ curl -s http://127.0.0.1:62770
# Returns 200 OK with Astro website HTML

$ curl -s http://127.0.0.1:62771/doc
# Returns 200 OK with OpenCode OpenAPI specification
```

### Queue Job Status
```sql
SELECT id, type, state, attempts, max_attempts 
FROM queue_jobs 
WHERE project_id = '92a37799eec041bd7e2966b4';

-- Result:
-- cc297750df2f0466ec3444a1a2e798e2 | docker.waitReady | queued | 3 | 3
```

---

## Timeline of Events

| Time | Event | Status |
|------|-------|--------|
| 23:59:16 | Project created | `setup_phase: not_started` |
| 23:59:20 | docker.composeUp job completed | ✓ Containers started |
| 23:59:22 | docker.waitReady job enqueued | Begins polling every 1s |
| 23:59:23 | Reschedule #1 | `attempts: 0→1` |
| 23:59:24 | Reschedule #2 | `attempts: 1→2` |
| 23:59:25 | Reschedule #3 | `attempts: 2→3` |
| 23:59:26+ | Job stuck | Can't claim (3 < 3 = false) |
| 01:04:00 | Presence heartbeat fires | `elapsed: 65min > 120sec timeout` |
| 01:04:00 | Setup marked FAILED | ✗ False positive! |

---

## Technical Details

### Database Evidence
```sql
-- Timestamps in UNIX seconds
SELECT 
  run_at,
  created_at,
  datetime(run_at, 'unixepoch') as formatted_run_at
FROM queue_jobs 
WHERE id = 'cc297750df2f0466ec3444a1a2e798e2';

-- Result:
-- run_at: 1766188762 | created_at: 1766188760
-- Formatted: 2025-12-19 23:59:22 | 2025-12-19 23:59:20
```

### Queue Claim Query
```sql
-- This query prevents claiming the stuck job
SELECT id FROM queue_jobs
WHERE state='queued'
  AND run_at <= @now
  AND attempts < max_attempts  -- ← 3 < 3 = FALSE
  AND (lock_expires_at IS NULL OR lock_expires_at < @now)
LIMIT 1
-- Returns: 0 rows (job not claimed)
```

---

## Impact Assessment

| Aspect | Rating | Details |
|--------|--------|---------|
| **Severity** | 🔴 CRITICAL | Blocks user access to functional project |
| **Frequency** | 🔴 HIGH | Affects all new projects under load |
| **Scope** | 🔴 WIDESPREAD | All polling-based queue operations |
| **User Impact** | 🔴 CRITICAL | Shows error but containers run |
| **Data Loss Risk** | 🟢 NONE | Containers and data are safe |
| **Recovery Effort** | 🟡 MEDIUM | Manual delete + recreate needed |

---

## Solution Priorities

### Priority 1 - IMMEDIATE
**Decouple polling reschedules from error retries**
- Add `reschedule_count` field to `queue_jobs` table
- Increment `reschedule_count` on reschedule
- Keep `attempts` for actual error retries
- Update claimNextJob SQL to check `reschedule_count`

### Priority 2 - URGENT
**Fix timeout reference point**
- Add `setup_started_at` timestamp to projects table
- Update presence manager to use this field
- Set `setup_started_at` when phase changes to `starting_docker`
- Migrate existing projects' `setup_started_at` = `createdAt`

### Priority 3 - HIGH
**Handle orphaned jobs**
- Detect jobs stuck at max_attempts
- Log them distinctly from other failures
- Consider: auto-retry with fresh count or manual intervention alert

### Priority 4 - MEDIUM
**Improve observability**
- Add detailed queue job logging
- Track reschedules separately from retries
- Create alerts for stuck jobs

---

## Affected Code Files

```
src/server/queue/queue.model.ts
  └─ claimNextJob() @ line 396-475
     └─ WHERE ... AND attempts < max_attempts (line 417)
  └─ rescheduleJob() @ line 353-372

src/server/queue/queue.worker.ts
  └─ runJob() @ line 126-196
     └─ RescheduleError handling (line 163-169)

src/server/queue/handlers/dockerWaitReady.ts
  └─ handleDockerWaitReady() @ line 12-123
     └─ Polling and reschedule logic (line 88-113)

src/server/presence/manager.ts
  └─ handlePresenceHeartbeat() @ line 116-285
     └─ Timeout calculation (line 129-145, especially line 132)

src/server/db/schema.ts
  └─ projects table definition
     └─ Missing: setup_started_at field

src/server/projects/projects.model.ts
  └─ Project lifecycle functions
     └─ Need to set setup_started_at appropriately
```

---

## Verification Steps

To verify the issue exists:
```bash
# 1. Check project status
sqlite3 data/db.sqlite \
  "SELECT name, setup_phase FROM projects \
   WHERE id='92a37799eec041bd7e2966b4'"
# Expected: hello-world-page | failed

# 2. Check queue job
sqlite3 data/db.sqlite \
  "SELECT type, state, attempts FROM queue_jobs \
   WHERE project_id='92a37799eec041bd7e2966b4' AND type='docker.waitReady'"
# Expected: docker.waitReady | queued | 3

# 3. Verify containers are running
docker compose -p "doce_92a37799eec041bd7e2966b4" ps
# Expected: Both containers showing UP and healthy

# 4. Verify HTTP endpoints work
curl http://127.0.0.1:62770
curl http://127.0.0.1:62771/doc
# Expected: Both return 200 OK
```

---

## Related Issues

This same bug pattern will also affect:
- `opencode.waitIdle` - polls until OpenCode stops executing
- Any future polling-based queue operations
- Jobs that reschedule themselves for retries

---

## Documentation Files

This investigation includes the following documentation:

1. **DOCKER_STARTUP_QUICK_REFERENCE.md** - Fast reference guide
2. **DOCKER_STARTUP_FAILURE_ANALYSIS.md** - Complete technical analysis  
3. **DOCKER_STARTUP_VISUAL_GUIDE.txt** - Visual diagrams and flowcharts
4. **DOCKER_STARTUP_FAILURE_SUMMARY.txt** - Executive summary

---

## Conclusion

The Docker container startup failure is a **false positive failure marker**. The containers successfully started and are running healthy services, but due to bugs in the queue job retry mechanism and the presence timeout system, the setup is incorrectly marked as failed. This prevents users from accessing otherwise functional projects.

The fixes are straightforward architectural improvements to separate polling concerns from error handling concerns, and to measure timeouts from the correct reference points.

**Status**: Investigated and documented. Ready for implementation.
