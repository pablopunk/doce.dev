# doce.dev — Implementation Plan (Host App + Project Scaffolding)

This is the execution-grade plan to build **this repo**: the **doce.dev host app**.

The host app:
- authenticates a single admin,
- stores settings (OpenRouter + model defaults) in SQLite,
- scaffolds and orchestrates per-project Docker environments,
- connects as a **client** to each project’s opencode server,
- renders chat + tool calls + todo list,
- shows a live preview iframe,
- streams persistent Docker logs.

This repo does **not** run opencode itself outside project containers.

---

## 0) Scopes (do not mix)

### A) Host App (this repo)
Owns:
- Astro SSR app + UI.
- SQLite DB and migrations.
- Admin auth + sessions.
- OpenRouter settings + API key validation.
- Project lifecycle: create/start/stop/delete.
- Port allocation + persistence.
- Docker orchestration via `docker compose`.
- Log persistence + SSE streaming.
- opencode connectivity as a **client** to each project container.
- Normalized event stream for chat UI.

Does NOT:
- run opencode locally.
- run project preview servers locally.
- directly edit project files (agents inside project do that).

### B) Project Template (copied per project)
Owns:
- The project source scaffold.
- Docker compose services for:
  - preview server (`pnpm dev`)
  - opencode server

Location in this repo:
- `templates/astro-starter/` (copied to `data/projects/<projectId>/`).

### C) Integration Contract (host ↔ project)
Defines:
- Env vars/ports written by host.
- Required endpoints (preview + opencode).
- Event stream semantics.
- Health checks.

---

## 1) Milestones

### M0 — Host setup: auth + settings + DB
Goal: On a fresh install, user completes setup, logs in/out, and saves validated OpenRouter settings.

Includes:
- Setup flow (`/setup`) creates the single admin.
- Password login (`/login`) + logout.
- Settings (`/settings`) for OpenRouter API key + default model.
- OpenRouter key validation on save.
- DB schema + migrations auto-run.

Exit:
- Fresh repo can be started, setup completed, and settings saved.

---

### M1 — Projects: create + docker lifecycle + dashboard
Goal: Create a project from a prompt, allocate ports, copy template, and start Docker.

Includes:
- Data layout:
  - `data/db.sqlite`
  - `data/projects/<projectId>/...`
- `templates/astro-starter/` copied to each project.
- Project creation:
  - AI-generated name/slug (fallback to prompt words), uniqueness enforced.
  - Persistent ports allocated and stored.
  - Template copied into `data/projects/<projectId>`.
  - `.env` (or compose override) written with chosen ports.
  - `docker compose up -d`.
- Dashboard shows projects and status.

Exit:
- New project shows in UI with a working preview URL.

---

### M2 — Chat: opencode client + normalized events
Goal: Custom chat UI that interacts with opencode sessions inside each project.

Includes:
- Host connects to project opencode using `@opencode-ai/sdk` client-only mode.
- All browser calls go through the host (no direct browser-to-container access).
- Host normalizes opencode SSE events into a stable UI event schema.

Exit:
- User can send a message and watch streamed assistant output + tool call lifecycle.

---

### M3 — Preview + logs: iframe + persistent SSE terminal
Goal: Preview iframe and persistent docker logs streaming.

Includes:
- Iframe points to `http://127.0.0.1:<devPort>`.
- Show URL + open-in-new-tab icon.
- Terminal dock:
  - Persistent log file `data/projects/<id>/logs/docker.log`.
  - Host SSE endpoint streams tail + supports reconnect from byte offset.

Exit:
- Logs persist across refresh and show compose start errors.
- Preview updates via HMR.

---

## 2) Host repo bootstrap (comprehensive, command-by-command)

This repo currently contains only docs. Before implementing milestones, bootstrap the host app.

### 2.1 Prerequisites
- `pnpm` installed.
- Node installed (pick a baseline; recommended: Node LTS).
- Docker Desktop / Docker Engine installed.

### 2.2 Create the Astro project
Doc-backed (Astro): you can scaffold and add integrations during creation.

Recommended approach:
- Create the project and include React immediately:
  - `pnpm create astro@latest --add react`

After creation:
- Ensure SSR is enabled with the Node adapter (see 2.4).

### 2.3 Add Tailwind v4 (Astro + Vite plugin)
Doc-backed (Astro styling):
- In Astro `>=5.2.0`, use `pnpm astro add tailwind` to install Tailwind 4 via the official Vite plugin.
- Tailwind v4 uses `@import "tailwindcss";` in your global CSS.

Implementation steps:
1) Install Tailwind 4 support:
   - Preferred (Astro >= 5.2): `pnpm astro add tailwind`
   - If manual is needed: install Tailwind + Vite plugin and wire it in Vite.
2) Create/ensure a global CSS file (standardize on `src/styles/globals.css`).
3) Ensure Tailwind is imported via:
   - `@import "tailwindcss";`
