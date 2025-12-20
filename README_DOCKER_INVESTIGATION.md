# Docker Container Startup Failure - Investigation Report Index

## Quick Navigation

If you're short on time, read these documents in order:

1. **START HERE**: [DOCKER_STARTUP_QUICK_REFERENCE.md](./DOCKER_STARTUP_QUICK_REFERENCE.md)
   - 5-minute overview of the problem and fixes needed
   - Lists affected files and code locations
   - Quick verification steps

2. **VISUAL GUIDE**: [DOCKER_STARTUP_VISUAL_GUIDE.txt](./DOCKER_STARTUP_VISUAL_GUIDE.txt)
   - ASCII diagrams of the problem
   - Timeline visualization
   - Bug chain flowchart
   - Impact matrix

3. **DETAILED ANALYSIS**: [DOCKER_INVESTIGATION_COMPLETE.md](./DOCKER_INVESTIGATION_COMPLETE.md)
   - Complete technical breakdown
   - Root causes explained
   - Solution priorities with code snippets
   - Verification steps

4. **TECHNICAL DEEP-DIVE**: [DOCKER_STARTUP_FAILURE_ANALYSIS.md](./DOCKER_STARTUP_FAILURE_ANALYSIS.md)
   - Database queries and results
   - Code snippets with line numbers
   - Architecture analysis
   - Reproduction steps

## The Problem In 30 Seconds

- **Status**: Project shows "Setup failed" but Docker containers are running healthy
- **Cause**: Queue job gets stuck at max attempts, presence timeout fires with wrong time reference
- **Impact**: Users see error, can't access functional project
- **Fix**: Decouple polling reschedules from retry attempts; fix timeout time reference

## Root Causes (Ranked by Impact)

### 1. Queue Job Polling Bug (CRITICAL)
- `docker.waitReady` increments `attempts` on each polling reschedule
- After 3 reschedules: `attempts=3` equals `max_attempts=3`
- SQL clause `attempts < max_attempts` blocks further claims (3 < 3 is false)
- **Files**: `queue.worker.ts`, `dockerWaitReady.ts`, `queue.model.ts`

### 2. Presence Timeout Wrong Time Reference (HIGH)
- Timeout calculated from project creation time, not phase start time
- Project created 23:59:16, checked 65 minutes later → timeout fires
- Should measure from 23:59:22 when phase actually started
- **Files**: `presence/manager.ts`

### 3. Race Condition (MEDIUM)
- Presence heartbeat fires every 15 seconds
- If it checks while queue is processing, marks setup failed
- Should check queue job state before timing out
- **Files**: `presence/manager.ts`, `queue.worker.ts`

## Files to Modify

```
Priority 1 (Immediate):
├── src/server/queue/queue.model.ts (line 353, 417)
├── src/server/queue/queue.worker.ts (line 163-169)
├── src/server/queue/handlers/dockerWaitReady.ts (line 88-113)
└── src/server/db/schema.ts (add reschedule_count field)

Priority 2 (Urgent):
├── src/server/presence/manager.ts (line 132)
├── src/server/db/schema.ts (add setup_started_at field)
└── src/server/projects/projects.model.ts (set setup_started_at)

Priority 3 (High):
├── src/server/queue/queue.model.ts (handle orphaned jobs)
└── src/server/logger.ts (add queue monitoring)
```

## Verification

The investigation confirms:
- ✅ Both Docker containers are UP and healthy
- ✅ Preview service responds with 200 OK
- ✅ OpenCode API responds with 200 OK
- ✅ Queue job exists but is stuck in zombie state
- ✅ Setup phase stuck on "starting_docker" (should be "completed")
- ✅ Database shows `attempts=3, max_attempts=3` blocking further claims

## Current State of Affected Projects

