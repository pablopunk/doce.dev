# AGENTS.md — doce.dev

This file guides agentic coders working in this repo. Follow these conventions to keep changes safe, consistent, and easy to review.

## Overview
- App: Self‑hosted AI website builder (Astro + React islands + Tailwind + TypeScript).
- Server: Astro 5 with Node adapter (standalone server output).
- Data: SQLite (better‑sqlite3) at `./data/doceapp.db` by default.
- AI: Uses `ai` SDK with OpenAI, Anthropic, or OpenRouter providers.
- Orchestration: Docker containers for previews/deployments; assumes a Traefik reverse proxy on network `doce-network`.

## Run Locally
Prereqs: Node 20+, Docker (for preview/deploy), Git.

- Install deps: `npm install`
- Dev server: `npm run dev` (defaults to http://localhost:4321)
- Build: `npm run build`
- Preview build: `npm run preview`

Environment tips (local friendly):
- Ensure database directory exists: `mkdir -p data`
- Optional: store generated projects locally: `PROJECTS_DIR=./projects npm run dev`
- Optional: override DB path: `DATABASE_PATH=./data/doceapp.db npm run dev`

## First‑Time Setup Flow
Middleware gates everything behind `/setup` until done.
1) Start dev server and open `/setup`.
2) Create admin user (stored in SQLite).
3) Choose AI provider and key (writes to DB and tries to append `.env.local`).
4) Complete setup; middleware allows access to app.

Environment variables used:
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`
- `DATABASE_PATH` (default `./data/doceapp.db`)
- `PROJECTS_DIR` (default `/app/projects` → override to `./projects` locally)
- `DOCKER_HOST` (dockerode socket, default `/var/run/docker.sock`)

Note: `.env`, `.env.local` are git‑ignored.

## Repository Layout
- App config: `astro.config.mjs`, `tailwind.config.cjs`, `postcss.config.cjs`, `tsconfig.json`
- Global styles: `src/styles/global.css` (Tailwind v4 + CSS variables)
- Middleware: `src/middleware.ts` (setup gate)
- Pages: `src/pages/**/*.astro`, API routes under `src/pages/api/**`
- Components: `src/components/**` and UI primitives in `src/components/ui/**`
- Server libs: `src/lib/db.ts`, `src/lib/docker.ts`, `src/lib/file-system.ts`, `src/lib/code-generator.tsx`, `src/lib/template-generator.tsx`, `src/lib/utils.ts`

## Data & Files
- SQLite is initialized on import in `src/lib/db.ts`. Tables: `config`, `users`, `projects`, `conversations`, `messages`, `files`, `deployments`.
- Use exported DB helpers (e.g., `createProject`, `saveFile`, `getDeployments`) instead of raw SQL in routes.
- Project files are mirrored:
  - Database: `files` table
  - Filesystem: under `PROJECTS_DIR` via `src/lib/file-system.ts`
- Always use `writeProjectFiles`, `listProjectFiles`, etc. Do not write to the filesystem directly.

## API Routes (key ones)
- `POST /api/setup/user` — create initial admin.
- `POST /api/setup/ai` — save provider+key; appends `.env.local` when possible.
- `POST /api/setup/complete` — mark setup finished.
- `GET /api/stats` — usage metrics and docker count.
- `GET|POST /api/projects` — list/create projects.
- `GET|DELETE /api/projects/[id]` — fetch/delete project (also cleans containers/files).
- `GET|POST /api/projects/[id]/deploy` — list deployments / create a deployment container.
- `GET|POST|DELETE /api/projects/[id]/preview` — manage preview container.
- `GET /api/projects/[id]/files` — list known files from DB + FS.
- `POST /api/projects/[id]/generate` — seed a minimal Astro project for the ID.
- `POST /api/chat/[projectId]` — streams assistant text; on finish, parses code blocks and writes files.

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
- `src/lib/docker.ts` builds images per project, then runs containers exposing port `3000`.
- Containers are labeled for Traefik and joined to network `doce-network`.
- The app returns path‑prefixed URLs (`/preview/{projectId}`, `/site/{deploymentId}`) that assume an external Traefik reverse proxy rewrites to the container.
- Local dev without Traefik: preview/deploy may not work out‑of‑the‑box despite port bindings. Focus on file generation and DB persistence, or provide your own proxy.

## Coding Guidelines
- Language & modules: TypeScript + ES modules. Use the `@/*` alias (see `astro.config.mjs`, `tsconfig.json`).
- Keep changes minimal and cohesive: do not refactor unrelated code.
- Prefer server helpers (`db.ts`, `file-system.ts`, `docker.ts`) over ad‑hoc logic.
- API routes: export `const GET/POST/DELETE: APIRoute` from files in `src/pages/api/**`.
- Avoid schema changes unless required; if you must, update `db.ts` and keep migrations simple.
- Do not hardcode secrets. Read from env or the `config` table.
- Respect middleware: routes under `/setup` must work before setup is complete; others can assume setup.

## Linting & Formatting
- Lint: `npm run lint` (if an ESLint config exists). No repo‑defined formatter; follow existing style.
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
- Setup loop: ensure a user exists and at least one AI key is provided (env or config); `isSetupComplete()` checks both.
- DB errors on first run: create `data/` directory or set `DATABASE_PATH` to a valid file location.
- Preview/deploy not reachable: verify Docker is running, Traefik is configured on `doce-network`, and container labels look correct.

Scope: This file applies to the entire repository. Prefer these conventions over ad‑hoc patterns; when in doubt, ask before making broad changes.
