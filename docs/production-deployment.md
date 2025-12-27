# Production Deployment System

Production deployments allow projects to build and run as standalone services accessible via dedicated ports and URLs. This document describes the complete architecture, API, and workflow with atomic versioning and rollback support.

## Overview

The production system enables deploying project outputs (typically websites) as running containers on dedicated ports. Each project can have at most one active production deployment.

Deployments are **atomic and versioned**: each build creates an immutable snapshot identified by a hash of the `dist/` folder. This enables safe multi-version management and instant rollback to previous deployments.

### Directory Structure

```
data/
  production/
    my-project-id/
      a1b2c3d4/         # Version 1: hash-based deployment
        src/
        dist/
        logs/
        docker-compose.production.yml
        ...
      b2c3d4e5/         # Version 2: newer deployment
        src/
        dist/
        logs/
        ...
      current -> b2c3d4e5   # Symlink to active deployment (atomic switching)
```

The system keeps the last 2 versions (current + 1 for rollback) and automatically cleans up older ones.

### Status States

Production deployments progress through these states:

- **`stopped`**: No deployment running (initial state)
- **`queued`**: Deployment job queued, waiting to execute
- **`building`**: Build in progress (runs `docker build` or equivalent)
- **`running`**: Build complete, container started and healthy
- **`failed`**: Build or startup failed with error
- **`error`** (transient): Temporary error during health checks or startup

## Job Queue Pipeline

Production deployments use a 4-stage queue job pipeline:

### 1. `production.build`
**File**: `src/server/queue/handlers/productionBuild.ts`

Builds the project output from source code and calculates deployment hash:
- Runs build command defined in Dockerfile
- Creates production-ready artifacts in `dist/`
- Calculates SHA256 hash of `dist/` folder (8-char prefix)
- If fails, sets `productionStatus = "failed"` and `productionError` message
- On success, passes hash to `production.start` job

### 2. `production.start`
**File**: `src/server/queue/handlers/productionStart.ts`

Sets up versioned deployment directory and starts container:
- Allocates unused port for the production service
- Creates hash-versioned directory: `data/production/{projectId}/{hash}/`
- Copies artifacts (src/, dist/, configs) to versioned directory
- Atomically updates `current` symlink to point to new hash (enables instant switching)
- Starts container from versioned directory
- Stores hash in `productionHash` database column
- Automatically cleans up old versions (keeps last 2)
- On success, enqueues `production.waitReady`
- On failure, sets `productionStatus = "failed"`

### 3. `production.waitReady`
**File**: `src/server/queue/handlers/productionWaitReady.ts`

Waits for the production server to be ready:
- Polls health endpoint (HTTP `GET /`) for HTTP 2xx response
- Retries for up to 5 minutes with exponential backoff
- Updates `productionStartedAt` when ready
- Sets `productionStatus = "running"`
- If timeout, sets `productionStatus = "failed"`

### 4. `production.stop`
**File**: `src/server/queue/handlers/productionStop.ts`

Stops and cleans up the production deployment:
- Kills running container
- Releases allocated port
- Cleans up Docker resources
- Sets `productionStatus = "stopped"`
- Clears `productionPort`, `productionUrl`, `productionError`

## Database Schema

Production-related columns in the `projects` table:

| Column | Type | Description |
|--------|------|-------------|
| `productionStatus` | enum | Current deployment state (stopped, queued, building, running, failed) |
| `productionPort` | int | Allocated port number (null if stopped) |
| `productionUrl` | string | Full URL to running deployment (null if stopped) |
| `productionError` | string | Error message if build/start failed (null if successful) |
| `productionStartedAt` | timestamp | When the production server became ready (null if not running) |
| `productionHash` | string | 8-character SHA256 hash of dist/ folder (identifies current version) |

## API Endpoints

### GET `/api/projects/[id]/production`

Get current production deployment status.

**Request**:
```bash
GET /api/projects/my-project-id/production
```

**Response** (200 OK):
```json
{
  "status": "running",
  "url": "http://localhost:3001",
  "port": 3001,
  "error": null,
  "startedAt": "2025-12-27T10:30:45Z",
  "activeJob": {
    "type": "production.waitReady",
    "state": "running"
  }
}
```

**Fields**:
- `status`: Current production status (see Status States)
- `url`: Full URL to running deployment (null if not running)
- `port`: Allocated port number (null if not running)
- `error`: Error message if deployment failed
- `startedAt`: ISO timestamp when deployment became healthy
- `activeJob`: Currently executing queue job (null if idle)

