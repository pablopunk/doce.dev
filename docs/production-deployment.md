# Production Deployment System

Production deployments allow projects to build and run as standalone services accessible via dedicated ports and URLs. This document describes the complete architecture, API, and workflow.

## Overview

The production system enables deploying project outputs (typically websites) as running containers on dedicated ports. Each project can have at most one active production deployment.

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

Builds the project output from source code:
- Runs build command defined in Dockerfile
- Creates production-ready artifacts
- If fails, sets `productionStatus = "failed"` and `productionError` message
- On success, enqueues `production.start`

### 2. `production.start`
**File**: `src/server/queue/handlers/productionStart.ts`

Starts the built container on an allocated port:
- Allocates unused port for the production service
- Updates `productionPort` in database
- Generates `productionUrl` (typically `http://localhost:{port}`)
- Starts container from built image
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

## Example Workflow

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
           ↓
Build completes successfully
Enqueue production.start
           ↓
Event: starting
Handler: productionStart
           ↓
Port 3001 allocated
Container started
Enqueue production.waitReady
           ↓
Handler: productionWaitReady
           ↓
Poll GET http://localhost:3001/
           ↓
HTTP 200 received
Status = "running"
productionStartedAt = now
           ↓
Event: ready
Event: stream.end
           ↓
Frontend shows:
"Production running at http://localhost:3001"
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

## Performance Notes

- Build time depends on project size and dependencies
- Startup time depends on application complexity
- Health checks poll every 1-2 seconds (configurable)
- Maximum wait time: 5 minutes
- Deployments use dedicated ports (no conflicts)

## Future Enhancements

Potential improvements for future versions:
- Production deployment history/rollback
- Zero-downtime deployments (blue-green)
- Custom health check endpoints
- Production logging aggregation
- Automatic redeploy on source changes
- Multiple concurrent production deployments
