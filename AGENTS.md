# AGENTS.md — doce.dev

## Overview
Self‑hosted AI website builder: Astro 5 + React islands + Tailwind v4 + TypeScript + SQLite + Docker.

**Stack**: Astro (Node adapter) • better‑sqlite3 (`./data/doceapp.db`) • `ai` SDK with OpenRouter • Docker

**Run**: `pnpm install && pnpm run dev` → http://localhost:4321

**Environment**: `DATABASE_PATH` (default `./data/doceapp.db`) • `PROJECTS_DIR` (default `./data/projects/`) • `DOCKER_HOST` (default `/var/run/docker.sock`)

**Setup**: `/setup` → create admin user → configure AI provider (keys in DB, not env vars)

## 🎨 Design System

**Pure B&W**: Monochromatic design with inverted light/dark modes. Light/Dark/System toggle in TopNav (localStorage + system preference).

**Semantic Layer System** (always gets lighter as you add elevation):

**Background Layers** (back to front):
- `--bg-base` / `bg-base` → Page background (3%L dark / 97%L light)
- `--bg-surface` / `bg-surface` → Cards, panels (5%L dark / 95%L light)
- `--bg-raised` / `bg-raised` → Popovers, inputs, elevated UI (8%L dark / 92%L light)

**Interactive States**:
- `--bg-hover` / `bg-hover` → Hover on interactive elements (12%L dark / 88%L light)
- `--bg-active` / `bg-active` → Pressed state (10%L dark / 90%L light)

**CTA/Primary Actions**:
- `--bg-cta` / `bg-cta` → Primary buttons (18%L dark / 98%L light)
- `--bg-cta-hover` / `bg-cta-hover` → CTA hover (22%L dark / 95%L light)

**Text Hierarchy**:
- `--text-primary` / `text-primary` → Body text, headings (98%L dark / 2%L light)
- `--text-secondary` / `text-secondary` → Less important text (65%L dark / 35%L light)
- `--text-tertiary` / `text-tertiary` → Even lighter (45%L dark / 55%L light)
- `--text-disabled` / `text-disabled` → Disabled state (30%L dark / 70%L light)

**Borders**:
- `--border-subtle` / `border-subtle` → Faint dividers (15%L dark / 85%L light)
- `--border-default` / `border-default` → Standard borders (25%L dark / 75%L light)
- `--border-focus` / `border-focus` → Focus rings (98%L dark / 2%L light)

**Overlays**:
- `--overlay` / `overlay` → Modal backdrops (rgba(0,0,0,0.5) both themes)

**Semantic Colors** (OKLCH, alerts only):
- `--success`, `--warning`, `--danger` (same in both themes)

**Elements**: 2px borders, no rounded corners (except specified), scale-on-press buttons, shadow-on-hover cards

**IMPORTANT**: NO `dark:` classes allowed. All colors are semantic and automatically adapt to theme via CSS variables.

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
