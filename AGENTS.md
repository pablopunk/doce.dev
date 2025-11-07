# AGENTS.md — doce.dev

This file guides agentic coders working in this repo. Follow these conventions to keep changes safe, consistent, and easy to review.

## Overview
- App: Self‑hosted AI website builder (Astro + React islands + Tailwind + TypeScript).
- Server: Astro 5 with Node adapter (standalone server output).
- Data: SQLite (better‑sqlite3) at `./data/doceapp.db` by default.
- AI: Uses `ai` SDK with OpenRouter as primary provider (routes to OpenAI, Anthropic, Google, Meta, etc.).
- Orchestration: Docker containers for previews/deployments; assumes a Traefik reverse proxy on network `doce-network`.

## Run Locally
Prereqs: Node 20+, Docker (for preview/deploy), Git, pnpm.

- Install deps: `pnpm install` (use pnpm, not npm)
- Dev server: `pnpm run dev` (defaults to http://localhost:4321)
- Build: `pnpm run build`
- Preview build: `pnpm run preview`

Environment tips (local friendly):
- Ensure database directory exists: `mkdir -p data`
- Projects stored at: `./data/projects/{projectId}/` by default
- Optional: override DB path: `DATABASE_PATH=./custom/path.db pnpm run dev`
- Optional: override projects dir: `PROJECTS_DIR=./custom/projects pnpm run dev`

## First‑Time Setup Flow
Middleware gates everything behind `/setup` until done.
1) Start dev server and open `/setup`.
2) Create admin user (stored in SQLite).
3) Choose AI provider and key (writes to DB `config` table only - NOT to environment variables).
4) Complete setup; middleware allows access to app.

AI provider setup:
- Keys are stored ONLY in the database `config` table
- DB config keys: `ai_provider` (e.g., "openrouter"), `{provider}_api_key` (e.g., "openrouter_api_key")
- The app reads API keys from the database at runtime
- No `.env` or `.env.local` files are needed for API keys

Environment variables used:
- `DATABASE_PATH` (default `./data/doceapp.db`)
- `PROJECTS_DIR` (default `./data/projects/` for local dev, `/app/projects` for production)
- `DOCKER_HOST` (dockerode socket, default `/var/run/docker.sock`)

**Note on API Keys**: API keys are stored in the database `config` table, NOT in environment variables. They are configured during the `/setup` flow and written to the DB.

## Repository Layout
- App config: `astro.config.mjs`, `tailwind.config.cjs`, `postcss.config.cjs`, `tsconfig.json`
- Global styles: `src/styles/global.css` (Tailwind v4 + CSS variables)
- Middleware: `src/middleware.ts` (setup gate)
- Pages: `src/pages/**/*.astro`, API routes under `src/pages/api/**`
- Components: `src/components/**` and UI primitives in `src/components/ui/**`
- Server libs: `src/lib/db.ts`, `src/lib/docker.ts`, `src/lib/file-system.ts`, `src/lib/code-generator.tsx`, `src/lib/template-generator.tsx`, `src/lib/migrations.ts`, `src/lib/cleanup.ts`, `src/lib/utils.ts`
- Templates: `templates/astro/` — base Astro project template

## Data & Files
- SQLite is initialized on import in `src/lib/db.ts`. Tables: `config`, `users`, `projects`, `conversations`, `messages`, `files`, `deployments`.
- Migrations run automatically via `src/lib/migrations.ts` on startup to update existing databases.
- Key conversation fields: `id`, `project_id`, `model` (default: `openai/gpt-4.1-mini`), `created_at`, `updated_at`.
- Use exported DB helpers (e.g., `createProject`, `saveFile`, `getDeployments`, `createConversation`, `updateConversationModel`) instead of raw SQL in routes.
- Project files are mirrored:
  - Database: `files` table
  - Filesystem: under `PROJECTS_DIR` via `src/lib/file-system.ts` (default: `./data/projects/`)
- Always use `writeProjectFiles`, `listProjectFiles`, etc. Do not write to the filesystem directly.