4) Ensure the global CSS is imported once (usually in a layout used by all pages).

Notes:
- Tailwind v4 may use either:
  - Vite plugin (`@tailwindcss/vite`) OR
  - PostCSS plugin (`@tailwindcss/postcss`)
  depending on how Astro wires Tailwind for your version. Prefer the Astro-supported route to avoid drift.

### 2.4 Enable SSR (Node adapter)
Doc-backed (Astro Node adapter): on-demand rendering requires an adapter.

Implementation steps:
1) Install Node adapter:
   - `pnpm astro add node` (preferred)
2) Configure `astro.config.*`:
   - `output: 'server'`
   - `adapter: node({ mode: 'standalone' })`
   - `server: { host: true }` (so it can bind externally when deployed)

Doc-backed example config:
- `adapter: node({ mode: 'standalone' })`
- Run built server with `node ./dist/server/entry.mjs`
- Override host/port at runtime via `HOST=0.0.0.0 PORT=4321 node ./dist/server/entry.mjs`

### 2.5 Add shadcn/ui (Tailwind v4 + CSS variables)

shadcn/ui setup is not “two bullets”; it’s a chain of decisions and generated files.

#### 2.5.1 Decide invariants (must be consistent)
Doc-backed (shadcn): these are effectively immutable after init without reinstalling components.
- `style`: choose one (recommend `new-york`).
- `baseColor`: choose one (e.g. `zinc` or `neutral`).
- `iconLibrary`: choose one (recommend `lucide`).
- `tailwind.cssVariables`: must be `true` (our requirement).

#### 2.5.2 Initialize shadcn CLI
Doc-backed (shadcn): shadcn uses `components.json` to understand your project.

Implementation steps:
1) Run shadcn init (use pnpm; prefer `pnpm dlx` instead of `npx`):
   - `pnpm dlx shadcn@latest init`
2) During prompts (expected):
   - TypeScript: yes
   - Style: `new-york`
   - Base color: choose (recommend `zinc`)
   - Global CSS file: set to `src/styles/globals.css`
   - Import aliases:
     - components: `@/components`
     - ui: `@/components/ui`
     - utils: `@/lib/utils`
     - hooks: `@/hooks`
     - lib: `@/lib`

Result:
- A `components.json` file is created/updated.

#### 2.5.3 Configure `components.json` correctly for Tailwind v4
Doc-backed (shadcn Tailwind v4): Tailwind config path must be empty.

Minimum `components.json` requirements:
- `$schema` should be set.
- Aliases must be correct (shadcn uses them to rewrite imports).
- `tailwind.css` points to `src/styles/globals.css`.
- `tailwind.config` must be blank/empty for Tailwind v4 projects.
- `tailwind.cssVariables` must be `true`.

Doc-backed snippets:
- `$schema`: `https://ui.shadcn.com/schema.json`
- `style`: `new-york`
- Aliases:
  - `aliases.components: "@/components"`
  - `aliases.ui: "@/app/ui"` (example in docs; we will use `@/components/ui`)
  - `aliases.utils: "@/lib/utils"`

#### 2.5.4 Global CSS: import Tailwind + define theme tokens
Doc-backed (shadcn manual install for Tailwind v4): global CSS typically includes:
- `@import "tailwindcss";`
- `@import "tw-animate-css";`
- `@custom-variant dark (&:is(.dark *));`
- `:root` and `.dark` CSS variables
- `@theme inline` mapping vars to Tailwind theme tokens
- base layer applying `bg-background text-foreground`

Implementation steps:
1) Ensure `src/styles/globals.css` contains shadcn’s CSS vars and `@theme inline` mapping.
2) Install `tw-animate-css` dependency if we use the shadcn default globals template.

#### 2.5.5 Add required shadcn utilities
Doc-backed (shadcn): components commonly rely on a `cn()` helper.

Implementation steps:
1) Create `src/lib/utils.ts` with a `cn()` helper (clsx + tailwind-merge).
2) Install dependencies:
   - `clsx`
   - `tailwind-merge`

#### 2.5.6 Add baseline shadcn components
Now the CLI can add components that also install Radix dependencies.

Implementation steps:
- Add core components:
  - `pnpm dlx shadcn@latest add button input label card dialog` (adjust as needed)

Notes:
- Some components install Radix dependencies (e.g. Dialog uses `@radix-ui/react-dialog`).
- Tailwind v4 shadcn notes:
  - `toast` is deprecated in favor of `sonner`.

### 2.6 Add DB + logging deps

#### 2.6.1 Drizzle + SQLite
Doc-backed (Drizzle):
- Use `drizzle-orm` + `better-sqlite3` and `drizzle-kit`.

Install:
- `pnpm add drizzle-orm better-sqlite3`
- `pnpm add -D drizzle-kit @types/better-sqlite3`

