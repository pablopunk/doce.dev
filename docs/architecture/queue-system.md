# Queue System

The queue system is a durable, database-backed job queue that handles all asynchronous operations.

## Overview

Jobs are stored in SQLite and processed by a worker that runs within the Astro server process. This provides durability (jobs survive restarts) without requiring external infrastructure like Redis.

## Job Types

Jobs fall into three categories:

**Project Lifecycle**
- `project.create` - Create a new project from template
- `project.delete` - Delete a project and clean up resources
- `projects.deleteAllForUser` - Batch delete all user projects

**Docker Lifecycle**
- `docker.composeUp` - Start project containers
- `docker.waitReady` - Poll until services are healthy
- `docker.ensureRunning` - Restart containers if stopped (presence-driven)
- `docker.stop` - Stop project containers

**OpenCode Bootstrap**
- `opencode.sessionCreate` - Create an OpenCode session
- `opencode.sessionInit` - Initialize session with AGENTS.md
- `opencode.sendUserPrompt` - Send the user's initial prompt

## Job States

```
queued ──► running ──► succeeded
              │
              ├──► failed (retries exhausted)
              │
              └──► cancelled (user requested)
```

## Key Concepts

**Project-level Serialization**: Only one job per project can run at a time. This prevents race conditions when multiple jobs target the same project.

**Deduplication**: Jobs with the same `dedupeKey` are deduplicated while active. Useful for preventing duplicate operations.

**Retries with Backoff**: Failed jobs retry with exponential backoff (2s, 4s, 8s... up to 60s max). Default max attempts is 3.

**Reschedule vs Retry**: Handlers can call `reschedule(delayMs)` to re-queue without counting as a failure. Used for polling operations like `docker.waitReady`.

**Cooperative Cancellation**: Long-running handlers should periodically call `throwIfCancelRequested()` to respect cancellation requests.

**Heartbeat/Lease**: Running jobs extend their lease every 5 seconds. If a worker crashes, stale jobs are reclaimed after the lease expires.

## File Structure

```
src/server/queue/
├── types.ts          # Job types and payload schemas
├── queue.model.ts    # Database operations
├── queue.worker.ts   # Worker loop
├── enqueue.ts        # Helper functions to enqueue jobs
├── start.ts          # Worker initialization
└── handlers/         # Individual job handlers
```

## Adding a New Job Type

1. Add the type name to the union in `types.ts`
2. Define a Zod schema for the payload
3. Add payload type mapping
4. Create a handler in `handlers/`
5. Register the handler in `queue.worker.ts`
6. Add an enqueue helper in `enqueue.ts`