## API Routes (key ones)
- `POST /api/setup/user` — create initial admin.
- `POST /api/setup/ai` — save provider+key; appends `.env.local` when possible.
- `POST /api/setup/complete` — mark setup finished.
- `GET /api/stats` — usage metrics and docker count.
- `GET|POST /api/projects` — list/create projects (POST accepts `prompt` for AI-generated project).
- `GET|DELETE /api/projects/[id]` — fetch/delete project (also cleans containers/files).
- `GET|POST /api/projects/[id]/deploy` — list deployments / create a deployment container.
- `GET|POST|DELETE /api/projects/[id]/preview` — manage preview container (GET auto-syncs DB with Docker state).
- `GET /api/projects/[id]/files` — list known files from DB + FS.
- `POST /api/projects/[id]/generate` — seed a minimal Astro project for the ID.
- `POST /api/chat/[projectId]` — streams assistant text; accepts `messages` and `model`; on finish, parses code blocks and writes files.
- `GET /api/chat/[projectId]/history` — returns chat messages and selected model for a project.

## Code Generation Rules (very important)
The chat endpoint expects responses that it can parse and write to disk. When generating code via the assistant:
- Use fenced code blocks with a file path in the info string header.
- Example:
  ```tsx file="src/components/MyWidget.tsx"
  export function MyWidget() {
    return <div />
  }
  ```
- Always include the `file` attribute (full relative path). Generate all required files for a working feature.
- Target the stack: Astro 5 + React islands + Tailwind v4 + TypeScript. Do not reference Next.js.
- Prefer client directives on islands (`client:load`, etc.) when needed.

Parser notes:
- `src/lib/code-generator.tsx` first tries JSON shape `{ files: [{ path, content }], explanation? }`.
- If not JSON, it extracts fenced blocks with optional `file="..."` and writes them.

## UI Conventions
- Use primitives in `src/components/ui/*` (Radix‑based shadcn‑style components).
- Compose class names with `cn` from `src/lib/utils.ts` when needed.
- Styling with Tailwind v4 utilities; keep styles inlined or in `src/styles/global.css`.
- React 19; keep components functional and typed.