### POST `/api/projects/[id]/deploy`

Trigger build and deployment.

**Request**:
```bash
POST /api/projects/my-project-id/deploy
Content-Type: application/json

{}
```

**Response** (200 OK):
```json
{
  "status": "queued",
  "url": null,
  "port": null,
  "error": null,
  "startedAt": null,
  "activeJob": {
    "type": "production.build",
    "state": "queued"
  }
}
```

**Behavior**:
- If `productionStatus` is already "queued" or "running", returns current status
- Sets `productionStatus = "queued"` and clears previous error
- Enqueues `production.build` job
- Transitions through states as jobs execute

### GET `/api/projects/[id]/production-stream`

Server-Sent Events stream for build and deployment progress.

**Request**:
```bash
GET /api/projects/my-project-id/production-stream
```

**Response** (200 OK, text/event-stream):

Streams real-time events as deployment progresses:

```
event: production.building
data: {"message":"Build started..."}

event: production.building
data: {"message":"Installing dependencies..."}

event: production.starting
data: {"message":"Starting container on port 3001..."}

event: production.ready
data: {"status":"running","url":"http://localhost:3001","port":3001}

event: production.error
data: {"error":"Build failed: npm install exited with code 1"}
```

**Event Types**:
- `production.building`: Build in progress
- `production.starting`: Container startup in progress
- `production.ready`: Server is ready and healthy
- `production.error`: Build or startup failed
- `stream.end`: Event stream completed

### POST `/api/projects/[id]/stop-production`

Stop running production deployment.

**Request**:
```bash
POST /api/projects/my-project-id/stop-production
Content-Type: application/json

{}
```

**Response** (200 OK):
```json
{
  "status": "stopped",
  "url": null,
  "port": null,
  "error": null,
  "startedAt": null,
  "activeJob": {
    "type": "production.stop",
    "state": "queued"
  }
}
```

**Behavior**:
- If already stopped, returns current status
- Sets `productionStatus = "queued"` (for cleanup job)
- Enqueues `production.stop` job
- Clears port allocation and URL
- Preserves `productionHash` for rollback history

### GET `/api/projects/[id]/production-history`

Get list of available production deployment versions for rollback.

**Request**:
```bash
GET /api/projects/my-project-id/production-history
```

**Response** (200 OK):
```json
{
  "versions": [
    {
      "hash": "b2c3d4e5",
      "isActive": true,
      "createdAt": "2025-12-27T14:30:00Z"
    },
    {
      "hash": "a1b2c3d4",
      "isActive": false,
      "createdAt": "2025-12-27T13:15:00Z"
    }
  ]
}
```

**Fields**:
- `hash`: 8-character version identifier (hash of dist/)
- `isActive`: Whether this is the currently running version
- `createdAt`: ISO timestamp when this version was deployed

### POST `/api/projects/[id]/rollback-production`

Instantly rollback to a previous deployment version.

**Request**:
```bash
POST /api/projects/my-project-id/rollback-production
Content-Type: application/json

{
  "toHash": "a1b2c3d4"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "hash": "a1b2c3d4",
  "message": "Rolled back to version a1b2c3d4"
}
```

**Behavior**:
- Stops the currently running version's container
- Atomically switches the `current` symlink to target version
- Starts the target version's container
- Updates `productionHash` in database
- Returns to `running` status immediately
- Cleans up old versions (keeps last 2)
- Can only rollback to non-active versions

**Error Cases**:
- `404`: Target version not found
- `400`: Target version is already active
- `500`: Rollback failed (container start, docker issue, etc.)

## Error Handling & Recovery

### Build Failures

If `production.build` fails:
1. `productionStatus = "failed"`
2. `productionError` contains error message
3. Remaining jobs in pipeline are cancelled
4. Port allocation is released
5. User can retry via `POST /deploy`

### Startup Failures

If `production.start` or `production.waitReady` fail:
1. `productionStatus = "failed"`
2. `productionError` contains error message (e.g., "Health check timeout after 5 minutes")
3. Container is cleaned up
4. Port is released
5. User must retry via `POST /deploy`

### Recovery

To recover from a failed deployment:
```bash
POST /api/projects/[id]/deploy
```

This:
1. Clears previous error message
2. Sets status back to "queued"
3. Re-runs the full pipeline (build → start → ready → running)

## Integration with Project Lifecycle