Create `.env`:
- Use a host file path (no `file:` prefix required for better-sqlite3):
  - `DB_FILE_NAME=data/db.sqlite`

Create `drizzle.config.ts` (doc-backed shape):
- `dialect: 'sqlite'`
- `schema: './src/server/db/schema.ts'` (or wherever we place schema)
- `out: './drizzle'`
- `dbCredentials.url: process.env.DB_FILE_NAME!`

Migrations:
- Generate: `pnpm drizzle-kit generate --name=init`
- Apply: `pnpm drizzle-kit migrate`

#### 2.6.2 Pino
- Install `pino` (and optionally `pino-pretty` for dev).
- Standardize a single logger instance used by server modules.

---

## 3) Host architecture (file-level plan)

### 3.1 Proposed directory structure
Keep action handlers thin; put logic under `src/server/*`.

- `src/actions/`
  - `index.ts` (export `server = { ... }`)

- `src/middleware.ts`

- `src/server/db/`
  - `client.ts` (opens SQLite, exposes drizzle db)
  - `schema.ts`
  - `migrations.ts` (boot-time migration runner)

- `src/server/auth/`
  - `password.ts` (hash/verify)
  - `sessions.ts` (create/lookup/revoke)
  - `cookies.ts` (cookie config)
  - `guards.ts` (requireUser)

- `src/server/settings/`
  - `settings.model.ts` (DB access)
  - `openrouter.ts` (validation + naming)

- `src/server/projects/`
  - `projects.model.ts` (DB access)
  - `create.ts` (copy template, write env, start docker)
  - `delete.ts`
  - `slug.ts`

- `src/server/ports/`
  - `allocate.ts`

- `src/server/docker/`
  - `compose.ts` (up/down/status; detect `docker compose` vs `docker-compose`)
  - `logs.ts` (log follower + tail helpers)

- `src/server/opencode/`
  - `client.ts` (createOpencodeClient factory)
  - `normalize.ts` (event normalization)
  - `proxy.ts` (request proxy helpers)

- `src/pages/`
  - `index.astro` (dashboard)
  - `setup.astro`
  - `login.astro`
  - `settings.astro`
  - `projects/[id]/[slug].astro`
  - `api/projects/[id]/logs.ts` (SSE)
  - `api/projects/[id]/opencode/[...path].ts` (proxy)
  - `api/projects/[id]/opencode/event.ts` (normalized SSE)

- `src/layouts/`
  - `AppLayout.astro` (imports `src/styles/globals.css`)

- `src/components/`
  - `auth/`, `settings/`, `projects/`, `chat/`, `terminal/`, `layout/`

---

## 4) Host primitives (doc-backed)

### 4.1 Astro Actions
Doc-backed:
- Define actions in `src/actions/index.ts` exporting `export const server = { ... }`.
- Use `defineAction()` from `astro:actions` with Zod validation via `z` from `astro:schema`.
- Client-side: `import { actions } from 'astro:actions'`.
- Server-side: `Astro.callAction(actions.x, input)`.
- Form result UX: `Astro.getActionResult(actions.x)`.

Organizing actions:
- Astro allows nesting objects inside `server`, so we can have `server.auth.login`, `server.projects.create`, etc.

### 4.2 Astro Middleware
Doc-backed:
- Implement `src/middleware.ts` using `defineMiddleware()` from `astro:middleware`.
- Use `getActionContext(context)` from `astro:actions` to detect inbound actions.
  - `action.calledFrom === 'rpc'` vs `'form'`.

---

## 5) Data and DB plan (Drizzle + SQLite)

### 5.1 Data directory layout
- `data/`
  - `db.sqlite`
  - `projects/<projectId>/...`

### 5.2 Tables

#### `users`
- `id` (pk)
- `createdAt`
- `passwordHash`

#### `sessions`
- `id` (pk)
- `userId` (fk)
- `tokenHash` (unique)
- `createdAt`
- `expiresAt`

#### `userSettings`
- `userId` (pk/fk)
- `openrouterApiKey`
- `defaultModel`
- `updatedAt`

#### `projects`
- `id` (pk)
- `ownerUserId` (fk)
- `createdAt`
- `deletedAt` (nullable)
- `name`
- `slug` (unique; global uniqueness is fine for v1)
- `prompt`
- `model` (nullable; project override)
- `devPort`
- `opencodePort`
- `status` (`created|starting|running|stopped|error`)
- `pathOnDisk` (relative)

### 5.3 Migrations (Drizzle Kit)
Doc-backed:
- Generate: `drizzle-kit generate`.
- Apply: `drizzle-kit migrate`.

Boot-time migration strategy:
- Run `pnpm drizzle-kit migrate` once per server process start.
- Add a guard to avoid re-entrancy.
- If we ever run multiple host processes, add a simple lock file under `data/`.

---

## 6) Authentication and security

