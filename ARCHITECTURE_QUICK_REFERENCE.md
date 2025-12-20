# doce.dev - Quick Architecture Reference

## File Locations for Common Tasks

### Adding a New Page
1. Create file in `src/pages/your-page.astro`
2. Optionally create components in `src/components/your-domain/`
3. Use `<AppLayout>` for consistent header/theme
4. Middleware automatically handles auth redirects

### Adding a Server Action
1. Add to `src/actions/index.ts` (all actions in one file)
2. Define Zod schema for inputs
3. Check `context.locals.user` for auth
4. Return data or throw `ActionError`
5. Use from client: `import { server } from "astro:actions"` then `server.category.action()`

### Adding a Queue Job
1. Add type to `src/server/queue/types.ts` (in enum + payload schema)
2. Create handler in `src/server/queue/handlers/{jobType}.ts`
3. Add handler to `handlerByType` map in `queue.worker.ts`
4. Call `enqueue{JobType}()` from `enqueue.ts` to queue it
5. Handler receives `QueueJobContext` with job, workerId, reschedule

### Adding a Component
1. Create React component in `src/components/{domain}/{ComponentName}.tsx`
2. Use `client:load` directive in `.astro` files to hydrate
3. Import shadcn components from `@/components/ui/{component}`
4. Use Tailwind classes (no Tailwind config needed for Tailwind v4)

### Database Changes
1. Modify schema in `src/server/db/schema.ts`
2. Run `pnpm drizzle-kit generate` to create migration
3. Run `pnpm drizzle-kit push` to apply
4. Create typed model functions in `src/server/{domain}/{entity}.model.ts`

### API Routes
Four types of API routes in `src/pages/api/`:
- **Presence**: POST `/projects/[id]/presence.ts` - heartbeat for container lifecycle
- **Proxy**: ALL `/projects/[id]/opencode/[...path].ts` - forward to opencode server
- **Logs**: GET `/projects/[id]/logs.ts` - SSE stream of container logs
- **Queue**: GET `/queue/jobs/[id].ts` - job detail endpoint

## Data Flow Patterns

### User -> Server -> Database
```
Component (client) 
  → server.action (Astro action)
    → Check auth (context.locals.user)
    → Validate input (Zod)
    → Model function (db read/write)
    → Return result or ActionError
  → Component handles response
```

### User -> Presence Polling
```
useEffect polling presence endpoint
  → POST /projects/[id]/presence
    → handlePresenceHeartbeat() 
      → Check container health
      → Auto-start or stop via queue
    → Return status, previewReady, opencodeReady, etc.
  → SetupStatusDisplay or PreviewPanel responds
```

### Queue Job Execution
```
Enqueue action (in action handler)
  → Job row inserted into queue_jobs
  → Worker claims job (with lock)
  → Handler executes (project.create, docker.composeUp, etc.)
  → If error + retries left: schedule retry
  → If reschedule error: re-queue with delay (polling pattern)
  → If success: mark job complete
  → Worker picks up next job
```

## Key Constants

| What | Value | File |
|------|-------|------|
| Presence heartbeat interval | 15s | presence/manager.ts |
| Idle timeout before stop | 3min (180s) | presence/manager.ts |
| Queue reaper interval | 30s | presence/manager.ts |
| Queue lease duration | 60s | queue/start.ts |
| Queue poll interval | 250ms | queue/start.ts |
| Queue default concurrency | 2 | queue/queue.model.ts |
| Opencode proxy timeout | 30s (5min for messages) | pages/api/projects/[id]/opencode/[...path].ts |
| Session expiry | 30 days | auth/sessions.ts |
| Max proxy body size | 5MB | pages/api/projects/[id]/opencode/[...path].ts |

## Important Modules

### Core
- `src/server/db/client.ts` - Drizzle instance (WAL SQLite)
- `src/server/logger.ts` - Pino logger
- `src/middleware.ts` - Auth, setup check, worker start
- `src/actions/index.ts` - All server actions

### Queue System
- `src/server/queue/queue.worker.ts` - Main loop
- `src/server/queue/queue.model.ts` - DB operations
- `src/server/queue/enqueue.ts` - Job enqueuers
- `src/server/queue/types.ts` - Job types and schemas
- `src/server/queue/handlers/*.ts` - 11 handlers

### Presence & Lifecycle
- `src/server/presence/manager.ts` - Start/stop containers based on viewers
- `src/server/projects/health.ts` - Health checks (preview, opencode)

### Components
- `src/components/chat/ChatPanel.tsx` - Main chat UI (polls opencode)
- `src/components/preview/PreviewPanel.tsx` - Iframe + URL bar
- `src/components/setup/SetupStatusDisplay.tsx` - Setup progress polling
- `src/components/terminal/TerminalDock.tsx` - SSE log streaming

## Testing Tips

### Check Queue Jobs
- Navigate to `/queue` page
- View job details, logs, retry, cancel
- Pause/resume worker
- Adjust concurrency

### Check Presence/Container Status
- Open browser DevTools Network tab
- Filter for "presence" requests
- See timestamps and health status
- Watch container start/stop in Docker

### Check Logs
- In project page, scroll to terminal dock
- Shows real-time container logs via SSE
- See Opencode and Astro dev server output

### Database Inspection
- Sqlite3 CLI: `sqlite3 data/db.sqlite`
- Check queue_jobs table for job status
- Check projects table for ports and status
- Check queue_settings for paused state

## Environment Variables

```bash
# Database
DB_FILE_NAME=data/db.sqlite

# Logging
LOG_LEVEL=debug              # dev default
NODE_ENV=production          # affects logging

# Per-user (stored in DB, not env)
OPENROUTER_API_KEY=sk-...
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Setup page stuck | Check queue worker logs, ensure no DB lock |
| Container won't start | Check docker-compose.yml, volume permissions |
| Opencode proxy timeout | Increase timeout for long-running LLM calls |
| Preview not showing | Check devPort is correct, containers running |
| Jobs stuck in "running" | Check queue reaper, may need forceUnlock |
| Theme not persisting | Check localStorage implementation in ThemeProvider |

## Development Commands

```bash
# Install
pnpm install

# Dev server (with hot reload, queue worker running)
pnpm dev

# Build
pnpm build

# Start production build
pnpm start

# Database migrations
pnpm drizzle-kit generate   # Create migration from schema changes
pnpm drizzle-kit push       # Apply migrations to DB
pnpm drizzle-kit studio     # Visual DB inspector
```

## Tech Stack Reference

| Layer | Tech | Key File |
|-------|------|----------|
| Framework | Astro 5 | astro.config.ts |
| UI | React 19 | @astrojs/react |
| Components | shadcn/ui | components.json |
| Styling | Tailwind v4 CSS vars | src/styles/globals.css |
| Icons | lucide-react | components/ui/* |
| Database | SQLite + Drizzle | drizzle.config.ts |
| Logging | Pino | src/server/logger.ts |
| Validation | Zod | src/server/queue/types.ts |
| Auth | bcrypt + sessions | src/server/auth/* |
| OpenCode | @opencode-ai/sdk | src/server/opencode/* |
| Docker | docker-compose | templates/astro-starter/docker-compose.yml |

