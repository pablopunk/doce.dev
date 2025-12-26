# Project Lifecycle

Projects go through a series of states from creation to deletion, managed by queue jobs.

## Status States

```
created ──► starting ──► running ◄──► stopping ──► stopped
    │          │            │             │
    ▼          ▼            ▼             ▼
  error      error        error        error

    any ──► deleting ──► (deleted)
```

| Status | Description |
|--------|-------------|
| created | Project record exists, containers not started |
| starting | Containers are being started |
| running | Containers healthy, ready for use |
| stopping | Containers being stopped |
| stopped | Containers stopped (auto-restarts on presence) |
| error | Something failed (see job logs) |
| deleting | Project being deleted (irreversible) |

## Creation Flow

```
User submits prompt
        │
        ▼
1. project.create
   ├── Generate project name (via AI)
   ├── Generate unique slug
   ├── Allocate ports
   ├── Copy template files
   ├── Write .env configuration
   └── Create database record
        │
        ▼
2. docker.composeUp
   └── Start containers
        │
        ▼
3. docker.waitReady (polling)
   ├── Check health endpoints
   ├── Reschedule if not ready
   └── Timeout after 5 minutes
        │
        ▼
4. opencode.sessionCreate
   └── Create OpenCode session
        │
        ▼
5. opencode.sessionInit
   └── Initialize with AGENTS.md
        │
        ▼
6. opencode.sendUserPrompt
   └── Send user's prompt
```

See [Project Creation Flow](./project-creation-flow.md) for details on prompt tracking.

## Deletion Flow

```
User requests deletion
        │
        ▼
1. project.delete
   ├── Set status to "deleting"
   ├── docker compose down --volumes
   ├── Remove project directory
   └── Hard delete from database
```

## Health Checks

Two services are checked for readiness:

**Preview**: Any HTTP response from the dev server port indicates readiness.

**OpenCode**: HTTP 200 from `/doc` endpoint indicates readiness.

## File Structure

```
src/server/projects/
├── projects.model.ts   # Database CRUD
├── create.ts           # Creation logic
├── delete.ts           # Deletion logic
├── health.ts           # Service health checks
└── slug.ts             # URL-safe slug generation
```