### 6.1 Setup gating
- If `users` table is empty:
  - redirect all routes to `/setup`.

### 6.2 Session model
- DB-backed sessions (not Astro sessions).
- Cookie contains raw session token.
- DB stores hash (`tokenHash`).

Cookie settings:
- `HttpOnly`
- `SameSite=Lax`
- `Secure` in production

### 6.3 Authorization
- Middleware loads user from cookie and sets `context.locals.user`.
- All non-auth pages/actions require auth.

### 6.4 CSRF stance (v1)
- Use RPC actions for mutations.
- Additionally, enforce `Origin` checks in middleware for mutation requests.

---

## 7) Settings (OpenRouter)

### 7.1 Stored settings
- Per-user OpenRouter API key.
- Default model (curated list).

### 7.2 Key validation
Validate on save by calling:
- `GET https://openrouter.ai/api/v1/models` with `Authorization: Bearer <key>`.

### 7.3 Project naming
Doc-backed (OpenRouter): Chat completions request shape.

Use one fast model:
- `google/gemini-2.5-flash`

Implementation details:
- Request: `POST https://openrouter.ai/api/v1/chat/completions`
  - `Authorization: Bearer <OPENROUTER_API_KEY>`
  - `Content-Type: application/json`
- Body:
  - `model`
  - `messages` (system + user prompt)
  - `stream: false`

Optional headers (for rankings/attribution):
- `HTTP-Referer`
- `X-Title`

Fallback if naming fails:
- take first N words from prompt.
- ensure slug uniqueness by suffixing.

---

## 8) Projects: lifecycle + ports + filesystem

### 8.1 Project URLs
- Canonical: `/projects/:id/:slug`.
- Redirect if slug mismatch or if only `:id` provided.

### 8.2 Port allocation
- Allocate 2 ports per project:
  - `devPort` (preview)
  - `opencodePort` (opencode server)

Strategy:
- Use Node `net` to bind port `0` to obtain an available port.
- Persist to DB immediately.
- If Docker bind fails, reallocate and retry.

### 8.3 Template copy
- Copy `templates/astro-starter/` to `data/projects/<id>`.
- Write `.env` (or compose override) with:
  - `DEV_PORT=<devPort>`
  - `OPENCODE_PORT=<opencodePort>`

### 8.4 Delete project
Delete means:
- `docker compose down`.
- Stop log follower.
- Delete `data/projects/<id>` directory.
- Remove DB row (v1: hard-delete).

---

## 9) Docker orchestration (host) — comprehensive spec

This section defines how the host starts/stops project containers, captures errors, and produces logs suitable for the UI terminal.

### 9.1 Compose command discovery (portable)
Some environments use `docker compose`, others use `docker-compose`.

Implementation steps:
- At host startup (or first project operation), detect the compose command:
  - Try `docker compose version`.
  - If it fails, try `docker-compose version`.
- Persist the chosen command in memory (do not re-detect every call).

### 9.2 Compose invocation conventions
To avoid collisions and make behavior deterministic:
- Always execute compose commands with:
  - `cwd = data/projects/<projectId>`
  - explicit project name: `--project-name doce_<projectId>` (prevents collisions when folder names collide)
- Always disable ANSI/color in output (so logs are readable in terminal):
  - pass `--ansi never` when supported (otherwise rely on `--no-color` for logs)

### 9.3 Start/stop/delete commands

**Start (idempotent):**
- Command (preferred): `docker compose --project-name doce_<id> up -d --remove-orphans`
- Behavior:
  - Must be safe to call when already running.
  - Append stdout/stderr to the project docker log file.

**Stop (keep volumes/state):**
- Command: `docker compose --project-name doce_<id> down --remove-orphans`
- Behavior:
  - Preserve project directory.
  - Preserve any named volumes (unless compose file defines them; we don’t remove by default).

**Delete (destructive):**
- Commands:
  - `docker compose --project-name doce_<id> down --remove-orphans --volumes`
  - Then delete `data/projects/<id>` directory.

### 9.4 Log capture strategy (two layers)
We want:
- startup errors visible (from `up`)
- continuous logs visible (from `logs -f`)

**Layer A: one-shot command output**
- Capture output of `up`/`down` and append to `data/projects/<id>/logs/docker.log`.

**Layer B: follower (long-running)**
- Start a follower process:
  - `docker compose --project-name doce_<id> logs -f --no-color --timestamps`
- Append follower output to the same log file.

Follower lifecycle decision (v1): **attach-on-demand**
- Do not keep followers for all projects 24/7.
- Start follower when either:
  - the project page is opened, or
  - `/api/projects/:id/logs` SSE endpoint is subscribed.
- Stop follower when:
  - no terminal clients remain for a grace period (e.g. 30s), or
  - the project is stopped/deleted.

