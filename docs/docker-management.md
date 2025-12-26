# Docker Management

Each project runs in isolated Docker containers managed via Docker Compose.

## Container Architecture

Every project runs two containers:

**preview** (`node:22-alpine`)
- Runs the Astro dev server
- Exposes port 4321 (mapped to dynamic host port)
- Serves the user's website preview

**opencode** (`node:22-slim`)
- Runs the OpenCode AI agent server
- Exposes port 3000 (mapped to dynamic host port)
- Handles AI chat and code generation

## Project Naming

Docker resources are prefixed with `doce_{projectId}` to prevent collisions between projects.

## Compose Operations

**Start containers**: `docker compose up -d` (idempotent - safe to call multiple times)

**Stop containers**: `docker compose down` (preserves volumes for faster restarts)

**Full cleanup**: `docker compose down --volumes` (removes all data - used during project deletion)

**Status check**: `docker compose ps` (returns container states)

## Shared Volumes

Three Docker volumes are shared across all projects:

- `pnpm-store` - Shared pnpm cache for faster installs
- `opencode-bin` - OpenCode binary (downloaded once)
- `opencode-data` - OpenCode state/configuration

## Log Management

Container logs are written to `{projectPath}/logs/docker.log` with three log types:

- `[host]` - Commands executed on the host
- `[docker]` - Docker Compose output
- `[app]` - Application output from containers

Logs are streamed continuously via `docker compose logs -f` and can be read with offset-based pagination for real-time display in the terminal dock.

## File Structure

```
src/server/docker/
├── compose.ts    # Docker Compose command execution
└── logs.ts       # Log capture and streaming
```
