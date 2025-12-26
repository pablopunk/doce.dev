# Deployments Feature

Production deployment capability for doce.dev projects.

## Overview

The Deployments feature allows users to build and deploy production versions of their projects in isolated Docker containers alongside the dev preview server.

## Architecture

### Database Schema

Added fields to `projects` table:
- `productionPort` (integer) - Allocated port for production container
- `productionUrl` (text) - URL to access deployed application
- `productionStatus` (enum) - Current deployment status
- `productionStartedAt` (timestamp) - When deployment started
- `productionError` (text) - Error message if deployment failed

### Job Queue

Three new job types in the queue system:

1. **production.build** - Runs `pnpm run build` to create production build
2. **production.start** - Starts Docker container with Dockerfile.prod
3. **production.waitReady** - Polls health endpoint until production server is ready

Jobs are serialized per-project (one at a time) to prevent conflicts.

### Docker Setup

Added production service to docker-compose template:
- Uses `Dockerfile.prod` for building and serving
- Runs `pnpm run build && pnpm run preview --host`
- Allocated dynamic port via `PRODUCTION_PORT` env var
- Profile-based activation (only starts when explicitly deployed)

### Astro Action

`server.projects.deploy(projectId)`:
- Verifies user ownership
- Checks project is in "running" state
- Enqueues production.build job
- Returns job ID for tracking

## User Flow

1. User clicks "Deploy" button in PreviewPanel
2. Frontend calls `server.projects.deploy` action
3. Backend enqueues `production.build` job
4. Job sequence executes:
   - Build: `pnpm run build`
   - Start: Docker compose up with production service
   - WaitReady: Poll until server responds
5. Frontend polls `/api/projects/[id]/production` for status
6. When ready, button shows deployed URL with external link icon

## API Endpoints

### GET /api/projects/[id]/production
Returns current production status:
```json
{
  "status": "running",
  "url": "http://localhost:5100",
  "port": 5100,
  "error": null,
  "startedAt": "2025-12-26T..."
}
```

### GET /api/projects/[id]/production-stream
Server-Sent Events stream for real-time production status updates.

## Button States

- **Idle** (default): User can click to deploy
- **Building** (spinning): Build in progress, disabled
- **Deployed** (green): Shows deployed URL, click to open
- **Failed** (red): Shows error, can retry

## Features

- ✅ One-click deployment
- ✅ Auto port allocation for production container
- ✅ Real-time status updates via polling
- ✅ Production build with `pnpm run build && pnpm run preview`
- ✅ Health check polling (5 minute timeout, 1s poll interval)
- ✅ Integrated with existing queue system
- ✅ Per-project serialization to prevent conflicts
- ✅ Auto-stop like preview (60s idle timeout via presence system)

## Implementation Notes

### Build on Host vs Container

Currently, `pnpm run build` runs inside the Docker container during startup. This allows the container to be fully self-contained. Future optimization: build on host machine and copy `dist/` folder into container.

### Port Allocation

Production uses the same port allocator as preview and opencode services. This ensures no conflicts and allows multiple projects to deploy simultaneously.

### Production Service Profile

The production service uses Docker Compose profiles, so it only starts when explicitly deployed. This saves resources - projects don't spin up production containers by default.

### Error Handling

- Build failures: Captured in `productionError` field, displayed in UI
- Container startup failures: Health check timeout after 5 minutes
- Network issues: Gracefully retry with exponential backoff

## Future Enhancements

1. Host-based build optimization (pre-build, copy dist to container)
2. Deployment history with rollback capability
3. Auto-scaling for multiple production instances
4. Environment variable configuration UI
5. Webhook integration for CI/CD
6. Static site generation support
7. Cloud provider integration (Vercel, Netlify, etc.)

## Testing

To test the deployment feature:

1. Create a project normally
2. Wait for preview server to be running
3. Click the "Deploy" button
4. Wait for build phase (check queue if needed)
5. Watch status update to "Deployed"
6. Click external link icon to open deployed version

Check `/api/projects/[id]/production` endpoint to verify status.
Check queue in UI to see job progress.