### 9.5 Concurrency + locks
To prevent conflicting operations (double start/stop):
- Maintain an in-memory per-project mutex/lock.
- Disallow concurrent start/stop/delete on the same project.
- Always release lock on error.

### 9.6 Status tracking and health checks

Project status state machine:
- `created` → `starting`
- `starting` → `running` (health checks ok)
- `starting` → `error` (compose up fails)
- `running` → `stopped` (compose down)
- `error` → `starting` (retry)

Health checks (host-side, no Docker API required):
- Preview health:
  - attempt TCP connect / HTTP GET to `http://127.0.0.1:<devPort>`.
- opencode health:
  - attempt HTTP GET to `http://127.0.0.1:<opencodePort>/event` (SSE connect) OR
  - a lightweight SDK call (recommended once SDK client exists).

Retry policy:
- On start, poll health checks for up to N seconds (e.g. 20–30s) before marking `error`.

### 9.7 Container lifecycle policy (run on demand)

Containers must **not** run all the time. They run when a user is actively viewing a project.

#### 9.7.1 Presence model (host is the source of truth)
- The host maintains an in-memory per-project presence record:
  - `viewers: Map<viewerId, lastSeenAt>` (in-memory)
  - `activeViewers: number` (derived from `viewers.size`)
  - `lastSeenAt: number` (derived: max of viewer timestamps)
  - `stopAt?: number` (scheduled stop time, optional)
- Presence is updated by explicit client heartbeats from the project page.
- Presence state is intentionally not persisted; it resets on host restart.

#### 9.7.2 Presence heartbeat API (request/response contract)
Add a lightweight host endpoint:
- `POST /api/projects/:id/presence`

Default constants (define once in host config):
- `presenceHeartbeatMs = 15_000`
- `idleTimeoutMs = 180_000` (3 minutes)
- `reaperIntervalMs = 30_000`
- `stopGraceMs = 30_000` (wait after last viewer disconnect)
- `startMaxWaitMs = 30_000`
- `healthCheckTimeoutMs = 2_000`

**Request body** (JSON):
- `{ "viewerId": string }`

Client behavior (project page):
- On first mount, generate a stable `viewerId` for this tab (store in `sessionStorage`).
- Send heartbeat every 10–15 seconds while the project page is mounted.
- Stop heartbeats on unmount.

Server behavior:
- Authz: require login, verify project ownership.
- Concurrency safety:
  - Acquire the per-project mutex before mutating lifecycle state.
  - If project is being deleted, respond `409` and do not start anything.
- On heartbeat:
  - Set `presence.viewers[viewerId] = now`.
  - Cancel any scheduled stop for this project.
  - Ensure the container is started (see 9.7.3) unless a stop/delete is in progress.

**Response body** (JSON):
- `{ 
    "projectId": string,
    "status": "created"|"starting"|"running"|"stopping"|"stopped"|"error",
    "viewerCount": number,
    "previewUrl": string,
    "previewReady": boolean,
    "opencodeReady": boolean,
    "message": string | null,
    "nextPollMs": number
  }`

Response semantics:
- `previewUrl` is always returned as `http://127.0.0.1:<devPort>`.
- The client must only set the iframe `src` when `previewReady === true`.
- `opencodeReady` indicates the host can start subscribing to `/api/projects/:id/opencode/event`.
- `nextPollMs` is the recommended delay for polling `presence` again while starting.

How readiness flags are computed (implementation spec):
- `previewReady`:
  - Perform an HTTP GET to `previewUrl` with:
    - timeout: `healthCheckTimeoutMs`
    - expected: any HTTP response (200–500) is considered “server is up”; connection refused/timeouts are “not ready”.
  - Rationale: Vite dev server might return non-200 temporarily, but the presence of an HTTP response implies the port is bound.
- `opencodeReady`:
  - Perform an HTTP GET to `http://127.0.0.1:<opencodePort>/doc` with:
    - timeout: `healthCheckTimeoutMs`
    - expected: HTTP 200
  - Alternative: attempt a short-lived SSE connect to `/event` and consider “ready” if the first event (`server.connected`) is received within `healthCheckTimeoutMs`.

Host restart reconciliation (important):
- Presence is in-memory only, so after a host restart DB `status` can be stale.
- On every presence request:
  - compute `previewReady` and `opencodeReady` from real health checks.
  - reconcile the returned `status`:
    - if both ready → return `status: 'running'` (even if DB says stopped)
    - if neither ready and DB says running → return `status: 'stopped'` (and update DB asynchronously)
    - if compose was just triggered → keep `status: 'starting'`
- Avoid aggressive cleanup on host boot (v1):
  - Do not automatically stop all containers on boot.
  - Reconcile on-demand when a project is visited.

Timeout/backoff policy:
- While `status === 'starting'`, set `nextPollMs` dynamically:
  - first 3 polls: 500ms
  - next 10 polls: 1000ms
  - after that: 2000ms
