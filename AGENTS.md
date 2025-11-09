# AGENTS.md — doce.dev

## Overview
Self‑hosted AI website builder: Astro 5 + React islands + Tailwind v4 + TypeScript + SQLite + Docker.

**Stack**: Astro (Node adapter) • better‑sqlite3 (`./data/doceapp.db`) • `ai` SDK with OpenRouter • Docker

**Run**: `pnpm install && pnpm run dev` → http://localhost:4321

**Environment**: `DATABASE_PATH` (default `./data/doceapp.db`) • `PROJECTS_DIR` (default `./data/projects/`) • `DOCKER_HOST` (default `/var/run/docker.sock`)

**Setup**: `/setup` → create admin user → configure AI provider (keys in DB, not env vars)

## 🎨 Design System

**Pure B&W**: Monochromatic design with inverted light/dark modes. Light/Dark/System toggle in TopNav (localStorage + system preference).

**Color Tokens** (HSL S=0%):
- Neutrals: `--bg-base`, `--bg-surface`, `--bg-raised`, `--text-strong`, `--text-muted`, `--border`, `--border-strong`
- Primary: White (#fcfcfc) in dark, black (#050505) in light
- Semantic (OKLCH): `--success`, `--warning`, `--danger` (alerts only)
- Shadows: `--shadow-1` (short/dark) + `--shadow-2` (long/light)

**Dark Mode** (default): Base 3%L → Surface 5%L → Raised 8%L | Text 98%L | Borders 15%L/25%L
**Light Mode** (inverse): Base 97%L → Surface 95%L → Raised 92%L | Text 2%L | Borders 85%L/75%L

**Elements**: 2px borders, no rounded corners (except specified), scale-on-press buttons, shadow-on-hover cards

**Tailwind**: `bg-base`, `bg-surface`, `bg-raised`, `text-strong`, `text-muted`, `border-strong`, `shadow-elevation`

**Theme Hook**: `src/hooks/use-theme.ts`

## 🏗️ Architecture (Clean Architecture + DDD)

**Flow**: API Route → Facade → Use Case → Domain Service → Repository → Infrastructure

**Layers**: API (thin routes) → Application (use cases, facades) → Domain (pure business logic) → Infrastructure (SQLite, Docker, FS, AI) → Shared (errors, types, config)

**Structure**:
```
domains/{domain}/domain/      → models/, repositories/ (interfaces), services/
domains/{domain}/application/ → use-cases/
infrastructure/               → database/sqlite/, container-orchestration/, file-system/, ai-providers/
application/facades/          → temp adapters (migration in progress)
shared/                       → kernel/, logging/, config/
```

**Migration**: ✅ Projects domain + 8 routes | 🔄 Conversations, files, deployments | ⏳ Docker/FS/AI to infrastructure

**Frontend**: `layouts/` (BaseLayout.astro) → `pages/` (.astro routes + api/) → `components/` (.tsx React + ui/ shadcn)

## 💡 Adding a New Feature

**Flow**: Domain Model → Repository Interface (domain) → Use Case (application) → Repository Impl (infrastructure) → Facade (temp) → API Route → UI Page → React Component

**1. Domain**: `domains/my-feature/domain/models/` - Aggregate root extending `AggregateRoot<Props>`
**2. Repo Interface**: `domains/my-feature/domain/repositories/` - `IMyEntityRepository` interface
**3. Use Case**: `domains/my-feature/application/use-cases/` - Orchestrates domain + repo
**4. Repo Impl**: `infrastructure/database/sqlite/repositories/` - Implements interface with `getDatabase()`
**5. Facade**: `application/facades/` - Instantiates repo + use case (temp during migration)
**6. API**: `pages/api/my-endpoint.ts` - Import facade, call methods
**7. Page**: `pages/my-page.astro` - Use `BaseLayout`, import React component with `client:load`
**8. Component**: `components/my-component.tsx` - React with `"use client"`, shadcn/ui imports

## Rules

**DO**: Keep domain pure • Small functions (<20 lines) • Proper error types • Type-safe • Use BaseLayout • React components for UI • Astro islands with `client:load`

**DON'T**: Infrastructure in domain • Business logic in routes • Direct DB access from routes • `innerHTML` or string DOM manipulation • Duplicate HTML • Full pages in `.astro` without layouts

## Data & Files

**DB**: Tables `config`, `users`, `projects`, `conversations`, `messages`, `files`, `deployments` • Repositories (new) or `db.ts` (legacy) • Migrations auto-run on first connection (NOT build)

**Config**: `ai_provider`, `{provider}_api_key`, `default_ai_model`, `setup_complete`

**Files**: Mirrored in DB + FS • Use `writeProjectFiles`/`listProjectFiles` (`src/lib/file-system.ts`)

**Docker**: Preview `doce-preview-{projectId}` on ports 10000-20000 • Docker is source of truth, DB `preview_url` is cache

**AI Models**: `src/shared/config/ai-models.ts` (7 models) • `DEFAULT_AI_MODEL`, `AVAILABLE_AI_MODELS`, `getModelById()`, `isValidModel()` • Provider icons in `src/components/ui/svgs/` (SVGL via shadcn)

**Code Gen**: Fenced blocks with `file="path"` • Parser tries JSON first, then extracts blocks

## Debugging

**DB**: `sqlite3 ./data/doceapp.db "SELECT id, name, preview_url FROM projects;"`
**Docker**: `docker ps --filter "name=doce-preview"` • `docker logs doce-preview-{id} --tail 50`
**API**: `curl -s http://localhost:4321/api/projects/{id} | jq`

**Issues**: Preview → check `preview_url` • Build → check imports • Types → domain only imports `@/shared/kernel/`

## Guidelines

- Use **pnpm** • Run `pnpm build` frequently
- Schema → `src/lib/migrations.ts` • Test APIs with curl first
- Docker first for preview debugging
- New models → `src/shared/config/ai-models.ts`
- Icons → `pnpm dlx shadcn@latest add @svgl/{icon-name}`

---

**Scope**: Architecture for entire repo. New features follow Clean Architecture. Legacy migrating.
