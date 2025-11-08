# AGENTS.md — doce.dev

## Overview
Self‑hosted AI website builder: Astro 5 + React islands + Tailwind v4 + TypeScript + SQLite + Docker.

**Stack**: Astro (Node adapter) • better‑sqlite3 (`./data/doceapp.db`) • `ai` SDK with OpenRouter • Docker + Traefik (optional for local dev)

## Run Locally
```bash
pnpm install       # Use pnpm, not npm
pnpm run dev       # http://localhost:4321
pnpm run build
```

**Environment**: `DATABASE_PATH` (default `./data/doceapp.db`) • `PROJECTS_DIR` (default `./data/projects/`) • `DOCKER_HOST` (default `/var/run/docker.sock`)

## Setup Flow
Navigate to `/setup` → create admin user → configure AI provider. **API keys are stored in DB `config` table**, not env vars.

## Key Files
- **Libs**: `src/lib/{db,docker,file-system,code-generator,migrations}.ts`
- **API**: `src/pages/api/**` • **UI**: `src/components/ui/**` (shadcn-style Radix primitives)
- **Middleware**: `src/middleware.ts` (gates `/setup`)

## Data & Files
**DB**: Tables: `config`, `users`, `projects`, `conversations`, `messages`, `files`, `deployments`. Migrations auto-run on startup.
**Files**: Mirrored in DB (`files` table) and filesystem (`PROJECTS_DIR`). Always use `writeProjectFiles` / `listProjectFiles` — never direct FS access.

## API Routes
**Setup**: `/api/setup/{user,ai,complete}` • **Projects**: `/api/projects` (GET/POST) • `/api/projects/[id]` (GET/DELETE)
**Build**: `/api/projects/[id]/{preview,deploy,files,generate}` • **Chat**: `/api/chat/[projectId]` (streams, parses code blocks, writes files)

## Code Generation (critical)
Use fenced blocks with `file="path"`:
```tsx file="src/components/Widget.tsx"
export function Widget() { return <div /> }
```
**Stack**: Astro 5 + React islands + Tailwind v4 + TypeScript. Use `client:load` directives. Parser tries JSON `{ files: [...] }` first, then extracts fenced blocks.

## Docker
**Preview**: Random ports (10000-20000) → container :3000. Name: `doce-preview-{projectId}`. **Docker is source of truth** — DB `preview_url` is cache.
**Deploy**: Production images on :3000, labeled for Traefik + `doce-network`. Local dev uses direct ports.

## Guidelines
- **TypeScript + ES modules**. Use `@/*` alias. Keep changes minimal.
- **Use helpers**: `db.ts`, `file-system.ts`, `docker.ts`, `migrations.ts` — no ad-hoc logic.
- **Schema changes**: Add to `src/lib/migrations.ts` (auto-run on startup).
- **Secrets**: Read from env or DB `config` table. Never hardcode.
- **No commits**: `.env*`, `data/`, `projects/` (git-ignored).

## Troubleshooting
- **Setup loop**: Check user + AI key in DB. **API key error**: Run `/setup`.
- **Preview not reachable**: Verify Docker running, check `docker ps | grep doce-preview`.
- **Port conflicts**: App uses :4321, previews use :10000-20000.

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