- Stop retrying after `startMaxWaitMs` total time since we entered `starting` and mark `error`.

Message content rules (for UI):
- `message` is a human-readable status line for the preview panel.
- While starting:
  - Prefer: “Starting containers…” then “Waiting for preview…” then “Waiting for opencode…”.
- On error:
  - Set `status='error'` and set `message` to a best-effort extracted line from `data/projects/<id>/logs/docker.log` plus a hint (“Open terminal for details”).

Best-effort extraction algorithm ("tail last relevant docker.log line"):
1) Read the last chunk of the log file:
   - Read last `maxBytes = 64_000` bytes (or entire file if smaller).
   - Split into lines; take the last `maxLines = 200` non-empty lines.
2) Normalize candidate lines:
   - Trim whitespace.
   - Drop very long lines by truncating to ~300 chars.
   - Skip host markers like `^[host .*]` unless no other lines exist.
3) Prefer "strong error" lines by scanning from newest → oldest and picking the first line matching any of:
   - case-insensitive contains: `error`, `failed`, `failure`, `fatal`, `panic`, `cannot`, `permission denied`, `bind`, `address already in use`, `no such file`, `not found`, `exited with code`, `exit code`, `healthcheck`, `unhealthy`.
4) If none found, prefer "useful signal" lines by scanning newest → oldest for:
   - `warning`, `deprecated`, `listening`, `ready`, `started`, `building`, `pulling`, `created`, `recreated`, `restarting`.
5) If still none found:
   - Use the newest non-empty line.
6) Final formatting:
   - If a service prefix exists (e.g. `service-name | ...`), keep it.
   - Ensure output is a single line suitable for UI.
   - Append: ` — Open terminal for details.`

Fallback:
- If the log file doesn’t exist or is empty: `message = "Failed to start. Open terminal for details."`

Notes:
- Single-admin reduces complexity, but multiple tabs are still possible; the `viewerId` map avoids over/under-counting viewers.

#### 9.7.3 Start-on-view
When a project page is opened (or a heartbeat arrives):
- If project is `stopped`/`created`/`error`:
  - set status to `starting`
  - append a host marker line to `docker.log` (“starting via presence heartbeat”)
  - run compose `up -d` (see 9.3)
  - begin health-check polling:
    - preview: GET `previewUrl` (see readiness spec)
    - opencode: GET `/doc` or SSE `/event` (see readiness spec)
  - when both are ready, set status to `running`
  - if compose fails or readiness window expires, set status to `error`
- If already `running`, do nothing.

Implementation detail:
- The presence endpoint should *not* block until ready.
  - It should trigger/ensure start and immediately return current status + readiness flags.
  - The client uses `nextPollMs` polling to transition its UI state.

UI requirement:
- Preview panel shows a loading/skeleton state until health checks succeed.
- Once healthy, set iframe `src` (or reveal iframe) so users don’t see browser connection errors.

#### 9.7.4 Delayed stop (“idle grace period”)
When the user leaves the project page, we should not immediately kill containers.

Policy:
- When the last viewer disappears, schedule a stop at `now + stopGraceMs`.
- If no heartbeat is received before that time, keep the project alive until the full idle timeout.
- If no heartbeat has been received for `idleTimeoutMs`:
  - mark project as `stopping`
  - append a host marker line to `docker.log` (“stopping due to inactivity”)
  - run compose `down --remove-orphans`
  - set status to `stopped`

Implementation detail:
- Maintain `presence.viewers` entries with last-seen times.
- Periodic reaper runs every `reaperIntervalMs`:
  - prune viewerIds that haven’t heartbeated for `2 * presenceHeartbeatMs`.
  - recompute `activeViewers` and `lastSeenAt`.
  - if `activeViewers === 0`:
    - if `stopAt` not set, set it to `now + stopGraceMs`.
    - if `now >= stopAt` and `now - lastSeenAt >= idleTimeoutMs`, stop the project.
- Cancel stop schedule (`stopAt = undefined`) as soon as any heartbeat arrives.

#### 9.7.5 Avoid stopping during active operations (future-safe)
V1 can stop based purely on presence.

Future enhancement:
- If opencode reports an active/running session status, delay stopping even if the UI is gone.

---

## 10) Logs (persistent) + SSE terminal — comprehensive spec

### 10.1 Log files and retention
- Log file path:
  - `data/projects/<id>/logs/docker.log`
- Ensure directory exists on demand.
- V1 retention:
  - no rotation; keep file as-is.
  - When it becomes a problem, add size-based rotation (future).

### 10.2 What gets written to the log
Write both:
- docker compose one-shot outputs (start/stop errors)
- docker compose follower outputs

Recommended format:
- prefix host-injected lines with a marker and timestamp, e.g.
  - `[host 2025-..] docker compose up -d`
  - `[host 2025-..] exit=1`