- **Project Creation**: Production status starts as `stopped`
- **Project Deletion**: Stops production if running (enqueues cleanup)
- **Project Status**: "running" project can have independent production status
- **Setup vs Production**: Production is independent from OpenCode setup (both can run simultaneously)

## Example Workflow: New Deployment

```
User clicks "Deploy to Production"
           ↓
POST /deploy
           ↓
Production status = "queued"
Enqueue production.build
           ↓
Frontend opens /production-stream
           ↓
Event: building
Handler: productionBuild
  ├─ pnpm run build → dist/
  └─ Calculate hash: SHA256(dist/) → "a1b2c3d4"
           ↓
Build completes successfully
Enqueue production.start with hash
           ↓
Event: starting
Handler: productionStart
  ├─ Port 3001 allocated
  ├─ Setup data/production/{id}/a1b2c3d4/
  ├─ Docker compose up (project: doce_prod_{id}_a1b2c3d4)
  ├─ Symlink: data/production/{id}/current → a1b2c3d4
  └─ Cleanup: Remove old versions, keep last 2
           ↓
Enqueue production.waitReady
           ↓
Handler: productionWaitReady
           ↓
Poll GET http://localhost:3001/
           ↓
HTTP 200 received
Status = "running"
productionHash = "a1b2c3d4"
           ↓
Event: ready
Event: stream.end
           ↓
Frontend shows:
"Production running at http://localhost:3001"
```

## Example Workflow: Rollback

```
User views /api/projects/{id}/production-history
           ↓
Response includes 2 versions:
  - a1b2c3d4 (isActive: false)
  - b2c3d4e5 (isActive: true)
           ↓
User clicks "Rollback to a1b2c3d4"
           ↓
POST /api/projects/{id}/rollback-production
  { "toHash": "a1b2c3d4" }
           ↓
Handler:
  ├─ Stop current: docker compose down (project: doce_prod_{id}_b2c3d4e5)
  ├─ Update symlink: data/production/{id}/current → a1b2c3d4
  ├─ Start target: docker compose up (project: doce_prod_{id}_a1b2c3d4)
  ├─ Update DB: productionHash = "a1b2c3d4"
  └─ Cleanup: Remove b2c3d4e5 (keep a1b2c3d4)
           ↓
Status: running (instant)
Hash: a1b2c3d4
           ↓
Frontend shows:
"Rolled back to version a1b2c3d4"
```

## Monitoring & Debugging

### Check Current Status
```bash
curl http://localhost:3000/api/projects/my-project/production
```

### Watch Live Events
```bash
curl http://localhost:3000/api/projects/my-project/production-stream
```

### Inspect Deployment Logs
See: `docs/docker-management.md` for container log access

### Common Issues

**"Health check timeout"**
- Server takes >5 minutes to start
- Check application logs: `docker logs [container-id]`
- Verify application is listening on port

**"Port already in use"**
- Another service using the allocated port
- Manually free port or restart doce.dev

**"Build failed"**
- Check build logs in event stream
- Verify Dockerfile exists and is correct
- Check for npm/build errors

## Atomic Deployment Guarantees

The hash-based versioning system provides several safety guarantees:

### Immutable Versions
- Each deployment is identified by a content hash of `dist/`
- The same `dist/` content always produces the same hash
- Version directories are never modified after creation
- All versions are independent and can coexist

### Atomic Switching
- Symlink updates are atomic at the filesystem level
- New deployments are fully ready before symlink update
- Users never see partial or inconsistent deployments
- Failed deployments don't affect the running version

### Easy Rollback
- Previous versions remain on disk (last 2 kept)
- Rollback is instant (just symlink + container restart)
- No rebuild or file copy needed
- Both forward and backward rollbacks are supported

### Failure Isolation
- Failed deployments don't remove previous versions
- If new deployment fails, previous version continues running
- Each version has isolated Docker containers (distinct project names)
- Port conflicts are prevented through isolation

## Performance Notes

- Build time depends on project size and dependencies
- Startup time depends on application complexity
- Health checks poll every 1-2 seconds (configurable)
- Maximum wait time: 5 minutes
- Deployments use dedicated ports (no conflicts)
- Symlink switching is instant (microseconds)
- Storage: typically 2x application size (keeps 2 versions)

## Future Enhancements

Potential improvements for future versions:
- Production deployment history/rollback
- Zero-downtime deployments (blue-green)
- Custom health check endpoints
- Production logging aggregation
- Automatic redeploy on source changes
- Multiple concurrent production deployments
