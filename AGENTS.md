# AGENTS.md — doce.dev

## Overview
Self‑hosted AI website builder: Astro 5 + React islands + Tailwind v4 + TypeScript + SQLite + Docker.

**Stack**: Astro (Node adapter) • better‑sqlite3 (`./data/doceapp.db`) • `ai` SDK with OpenRouter • Docker

**Run**: `pnpm install && pnpm run dev` → http://localhost:4321

**Environment**: `DATABASE_PATH` (default `./data/doceapp.db`) • `PROJECTS_DIR` (default `./data/projects/`) • `DOCKER_HOST` (default `/var/run/docker.sock`)

**Setup**: `/setup` → create admin user → configure AI provider (keys in DB, not env vars)

## 🎨 Design System

**Pure B&W**: Monochromatic design with inverted light/dark modes. Light/Dark/System toggle in TopNav (localStorage + system preference).

**Typography**:
- `font-sans` → Geist variable font (100-900 weight)
- `font-mono` → Geist Mono variable font (for code)

**Color System** (defined in `src/styles/global.css`):

**Background Layers** (elevation hierarchy, darkest to lightest):
- `bg-bg` → Page background
- `bg-surface` → Cards, panels
- `bg-raised` → Elevated surfaces, inputs
- `bg-cta` → Primary buttons, CTAs (inverted: darkest in dark mode, lightest in light mode)

**Text Hierarchy**:
- `text-strong` → Headings, emphasis (highest contrast)
- `text-fg` → Default body text
- `text-muted` → Secondary text, captions

**Borders & Accents**:
- `border-border` → Standard borders

**Semantic Colors**:
- `warning` → Yellow alerts
- `danger` → Red errors/destructive actions

**Available Utilities**:
- Backgrounds: `bg-{bg|surface|raised|cta|warning|danger}`
- Text: `text-{strong|fg|muted|warning|danger}`
- Borders: `border-{border|strong|danger}`
- Rings: `ring-{strong|danger}`

**Design Patterns**:
- Default button: `bg-cta text-strong border border-border`
- Card: `bg-surface text-fg`
- Input: `bg-raised text-fg border border-border`
- Scale-on-press buttons: `active:scale-[0.98]`
- Hover brightness: `hover:brightness-110`

**IMPORTANT**: NO `dark:` classes allowed. All colors automatically adapt via CSS variables in `.dark` and `.light` classes.

**Theme Hook**: `src/hooks/use-theme.ts`

## 🏗️ Architecture (Clean Architecture + DDD)

**Flow**: Astro Action → Facade → Use Case → Domain Service → Repository → Infrastructure

**Layers**: Actions (type-safe server functions) → Application (use cases, facades) → Domain (pure business logic) → Infrastructure (SQLite, Docker, FS, AI) → Shared (errors, types, config)

**Structure**:
```
actions/                      → {domain}.ts (Astro Actions with Zod validation)
domains/{domain}/domain/      → models/, repositories/ (interfaces), services/
domains/{domain}/application/ → use-cases/
infrastructure/               → database/sqlite/, container-orchestration/, file-system/, ai-providers/
application/facades/          → Coordinates between use cases and actions
shared/                       → kernel/, logging/, config/
```

**Frontend**: `layouts/` (BaseLayout.astro) → `pages/` (.astro pages) → `components/` (.tsx React + ui/ shadcn)

**API**: Astro Actions for all server operations. Streaming endpoints (`logs`, `chat`) use API routes.

## 💡 Adding a New Feature

### Simple Features (No Domain Logic)
For simple CRUD or form handling, create actions directly:

**1. Action**: `actions/my-feature.ts` - Define with `defineAction()`, Zod validation
**2. Page**: `pages/my-page.astro` - Use `BaseLayout`, import React component
**3. Component**: `components/my-component.tsx` - Call actions with `import { actions } from "astro:actions"`

### Complex Features (Domain-Driven)
For business logic, relationships, or complex rules:

**1. Domain**: `domains/my-feature/domain/models/` - Aggregate root extending `AggregateRoot<Props>`
**2. Repo Interface**: `domains/my-feature/domain/repositories/` - `IMyEntityRepository` interface
**3. Use Case**: `domains/my-feature/application/use-cases/` - Orchestrates domain + repo
**4. Repo Impl**: `infrastructure/database/sqlite/repositories/` - Implements interface with `getDatabase()`
**5. Facade**: `application/facades/` - Coordinates use cases
**6. Action**: `actions/my-feature.ts` - Calls facade methods
**7. Page**: `pages/my-page.astro` - Use `BaseLayout`, import React component with `client:load`
**8. Component**: `components/my-component.tsx` - React with `"use client"`, import `actions` from `astro:actions`

### Example Action

```typescript
// src/actions/my-feature.ts
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { myFeatureFacade } from "@/application/facades/my-feature-facade";

export const server = {
  getItem: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }) => {
      const item = await myFeatureFacade.getItem(id);
      if (!item) {
        throw new ActionError({ code: "NOT_FOUND", message: "Item not found" });
      }
      return item;
    },
  }),
};
```

