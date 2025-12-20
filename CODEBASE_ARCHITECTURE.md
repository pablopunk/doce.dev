# doce.dev Codebase Architecture Analysis

## Executive Summary

This is a fully functional self-hosted AI website builder with ~12K lines of TypeScript/TSX code. The implementation closely follows the AGENTS.md documentation with only minor deviations. The system is production-ready with sophisticated queue-based job orchestration, presence-based container lifecycle management, and proper separation of concerns across server and client layers.

---

## 1. TECH STACK VERIFICATION

### Confirmed Stack
| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| **Framework** | Astro | ^5.16.5 | Server output mode with Node adapter |
| **Adapter** | @astrojs/node | ^9.5.1 | Standalone mode |
| **UI Framework** | React | ^19.2.3 | Client-side components |
| **React Integration** | @astrojs/react | ^4.4.2 | Astro-React bridge |
| **UI Components** | shadcn/ui | 3.6.2 | CSS variables-based (not utilities) |
| **Icons** | lucide-react | ^0.561.0 | Icon library |
| **Styling** | Tailwind CSS | ^4.1.18 | v4 without JS config |
| **Styling Plugin** | @tailwindcss/vite | ^4.1.18 | Vite integration |
| **Database** | SQLite + better-sqlite3 | 12.5.0 | File-based, WAL mode enabled |
| **ORM** | drizzle-orm | ^0.45.1 | Strongly typed queries |
| **Migrations** | drizzle-kit | ^0.31.8 | 9 migrations applied |
| **Logging** | pino | ^10.1.0 | Structured logging with pretty-printing in dev |
| **Validation** | Zod | ^4.1.13 | Schema validation |
| **Package Manager** | pnpm | 10.20.0 | Monorepo capable |
| **OpenCode SDK** | @opencode-ai/sdk | ^1.0.152 | Agent communication |