### 10.3 SSE endpoint contract
Endpoint:
- `GET /api/projects/:id/logs?offset=<byteOffset>`

Response:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

Events:
- Use a single event name, e.g. `event: log.chunk`.
- Payload JSON shape:
  - `{ "projectId": string, "offset": number, "nextOffset": number, "text": string, "truncated": boolean }`

### 10.4 SSE server behavior (reconnect-safe)
- If `offset` is missing:
  - read the last N lines (e.g. 500) and emit as one chunk with `truncated: true`.
  - set `nextOffset` to the end-of-file.
- If `offset` is present:
  - if `offset` > current file size: reset to EOF-last-N-lines behavior.
  - else stream from `offset`.

Streaming loop:
- poll file for growth and emit appended bytes.
- periodically emit heartbeat comments to keep connections alive:
  - `:keep-alive\n\n` every ~15s.

Follower coupling:
- When the first SSE client connects:
  - ensure the log follower is running (start if needed).
- When the last SSE client disconnects:
  - stop follower after a grace period.

### 10.5 Client behavior
- Track `nextOffset` from events.
- On reconnect, call the endpoint with last `nextOffset`.
- If server sends `truncated: true`, client can show a “showing last 500 lines” banner.

---

## 11) opencode integration (host as client to project) — comprehensive spec

This section is **only** about host ↔ project container communication.

### 11.1 Connectivity (client-only)
Doc-backed (opencode SDK):
- Connect to an existing server:
  - `createOpencodeClient({ baseUrl: "http://127.0.0.1:<opencodePort>" })`

Host policy:
- Browser never calls container ports directly.
- The host is always the gateway (authz + normalization + stable API).

### 11.2 Host API routes

**HTTP proxy (debug/escape hatch, secured):**
- `ANY /api/projects/:id/opencode/[...path]`
  - Proxies method + headers + body.
  - Applies auth and ensures the project belongs to the current user.
  - Security restrictions:
    - Allowlist paths by default (recommended): `session/*`, `event`, `doc`, `path`, `config/*`.
    - Reject other paths with `403` unless a host-side `OPENCODE_PROXY_ALLOW_ALL=true` flag is enabled.
    - Strip hop-by-hop headers: `connection`, `keep-alive`, `proxy-authenticate`, `proxy-authorization`, `te`, `trailer`, `transfer-encoding`, `upgrade`.
    - Strip `set-cookie` from upstream responses.
    - Enforce body size limit (e.g. 1–5MB) to avoid memory abuse.
    - Enforce request timeout (e.g. 30s) and stream timeout for long-lived requests.
  - Logging:
    - Log method + path + status with pino at debug level.

**Normalized event stream:**
- `GET /api/projects/:id/opencode/event`
  - Host connects server-to-server to `GET http://127.0.0.1:<opencodePort>/event`.
  - Parses SSE, extracts JSON data, normalizes, re-emits as SSE.

### 11.3 SDK usage (host server-side)
Doc-backed (`@opencode-ai/sdk`): session API surface includes:
- `client.session.create()`
- `client.session.list()`
- `client.session.messages(id)`
- `client.session.chat(id, params)`

Host strategy:
- Use SDK for “request/response” operations.
- Use streaming fetch for `/event` (SDKs often expose list endpoints, but we normalize the real-time stream ourselves).

### 11.4 SSE parsing details (opencode → host)
Doc-backed (opencode server): `/event` is SSE and starts with `server.connected`.

Implementation steps:
- Open a fetch to `/event`.
- Parse SSE lines:
  - accumulate `data:` lines until a blank line, then parse JSON.
  - ignore non-`data:` fields unless needed.
- Handle `AbortSignal` when the browser disconnects.

### 11.5 Normalized event schema (host → UI)
The host emits a stable schema regardless of opencode internal event shapes.

**Envelope**
- `type`: string
- `projectId`: string
- `sessionId?`: string
- `time`: ISO string
- `payload`: object

**Core types (minimum)**
- `chat.session.status`
  - payload: `{ status: string, cost?: number }`
- `chat.message.delta`
  - payload: `{ messageId: string, role: 'assistant'|'user', deltaText: string }`
- `chat.message.final`
  - payload: `{ messageId: string }`
- `chat.tool.start`
  - payload: `{ toolCallId: string, name: string, input: unknown }`
- `chat.tool.finish`
  - payload: `{ toolCallId: string, output: unknown }`
- `chat.tool.error`
  - payload: `{ toolCallId: string, error: unknown }`
- `chat.file.changed`
  - payload: `{ path: string }`

**Normalization mapping (doc-backed event examples)**
From opencode docs, event types we expect include:
- `session.updated`
  - map to `chat.session.status` using `properties.info.status` and `properties.info.cost` when present.
- `message.part.updated`
  - if `properties.part.type === 'text'`, map to `chat.message.delta` with `deltaText = properties.part.text`.