```bash
# Project 92a37799eec041bd7e2966b4 (hello-world-page)
Setup Phase: failed
Error: Setup timeout: starting_docker exceeded 120000ms
Container Status: RUNNING and healthy
DB Job State: queued with attempts=3/max_attempts=3

# Project 263aa42c597eb0f56d4970e7 (dark-notes)
Setup Phase: failed
Error: Setup timeout: creating_files exceeded 30000ms
Same pattern: queue job stuck, containers are healthy
```

## Investigation Evidence

### Database State
```sql
-- Stuck queue job
SELECT type, state, attempts, max_attempts 
FROM queue_jobs 
WHERE project_id = '92a37799eec041bd7e2966b4' 
AND type = 'docker.waitReady';
-- Result: docker.waitReady | queued | 3 | 3

-- Project setup phase
SELECT setup_phase, setup_error 
FROM projects 
WHERE id = '92a37799eec041bd7e2966b4';
-- Result: failed | Setup timeout: starting_docker exceeded 120000ms
```

### Container Status
```bash
$ docker compose -p "doce_92a37799eec041bd7e2966b4" ps
# Both containers show: Up 4 minutes (healthy)

$ docker compose -p "doce_92a37799eec041bd7e2966b4" logs --tail=5
# Shows successful initialization and running processes
```

### Health Checks
```bash
$ curl http://127.0.0.1:62770
# Returns 200 OK - Astro website serving

$ curl http://127.0.0.1:62771/doc
# Returns 200 OK - OpenCode API responding
```

## Timeline

```
23:59:16 Project created
23:59:20 docker.composeUp succeeds → containers start
23:59:22 docker.waitReady enqueued → begins polling
23:59:23 First poll: reschedule (attempts 0→1)
23:59:24 Second poll: reschedule (attempts 1→2)
23:59:25 Third poll: reschedule (attempts 2→3)
23:59:26 Fourth poll attempt: BLOCKED (3 < 3 is false)
00:01:22 After 2 min: job still stuck (within timeout window!)
01:04:00 Presence check: 65 min > 120 sec timeout → FAIL
01:04:00 Setup marked as failed (false positive!)
```

## How to Reproduce

1. Create a new project
2. Wait for docker.composeUp to succeed
3. Watch docker.waitReady reschedule itself 3 times (watch logs)
4. After 3 reschedules, job will be stuck in queued state
5. Wait 2+ minutes total from project creation
6. When presence heartbeat fires, setup is marked failed
7. But containers remain healthy

## Related Issues

This same bug pattern affects any polling-based queue operation:
- `opencode.waitIdle` - polls until agent stops executing
- Any future "wait" or "poll" jobs
- Custom queue handlers that reschedule themselves

## Documentation Summary

| Document | Size | Purpose |
|----------|------|---------|
| `DOCKER_STARTUP_QUICK_REFERENCE.md` | 5.1K | Quick overview + fixes |
| `DOCKER_STARTUP_VISUAL_GUIDE.txt` | 10K | Diagrams and flowcharts |
| `DOCKER_INVESTIGATION_COMPLETE.md` | 8.5K | Complete technical report |
| `DOCKER_STARTUP_FAILURE_ANALYSIS.md` | 9.2K | Deep technical analysis |
| `DOCKER_STARTUP_FAILURE_SUMMARY.txt` | 6.7K | Executive summary |
| `DOCKER_WAITREADY_BUG.md` | 6.8K | Specific queue bug details |

## Next Steps

1. Review [DOCKER_STARTUP_QUICK_REFERENCE.md](./DOCKER_STARTUP_QUICK_REFERENCE.md)
2. Decide on fix strategy (reschedule_count vs other approach)
3. Implement Priority 1 fixes
4. Test with new project creation
5. Verify queue jobs process correctly
6. Implement Priority 2 fixes
7. Run integration tests

## Questions?

All analysis documents include:
- Database queries you can run
- Code locations with line numbers
- Expected vs actual behavior comparisons
- Step-by-step verification procedures

---

**Investigation Date**: 2025-12-20 01:04 UTC  
**Status**: Complete and documented  
**Ready for**: Implementation