### Configuration Files
- **tsconfig.json**: strictest Astro preset with path aliases (@/*)
- **astro.config.ts**: Server mode, Node adapter, Tailwind Vite plugin
- **drizzle.config.ts**: SQLite dialect, migrations in ./drizzle/
- **components.json**: shadcn configuration (CSS variables, new-york style)

---

## 2. PROJECT STRUCTURE

```
src/
├── actions/
│   └── index.ts          # All Astro server actions (CRUD, queue ops)
├── components/
│   ├── chat/             # ChatPanel, ChatMessage, ChatInput, ToolCall*
│   ├── dashboard/        # CreateProjectForm, ModelSelector, HeroSection
│   ├── navbar/           # Navbar, NavLinks, MobileMenu, ThemeToggle
│   ├── preview/          # PreviewPanel (iframe container)
│   ├── projects/         # ProjectCard, DeleteProjectDialog
│   ├── queue/            # QueueTableLive, QueuePlayerControl, JobDetailLive
│   ├── settings/         # DeleteAllProjectsSection
│   ├── setup/            # SetupStatusDisplay (polling for setup progress)
│   ├── terminal/         # TerminalDock (SSE-based log streaming)
│   ├── ui/               # shadcn components (button, dialog, etc.)
│   └── providers/        # ThemeProvider (dark/light mode)
├── layouts/
│   └── AppLayout.astro   # Top-level layout with Navbar
├── pages/
│   ├── api/
│   │   ├── projects/[id]/opencode/[...path].ts  # Opencode proxy
│   │   ├── projects/[id]/presence.ts             # Presence heartbeat
│   │   ├── projects/[id]/logs.ts                 # SSE log streaming
│   │   └── queue/jobs/[id].ts                    # Queue job details
│   ├── projects/[...params].astro                # Project page (chat + preview)
│   ├── queue/[id].astro                          # Queue job detail page
│   ├── index.astro                               # Dashboard (projects grid)
│   ├── login.astro                               # Login form
│   ├── setup.astro                               # Admin setup form
│   └── settings.astro                            # User settings
├── server/
│   ├── auth/
│   │   ├── password.ts       # bcrypt hashing
│   │   └── sessions.ts       # DB-backed session management
│   ├── db/
│   │   ├── client.ts         # Drizzle instance (WAL mode SQLite)
│   │   └── schema.ts         # 7 tables with full type exports
│   ├── docker/
│   │   ├── compose.ts        # docker-compose CLI wrapper
│   │   └── logs.ts           # Container log streaming
│   ├── opencode/
│   │   ├── client.ts         # OpencodeClient creation
│   │   └── normalize.ts      # Response normalization
│   ├── ports/
│   │   └── allocate.ts       # Port allocation (devPort, opencodePort)
│   ├── presence/
│   │   └── manager.ts        # Presence system (3min inactivity timeout)
│   ├── projects/
│   │   ├── projects.model.ts # CRUD + soft-delete
│   │   ├── health.ts         # Health checks (preview, opencode)
│   │   ├── slug.ts           # Unique slug generation
│   │   ├── create.ts         # Project creation logic (deprecated)
│   │   └── delete.ts         # Project deletion logic (deprecated)
│   ├── queue/
│   │   ├── queue.worker.ts   # Main queue loop (polling, claiming, executing)
│   │   ├── queue.model.ts    # DB operations for jobs
│   │   ├── start.ts          # Global worker initialization
│   │   ├── enqueue.ts        # Convenience enqueue functions
│   │   ├── types.ts          # Job types and payload schemas (Zod)
│   │   └── handlers/         # 11 queue job handlers
│   │       ├── projectCreate.ts
│   │       ├── projectDelete.ts
│   │       ├── projectsDeleteAllForUser.ts
│   │       ├── dockerComposeUp.ts
│   │       ├── dockerWaitReady.ts (reschedule pattern)
│   │       ├── dockerEnsureRunning.ts
│   │       ├── dockerStop.ts
│   │       ├── opencodeSessionCreate.ts
│   │       ├── opencodeSessionInit.ts
│   │       ├── opencodeSendInitialPrompt.ts
│   │       └── opencodeWaitIdle.ts
│   ├── settings/
│   │   └── openrouter.ts     # API key validation, model list
│   ├── logger.ts             # Pino logger (pretty-print in dev)
│   └── middleware.ts         # Auth, setup check, queue worker start
├── styles/
│   └── globals.css           # Tailwind v4, CSS variables, shadcn
├── env.d.ts                  # Astro locals type (App.Locals.user)
└── middleware.ts             # Auth middleware

templates/
└── astro-starter/            # Project template (copied on creation)
    ├── src/components/ui/    # shadcn components (duplicated)
    ├── docker-compose.yml    # 2 services: preview (Astro), opencode
    └── package.json          # Astro + React + Tailwind

drizzle/
├── meta/
│   ├── _journal.json         # Migration history
│   └── *.json                # Snapshots
└── *.sql                     # 9 migrations (0000-0009)
```

### Key Observations
- **Size**: ~12K lines of code (mostly server-side logic)
- **Single Layout**: Only one Astro layout (AppLayout) - minimal overhead
- **API Routes**: Only 4 main API route files (proxy, presence, logs, queue details)
- **No nested routes**: Uses rest parameters instead of nested folders
- **Model Layer**: All DB operations abstracted into model files
- **Separation**: Clear domains (auth, queue, docker, opencode, presence)

---

## 3. DATABASE & DRIZZLE SETUP

### Schema (7 Tables)
```typescript
users              - Single admin user (id, username, password_hash, createdAt)
sessions           - DB-backed sessions (id, userId, tokenHash, expiresAt)
userSettings       - Per-user config (userId, openrouterApiKey, defaultModel)
projects           - Website projects (id, slug, name, prompt, model, ports, status, etc.)
queueJobs          - Background jobs (type, state, payload, retries, locks, dedupe)
queueSettings      - Global queue config (paused, concurrency)
```

### Advanced Features
- **WAL Mode**: Enabled for concurrent read/write performance
- **Soft Deletes**: Projects table uses `deletedAt` column
- **Type Inference**: Full TypeScript support via `$inferSelect/$inferInsert`
- **Indexes**: Optimized for queue claiming (state, runAt, lockExpiresAt)
- **Dedupe**: Queue jobs support deduplication via `dedupeKey`
- **Migrations**: 9 sequential migrations, cleanly organized

### Path: `data/db.sqlite`
- Configurable via `DB_FILE_NAME` env var
- Directory auto-created if missing
- Shared across pnpm workspace

---

## 4. KEY PATTERNS & IMPLEMENTATIONS

### 4.1 Astro Actions Pattern
All server-side operations use `defineAction` in `/src/actions/index.ts`:
- **Auth**: createAdmin, login, logout
- **Settings**: save, get (OpenRouter config)
- **Projects**: create, list, get, delete, stop, updateModel, deleteAll
- **Queue**: cancel, retry, runNow, pause, resume, forceUnlock, deleteJob, deleteByState, setConcurrency

**Key Pattern**: Actions use `context.locals.user` (set by middleware) for auth and `ActionError` for structured errors.

```typescript
export const server = {
  setup: { createAdmin: defineAction({...}) },
  auth: { login: defineAction({...}) },
  // ... 30+ actions
}
```

### 4.2 Queue System (Sophisticated)
**Architecture**: In-process worker loop started in middleware

**Job Types** (11 types):
```
project.create, project.delete, projects.deleteAllForUser
docker.composeUp, docker.waitReady, docker.ensureRunning, docker.stop
opencode.sessionCreate, opencode.sessionInit, opencode.sendInitialPrompt, opencode.waitIdle
```

**Key Features**:
- **Claiming**: Optimistic locking with lease expiration
- **Retries**: Exponential backoff (2s, 4s, 8s... up to 60s)
- **Rescheduling**: Special `RescheduleError` for polling jobs (waitReady, waitIdle)
- **Heartbeat**: Worker sends heartbeats to extend lease during long operations
- **Deduplication**: Prevents duplicate jobs for same resource
- **Concurrency**: Configurable via DB (default 2)
- **Pause/Resume**: Global queue control
- **Cancellation**: Long-running jobs can be cancelled

**Handler Pattern**: Each handler receives `QueueJobContext` with:
- `job`: Full job record
- `workerId`: For lock management
- `throwIfCancelRequested()`: Check cancellation
- `reschedule(delayMs)`: For polling

### 4.3 Presence System (Container Lifecycle Management)
**Location**: `/src/server/presence/manager.ts`

**Purpose**: Start/stop Docker containers based on user viewing

**Key Constants**:
- **Heartbeat**: 15 seconds
- **Idle Timeout**: 3 minutes
- **Reaper Interval**: 30 seconds
- **Start Max Wait**: 30 seconds

**Flow**:
1. Client sends heartbeat with viewerId
2. Server checks if container is healthy
3. If not running and needs to be, enqueue docker.ensureRunning
4. If no viewers for 3 minutes, enqueue docker.stop
5. Reaper runs every 30s to prune stale viewers

**Response** includes setup phase info:
```typescript
interface PresenceResponse {
  status, viewerCount, previewReady, opencodeReady, message, nextPollMs,
  initialPromptSent, initialPromptCompleted, bootstrapSessionId
}
```

### 4.4 OpenCode Proxy
**Location**: `/src/pages/api/projects/[id]/opencode/[...path].ts`

**Purpose**: Forward requests to OpenCode server in container

**Security**:
- Validates session first
- Allowlists paths: session, event, doc, path, config
- Strips hop-by-hop headers and cookies
- Max body size: 5MB
- Timeouts: 30s default, 5min for messages

**Timeout Strategy**: Different timeouts for message endpoints (LLM can be slow)

### 4.5 Authentication
**Pattern**: DB-backed sessions (not JWT)

**Flow**:
1. User creates admin via setup page
2. Password hashed with bcrypt (in password.ts)
3. Session token generated (32 random bytes)
4. Session stored with tokenHash (SHA256)
5. Token sent as httpOnly cookie

**Validation**: Middleware checks session validity on every request

### 4.6 Astro Middleware
**Locations**: `/src/middleware.ts`

**Responsibilities**:
1. Check if setup needed (no users exist → redirect to /setup)
2. Validate session from cookie
3. Set `context.locals.user` for actions/pages
4. Redirect to login if needed
5. Start queue worker (one-time)

### 4.7 Project Template System
**Location**: `/templates/astro-starter/`

**Lifecycle**:
1. User inputs prompt
2. projectCreate handler copies template to `data/projects/{projectId}/`
3. Template includes docker-compose.yml with 2 services
4. OpenRouter API key written to .env
5. User-selected model written to opencode.json

**Services in Container**:
- **preview**: `node:22-alpine` running `pnpm dev` (Astro)
- **opencode**: `node:22-slim` running OpenCode server

**Volumes**:
- pnpm-store (shared for speed)
- opencode-bin (OpenCode cache)

### 4.8 Data Flow: Project Creation
```
1. User submits CreateProjectForm (prompt, model)
2. projects.create action fires (Astro action)
3. Action generates projectId, enqueues job immediately, returns
4. UI polls presence endpoint until setup complete
5. Queue worker processes project.create:
   a. Generate project name (AI)
   b. Generate unique slug
   c. Allocate ports
   d. Copy template
   e. Write .env
   e. Create DB record
   f. Enqueue docker.composeUp
6. Queue worker processes docker.composeUp
7. Queue worker processes docker.waitReady (with reschedules)
8. Queue worker processes opencode.sessionCreate
9. Queue worker processes opencode.sendInitialPrompt
10. Queue worker processes opencode.waitIdle
11. SetupStatusDisplay component detects completion via presence polling
12. Chat + Preview panels render
```

### 4.9 UI Components Pattern
**Folder Structure**: Components organized by domain with nested subcomponents

**Example** (ChatPanel):
```
ChatPanel.tsx           - Main component with state (items, streaming, etc.)
├── ChatMessage.tsx     - Single message display
├── ToolCallDisplay.tsx - Tool call rendering
├── ToolCallGroup.tsx   - Grouped tool calls
└── ChatInput.tsx       - Input field with send
```

**Key Pattern**: Heavy use of `client:load` directive for interactivity

**State Management**: React useState (no Redux, no Context API)

---

## 5. ACTUAL VS DOCUMENTED DISCREPANCIES

### Fully Implemented (As Per AGENTS.md)
- ✓ Tech stack (Astro v5, React, Tailwind v4 CSS variables, Drizzle SQLite)
- ✓ pnpm monorepo
- ✓ Astro actions for server operations
- ✓ Queue system with concurrency control
- ✓ Docker compose per project
- ✓ OpenCode SDK integration
- ✓ Presence-based container lifecycle
- ✓ 3-minute inactivity timeout
- ✓ Chat UI with message history
- ✓ Preview panel with iframe
- ✓ Terminal dock with SSE log streaming
- ✓ OpenRouter API key validation
- ✓ Model selector
- ✓ Setup phase system
- ✓ Admin single-user auth

### Minor Differences from Documentation

1. **Setup Phase Tracking**: NOT implemented via enum field
   - AGENTS.md mentions: `setupPhase` enum (not_started → completed)
   - Actually implemented: Uses `initialPromptSent` and `initialPromptCompleted` booleans
   - PresenceResponse includes both flags, SetupStatusDisplay reads them

2. **No setupPhase Column**
   - Schema has `initialPromptSent`, `initialPromptCompleted` instead
   - Works the same way but schema differs

3. **Model Selection**: Implemented but not with enum
   - Stores model name as string (not from enum)
   - AVAILABLE_MODELS list is in openrouter.ts

4. **Logging**: Uses pino (as documented) but logs are well-structured

5. **Preview Protection**: Via `initialPromptCompleted` check (same goal)

### Not Implemented Yet (From README.md To-Do)
- File tree view / file editing
- Multi-user support (single admin only)
- Git integration
- Project export/import
- URL bar in preview
- Asset insertion
- Multiple design systems
- Fork project
- Chrome DevTools MCP
- Remote projects
- Integrations (DB, APIs)

---

## 6. ARCHITECTURAL STRENGTHS

1. **Clean Separation**: Server (models, queue, auth) vs Client (components, actions)
2. **Type Safety**: Full TypeScript everywhere, Zod validation
3. **Resilience**: Queue with retries, heartbeats, locks, deduplication
4. **Scalability**: In-process worker can be moved to separate service
5. **Debugging**: Structured logging, queue admin UI, job inspector
6. **DX**: Astro's hybrid rendering, React components for interactivity
7. **DB**: SQLite with WAL mode, proper migrations, schema versioning
8. **Async**: Non-blocking queue, proper Promise handling

---

## 7. PRODUCTION READINESS

**Status**: ✓ Production-ready with caveats

**Strengths**:
- Proper error handling (try-catch, ActionError)
- Database transactions implied in queue model
- Session validation on every protected request
- Input validation via Zod
- Structured logging
- Health checks before assuming service is ready

**Considerations**:
- Single admin user (multi-user requires schema changes)
- SQLite (fine for single-server, not multi-process)
- In-process queue worker (not distributed)
- No rate limiting on API routes
- No CSRF protection visible (Astro might handle)

---

## 8. CODE STATISTICS

- **Total Lines**: ~12K TypeScript/TSX/Astro
- **Server Code**: ~60% (queue, models, handlers)
- **Client Code**: ~30% (components, styling)
- **Config/Schema**: ~10% (migrations, types)
- **Largest File**: queue.worker.ts (199 lines)
- **Migrations**: 9 files (init through removal of setup_phase)
- **Components**: 35+ (many are small, single-purpose)
- **API Routes**: 4 main routes (proxy, presence, logs, queue)

---

## 9. DEPLOYMENT NOTES

**Runtime Requirements**:
- Node.js 22+ (per docker-compose template)
- Docker + Docker Compose (for project containers)
- 512MB+ RAM (app + worker)
- Disk space (SQLite + project folders)

**Env Variables**:
- `DB_FILE_NAME`: SQLite path (default: data/db.sqlite)
- `NODE_ENV`: production/development
- `LOG_LEVEL`: debug/info/warn/error
- Per-user: `OPENROUTER_API_KEY` (stored in DB)

**Build**:
```bash
pnpm install
pnpm build
pnpm start
```

**File Structure**:
```
data/
  db.sqlite
  projects/
    {projectId}/
      docker-compose.yml
      src/
      package.json
      ...
```