### Using Actions in Components

```typescript
// src/components/my-component.tsx
"use client";
import { actions } from "astro:actions";

export function MyComponent() {
  const handleClick = async () => {
    const { data, error } = await actions.myFeature.getItem({ id: "123" });
    if (error) {
      console.error(error.code, error.message);
      return;
    }
    console.log(data);
  };
  // ...
}
```

## Rules

**DO**:
- Keep domain pure • Small functions (<20 lines) • Proper error types • Type-safe
- Use Astro Actions for server functions • Zod schemas for validation
- Use BaseLayout • React components for UI • Astro islands with `client:load`
- Import actions with `import { actions } from "astro:actions"`

**DON'T**:
- Infrastructure in domain • Business logic in actions
- Direct DB access from actions • `innerHTML` or string DOM manipulation
- Duplicate HTML • Full pages in `.astro` without layouts
- Use `fetch()` for internal APIs (use Actions instead)
- Create API routes for non-streaming endpoints (use Actions)

## Data & Files

**DB**:
- Tables: `config`, `users`, `projects`, `conversations`, `messages`, `files`, `deployments`
- Access: Repositories in `infrastructure/database/sqlite/repositories/` or `src/lib/db.ts`
- Migrations: `src/lib/migrations.ts` - auto-run on first connection (NOT build time)

**Config**: `ai_provider`, `{provider}_api_key`, `default_ai_model`, `setup_complete` (stored in DB)

**Files**: Mirrored in DB + filesystem • Use `writeProjectFiles`/`listProjectFiles` (`src/lib/file-system.ts`)

**Docker**:
- Preview: `doce-preview-{projectId}` on ports 10000-20000
- Docker is source of truth, DB `preview_url` is cache

**AI Models**:
- Config: `src/shared/config/ai-models.ts` (7 models)
- Available: `DEFAULT_AI_MODEL`, `AVAILABLE_AI_MODELS`, `getModelById()`, `isValidModel()`
- Icons: `src/components/ui/svgs/` (SVGL via shadcn)

**Code Gen**:
- Format: Fenced blocks with `file="path"` attribute
- Parser: JSON first, then code block extraction
- **CRITICAL**: Always generate `src/pages/index.astro` as complete page with full HTML
- **Templates**: All projects include full shadcn/ui library in `src/components/ui/` - use these components

## Debugging

**DB**: `sqlite3 ./data/doceapp.db "SELECT id, name, preview_url FROM projects;"`
**Docker**: `docker ps --filter "name=doce-preview"` • `docker logs doce-preview-{id} --tail 50`
**Actions**: `curl -X POST http://localhost:4321/_actions/projects.getProjects -H "Content-Type: application/json" -d '{}'`
**API Routes**: Only for streaming - `logs.ts`, `chat/[projectId].ts`

**Issues**:
- Preview → check `preview_url`
- Build → check imports
- Types → domain only imports `@/shared/kernel/`
- Actions → check `src/actions/index.ts` exports

## Actions Structure

**Main Export**: `src/actions/index.ts` exports all action modules

**Current Actions**:
- `actions.stats.*` - System statistics (1 action)
- `actions.config.*` - API keys, AI model configuration (4 actions)
- `actions.projects.*` - Project operations: CRUD, preview, deploy, env, files (15 actions)
- `actions.setup.*` - Setup wizard: user creation, AI config, completion (4 actions)
- `actions.admin.*` - Admin operations: cleanup (1 action)
- `actions.deployments.*` - Deployment management (2 actions)
- `actions.chat.*` - Chat history, message deletion (2 actions)

**Why Actions?**
- ✅ **Type-safe**: Full TypeScript from server to client
- ✅ **Validated**: Automatic Zod validation on all inputs
- ✅ **Standardized**: ActionError with codes (NOT_FOUND, BAD_REQUEST, UNAUTHORIZED, etc.)
- ✅ **Debuggable**: HTTP access at `/_actions/{module}.{action}` for testing
- ✅ **Simple**: No manual JSON parsing, no fetch boilerplate

**Streaming Endpoints** (use API routes, not Actions):
- `src/pages/api/projects/[id]/logs.ts` - Server-Sent Events for Docker logs
- `src/pages/api/chat/[projectId].ts` - AI streaming with tool calling

Actions don't support streaming responses - use traditional API routes for SSE/streaming.

## Guidelines

- Use **pnpm** • Run `pnpm build` frequently
- Schema → `src/lib/migrations.ts`
- Test actions: `curl -X POST http://localhost:4321/_actions/{module}.{action} -d '{}'`
- Docker first for preview debugging
- New models → `src/shared/config/ai-models.ts`
- Icons → `pnpm dlx shadcn@latest add @svgl/{icon-name}`
- Use Actions, not fetch: `actions.projects.getProjects()` not `fetch('/api/projects')`

---

**Scope**: Architecture for entire repo. New features use Astro Actions + Clean Architecture.