- `tool.execute`
  - map to `chat.tool.start` with `name = properties.name`, `input = properties.input`.
- `tool.result`
  - map to `chat.tool.finish` (or `.error` when output indicates failure) with `output = properties.output`.
- `file.edited`
  - map to `chat.file.changed` with `path = properties.file`.

Unknown / future events:
- Do not drop unknown events silently.
- Emit `chat.event.unknown` with payload:
  - `{ upstreamEventType, upstreamData }`
- UI can ignore it by default, but it preserves debuggability and forward-compat.

**Correlation rules (implementation detail)**
- Maintain a per-SSE-connection normalization state:
  - `currentAssistantMessageId` (created on first `message.part.updated` after a user prompt)
  - `toolCallCounter` (monotonic integer)
  - `activeToolCalls` map keyed by best-available identifiers; fallback to `toolCallCounter`.
- If opencode events include stable ids, prefer them; otherwise generate deterministic ids per stream order.

**Host SSE output details**
- Response headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- Emit one event type, e.g. `event: chat.event`, with `data: <json>`.
- Emit heartbeats `:keep-alive\n\n`.

---

## 12) UI plan (Astro pages + React components + shadcn)

### 12.1 Pages
- `/setup`
- `/login`
- `/settings`
- `/` (dashboard)
- `/projects/:id/:slug`

### 12.2 Project page layout
- Left: chat UI
- Right: preview panel (loading → iframe) + URL + open icon
- Bottom: terminal dock (collapsible)

Preview loading behavior:
- On page mount:
  - Call `POST /api/projects/:id/presence`.
  - Start the heartbeat timer (10–15s).

Client preview state machine (recommended):
- `initializing`:
  - call presence once.
  - if `status === 'running' && previewReady === true`, transition to `ready`.
  - if `status === 'starting' || status === 'created' || status === 'stopped'`, transition to `starting`.
  - if `status === 'error'`, transition to `error`.
- `starting`:
  - render skeleton/loader + status text.
  - poll `POST /api/projects/:id/presence` every `nextPollMs` until:
    - `previewReady === true` → transition to `ready`.
    - `status === 'error'` → transition to `error`.
- `ready`:
  - set/reveal iframe `src = previewUrl`.
  - keep heartbeat running.
- `error`:
  - show error state with a retry button.
  - retry calls presence (which may re-trigger start).

### 12.3 shadcn component usage
- Prefer shadcn primitives for:
  - buttons, inputs, dialogs, cards, tabs, dropdowns
- Keep theme in CSS variables.

---

## 13) Host API surface (implementation spec)

### 13.1 Actions (Astro Actions)
All actions exported from `src/actions/index.ts`.

Auth/setup:
- `server.setup.createAdmin({ password, openrouterApiKey, defaultModel })`
- `server.auth.login({ password })`
- `server.auth.logout()`

Settings:
- `server.settings.save({ openrouterApiKey, defaultModel })`

Projects:
- `server.projects.create({ prompt, model? })`
- `server.projects.start({ projectId })` (manual start; mostly used internally)
- `server.projects.stop({ projectId })` (manual stop)
- `server.projects.delete({ projectId })`
- `server.projects.updateModel({ projectId, model })`
- `server.projects.presenceHeartbeat({ projectId })` (run-on-demand lifecycle)

### 13.2 API routes (Astro endpoints)
- `POST /api/projects/:id/presence` (presence heartbeat; ensures started; returns `{ status, previewUrl, previewReady, opencodeReady, nextPollMs }`)
- `GET /api/projects/:id/logs` (SSE)
- `ANY /api/projects/:id/opencode/[...path]` (proxy)
- `GET /api/projects/:id/opencode/event` (normalized SSE)

---

## 14) Project template (only template details)

### 14.1 Template folder
- `templates/astro-starter/` copied per project.

### 14.2 Template contract requirements
Template must:
- support `docker compose up -d` with no manual steps.
- expose preview on `DEV_PORT`.
- expose opencode API on `OPENCODE_PORT`.
- persist opencode sessions within the project container filesystem/volume.

---

## 15) Validation / smoke checks

M0:
- Fresh install redirects to `/setup`.
- Setup creates admin and redirects.
- Login/logout works.
- Settings save validates OpenRouter key.

M1:
- Create project copies template.
- Compose start works.
- Dashboard shows status.

M2:
- Host connects to opencode via SDK.
- Host normalized SSE renders chat/tool lifecycle.

M3:
- Logs SSE works with reconnect offsets.
- Preview iframe loads.

---

## 16) Remaining open questions (implementation-time)

- Pick a Node baseline and encode it (so Dockerfile + local dev agree).
- Confirm which Tailwind v4 wiring Astro generates for the chosen Astro version (CLI vs manual). We follow Astro’s supported route.
- Log follower lifecycle is attach-on-demand (start on terminal/SSE connect, stop after last disconnect).