## Docker, Preview & Deploy
- **Preview Containers**: Use docker-compose with random host ports (10000-20000) mapping to container port 3000.
  - Main dev server runs on port 4321 (don't conflict with it)
  - Each project gets `docker-compose.yml` + `docker-compose.override.yml` (with port/labels)
  - Container name: `doce-preview-{projectId}`
  - URL stored in DB: `http://localhost:{randomPort}` for local dev
- **Docker as Source of Truth**: Database `preview_url` is a cache. Always check actual Docker state via `getPreviewState()` before trusting DB.
- **Deployment Containers**: Built images, production-ready, exposed on port 3000.
- Containers are labeled for Traefik and joined to network `doce-network` (for production with reverse proxy).
- Local dev without Traefik: Use direct port access (`http://localhost:{port}`). Traefik is optional for local development.

## Coding Guidelines
- Language & modules: TypeScript + ES modules. Use the `@/*` alias (see `astro.config.mjs`, `tsconfig.json`).
- Keep changes minimal and cohesive: do not refactor unrelated code.
- Prefer server helpers (`db.ts`, `file-system.ts`, `docker.ts`, `migrations.ts`) over ad‑hoc logic.
- API routes: export `const GET/POST/DELETE: APIRoute` from files in `src/pages/api/**`.
- Schema changes: Add migrations to `src/lib/migrations.ts` instead of manually altering tables. Migrations run automatically on startup.
- Do not hardcode secrets. Read from env or the `config` table.
- Respect middleware: routes under `/setup` must work before setup is complete; others can assume setup.

## Linting & Formatting
- Lint: `pnpm run lint` (if an ESLint config exists). No repo‑defined formatter; follow existing style.
- Keep imports sorted logically; avoid unused imports.

## Common Tasks
- Create a new UI piece: add under `src/components/` and reuse `src/components/ui/*` primitives.
- Add an API route: place under `src/pages/api/...`, import helpers from `@/lib/*`.
- Generate starter code for a project: call `POST /api/projects/[id]/generate`.
- Trigger preview/deploy from UI: see `src/components/code-preview.tsx` for expected API calls.

## Safety & Secrets
- Do not commit `.env*`, database files under `data/`, or generated projects under `projects/` — already git‑ignored.
- Be cautious with filesystem paths; never allow user‑controlled traversal outside `PROJECTS_DIR`.
- Container cleanup: use `POST /api/admin/cleanup` or `cleanupOldContainers()`; avoid manual docker CLI in code.

## Troubleshooting
- Setup loop: ensure a user exists and at least one AI key is stored in DB config; `isSetupComplete()` checks both.
- DB errors on first run: create `data/` directory or set `DATABASE_PATH` to a valid file location.
- Preview/deploy not reachable: verify Docker is running, Traefik is configured on `doce-network`, and container labels look correct.
- Port conflicts: Main app uses 4321. Preview containers use random ports (10000-20000) mapping to internal port 3000.
- "No cookie auth credentials found" error: API key not found in database. Run `/setup` to configure API keys. Check DB with: `sqlite3 ./data/doceapp.db "SELECT * FROM config WHERE key LIKE '%_api_key';"`

## Debugging Strategies & Tools

### Database Inspection
Use `sqlite3` CLI for quick queries:
```bash
# Check projects
sqlite3 ./data/doceapp.db "SELECT id, name, preview_url FROM projects;"

# Check conversations and models
sqlite3 ./data/doceapp.db "SELECT project_id, model FROM conversations;"

# Update values directly
sqlite3 ./data/doceapp.db "UPDATE projects SET preview_url = NULL WHERE id = 'xxx';"

# Check table schema
sqlite3 ./data/doceapp.db ".schema projects"
```

### Docker Inspection
```bash
# List preview containers with ports
docker ps --filter "name=doce-preview" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check container logs
docker logs doce-preview-{projectId} --tail 50

# Inspect container details
docker inspect doce-preview-{projectId}

# Stop and remove container
docker stop doce-preview-{projectId} && docker rm doce-preview-{projectId}

# Clean up all stopped containers
docker container prune -f
```

### API Testing
Use `curl` with `jq` for formatted JSON:
```bash
# Check preview status
curl -s http://localhost:4321/api/projects/{id}/preview | jq

# Create preview
curl -X POST http://localhost:4321/api/projects/{id}/preview | jq

# Get project details
curl -s http://localhost:4321/api/projects/{id} | jq

# Test chat endpoint
curl -X POST http://localhost:4321/api/chat/{projectId} \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"model":"openai/gpt-4.1-mini"}'
```

### File System Checks
```bash
# Check generated project files
ls -la ./data/projects/{projectId}/

# View docker-compose override
cat ./data/projects/{projectId}/docker-compose.override.yml

# Check if files were written
find ./data/projects/{projectId} -name "*.tsx" -o -name "*.astro"
```

### Development Best Practices
- **Always use pnpm** for package management (not npm)
- **Check Docker state first** when debugging preview issues (it's the source of truth)
- **Use sqlite3 CLI** for quick DB fixes instead of writing migration scripts
- **Test API endpoints with curl** before changing frontend code
- **Check container logs** when preview doesn't load
- **Verify port availability** if preview creation fails (ports 10000-20000)
- **Clean stale containers** regularly with `docker ps -a` and `docker rm`

### Common Debug Workflows

**Preview not loading:**
1. Check if container is running: `docker ps | grep doce-preview`
2. Check container logs: `docker logs doce-preview-{id}`
3. Verify port in DB matches Docker: `sqlite3` + `docker inspect`
4. Test direct port access: `curl http://localhost:{port}`

**Database out of sync:**
1. Query DB: `sqlite3 ./data/doceapp.db "SELECT * FROM projects WHERE id='xxx';"`
2. Check Docker: `docker ps` and `docker inspect`
3. Use GET preview endpoint - it auto-syncs DB with Docker state
4. Or manually fix: `UPDATE projects SET preview_url = NULL`

**Model not working:**
1. Check conversation: `sqlite3 ./data/doceapp.db "SELECT model FROM conversations WHERE project_id='xxx';"`
2. Check API key in DB: `sqlite3 ./data/doceapp.db "SELECT key, length(value) as key_length FROM config WHERE key LIKE '%_api_key';"`
3. Verify provider is set: `sqlite3 ./data/doceapp.db "SELECT value FROM config WHERE key='ai_provider';"`
4. Check chat endpoint logs in terminal
5. Test model directly with curl
6. If key is missing, reconfigure at `/setup`

Scope: This file applies to the entire repository. Prefer these conventions over ad‑hoc patterns; when in doubt, ask before making broad changes.
