# Presence System

The presence system manages real-time project state, viewer tracking, and automatic container lifecycle.

## Overview

When users view a project, the frontend sends periodic heartbeats to the presence API. The system uses these heartbeats to:

1. Track active viewers per project
2. Keep containers running while users are present
3. Automatically stop idle containers to save resources
4. Restart containers when users return

## Heartbeat Flow

```
Frontend (every ~15s)
      │
      ▼
  Presence API
      │
      ├── Update viewer record
      ├── Cancel any scheduled stop
      ├── Health check preview + opencode
      │
      ├── If unhealthy & not deleting:
      │   └── Enqueue docker.ensureRunning
      │
      └── Return status + poll interval
```

## Dynamic Poll Intervals

The API returns a `nextPollMs` value based on project state:

- **Starting** (0-1.5s): 500ms polls (rapid feedback)
- **Starting** (1.5-13s): 1000ms polls (moderate)
- **Running** (13s+): 2000ms polls (steady state)

This provides fast feedback during startup while reducing load once stable.

## Viewer Tracking

Each browser tab generates a unique viewer ID. The presence manager tracks when each viewer was last seen.

**Stale viewer pruning**: Viewers with no heartbeat for 30 seconds are removed.

## Auto Stop/Start

**Auto Stop**: When no viewers have sent a heartbeat for 60 seconds, the reaper schedules containers to stop.

**Auto Start**: When a heartbeat arrives for a stopped project, `docker.ensureRunning` is enqueued to restart containers.

## Reaper

A background task runs every 30 seconds to:

1. Prune stale viewer records
2. Stop containers for projects with no active viewers

## Project-level Locking

The presence manager uses in-memory mutexes per project to prevent race conditions during lifecycle operations (e.g., simultaneous start and stop requests).

## File Structure

```
src/server/presence/
└── manager.ts    # In-memory presence tracking
```
