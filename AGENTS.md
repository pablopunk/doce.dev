# AGENTS.md — doce.dev

> **Maintenance Note**: When updating this file, avoid listing specific counts, implementation details, or enumerations that will become outdated quickly. Instead, reference source files with `@path/to/file.ts` notation.

## Overview
Self-hosted AI website builder: Astro 5 + React islands + Tailwind v4 + TypeScript + SQLite + Docker.

**Stack**: Astro (Node adapter) • Drizzle ORM (w/ local sqlite) • `ai` SDK with OpenRouter • Docker

**Run**: `pnpm install && pnpm run dev` → http://localhost:4321

**Environment**: Variables defined in `.env` (gitignored). See @src/lib/env.ts for schema and defaults:
- `DOCKER_HOST` - Docker socket path (default: `/var/run/docker.sock`)
- `DATA_PATH` - Data directory for DB and projects (default: `./data`)

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

## 🏗️ Architecture (MCA Pattern)

**Flow**: Component → Action → Model → DB Provider

**Pattern**: MCA (Model-Component-Actions) with provider abstraction for infrastructure.

**Structure**:
```
src/
├── domain/{feature}/        # Business features (MCA pattern)
│   ├── models/              # Business logic + DB interaction
│   ├── actions/             # Server-side Astro actions
│   ├── components/          # React UI components
│   ├── hooks/               # Domain-specific React hooks (optional)
│   └── lib/                 # Domain-specific utilities (optional)
├── lib/                     # Infrastructure providers
│   ├── db/                  # Database abstraction layer
│   ├── logger/              # Logger abstraction layer
│   ├── docker/              # Docker utilities
│   └── file-system.ts       # File operations
├── actions/
│   └── index.ts             # Re-exports all domain actions
├── components/
│   ├── ui/                  # shadcn components (shared)
│   └── [shared].tsx         # Global shared components
├── hooks/                   # Global hooks (theme, mobile, toast)
├── layouts/                 # Astro layouts
└── pages/                   # Astro pages + API routes
```

**Domains**:
- `projects/` - Project CRUD, preview, deployment, file management
- `llms/` - AI model configuration, API key management
- `conversations/` - Chat history, messages
- `auth/` - User management, setup wizard
- `system/` - System stats, deployments, admin operations

**Frontend**: `layouts/` (BaseLayout.astro) → `pages/` (.astro pages) → `components/` (.tsx React + ui/ shadcn)

**API**: Astro Actions for all server operations. API routes (`pages/api/`) are ONLY for special cases where Actions are insufficient (streaming responses, SSE, etc.):
- Chat: @src/pages/api/chat/[projectId].ts (AI streaming with tool calling)
- Logs: @src/pages/api/projects/[id]/logs.ts (Server-Sent Events for Docker logs)

## 💡 Adding a New Feature

### MCA Pattern (Recommended)

For features with business logic, follow the MCA pattern:

**1. Model**: Create `domain/my-feature/models/my-feature.ts`
```typescript
import * as db from "@/lib/db";

export interface MyFeatureData {
  id: string;
  name: string;
}

export class MyFeature {
  static async getAll(): Promise<MyFeatureData[]> {
    // Call DB provider functions
    return db.myFeature.getAll() as MyFeatureData[];
  }

  static async create(name: string): Promise<MyFeatureData> {
    return db.myFeature.create(name) as MyFeatureData;
  }
}
```

**2. Actions**: Create `domain/my-feature/actions/my-feature-actions.ts`
```typescript
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { MyFeature } from "@/domain/my-feature/models/my-feature";

export const server = {
  getAll: defineAction({
    handler: async () => {
      const items = await MyFeature.getAll();
      return items;
    },
  }),

  create: defineAction({
    input: z.object({ name: z.string() }),
    handler: async ({ name }) => {
      const item = await MyFeature.create(name);
      return item;
    },
  }),
};
```

**3. Component**: Create `domain/my-feature/components/my-feature-list.tsx`
```typescript
import { actions } from "astro:actions";

export function MyFeatureList() {
  const handleCreate = async () => {
    const { data, error } = await actions.myFeature.create({ name: "Test" });
    if (error) {
      console.error(error.code, error.message);
      return;
    }
    console.log(data);
  };
  // ...
}
```

**4. Export**: Update `src/actions/index.ts`
```typescript
import { server as myFeatureActions } from "@/domain/my-feature/actions/my-feature-actions";

export const server = {
  // ... existing
  myFeature: myFeatureActions,
};
```

**5. Page**: Create `pages/my-feature.astro`
```astro
---
import { MyFeatureList } from "@/domain/my-feature/components/my-feature-list";
import BaseLayout from "@/layouts/BaseLayout.astro";
---

<BaseLayout title="My Feature">
  <MyFeatureList client:load />
</BaseLayout>
```

### Domain Structure Details

**models/** - Business logic and data access
- Define interfaces/types
- Create model classes with static methods
- Call DB provider functions (`@/lib/db`)
- Keep functions small (<20 lines)

**actions/** - Server-side Astro actions
- Define with `defineAction()` and Zod validation
- Call model methods (NOT DB directly)
- Use `ActionError` for errors
- Export as `export const server = {...}`

**components/** - React UI components
- Import `actions` from `astro:actions`
- Use shadcn/ui components from `@/components/ui/`
- Require hydration directives in Astro pages (e.g., `client:load`)

**hooks/** - Domain-specific React hooks (optional)
- Custom hooks for domain state management
- Example: `use-project-lifecycle.ts`

**lib/** - Domain-specific utilities (optional)
- Helper functions specific to the domain
- Example: `projects/lib/code-generator.tsx`

### Astro Hydration Directives

React components in Astro pages require hydration directives to run on the client:

- `client:load` - Hydrate immediately on page load (use for interactive components)
- `client:idle` - Hydrate when main thread is idle (use for non-critical interactivity)
- `client:visible` - Hydrate when component scrolled into viewport (use for below-fold content)
- `client:only` - Skip SSR, render only on client (use for browser-only code)

**Note**: Do NOT use `"use client"` directive (that's Next.js, not needed in Astro)

## Rules

**DO**:
- Organize by domain (feature) • Small functions (<20 lines) • Type-safe
- Models call DB provider • Actions call models • Components call actions
- Use Drizzle ORM for data access • Keep business logic in domain models
- Use Astro Actions for server functions • Zod schemas for validation
- Use BaseLayout • React components with `client:load` • Import `actions` from `astro:actions`

**DON'T**:
- Direct DB access from actions • Business logic in DB provider or actions
- Skip the model layer • Put business logic in DB provider
- `innerHTML` or string DOM manipulation
- Duplicate HTML • Full pages in `.astro` without layouts
- Use `fetch()` for internal APIs (use Actions instead)
- Create API routes for non-streaming endpoints (use Actions)

## Data & Infrastructure

**DB Provider** (`src/lib/db/`) - **Using Drizzle ORM**:
- **Schema**: `src/lib/db/providers/drizzle/schema.ts` - Pure schema definitions (no business logic)
- **DB Instance**: `src/lib/db/providers/drizzle/db.ts` - Drizzle instance + SQLite connection
- **CRUD Operations**: `src/lib/db/providers/drizzle/tables/*.ts` - Clean operations, one file per model
- **API**: `src/lib/db/index.ts` - Exports namespaced operations + backward compat wrappers
- **Tables**: `config`, `users`, `projects`, `conversations`, `messages`, `files`, `deployments`
- **Access from models**: `import * as db from "@/lib/db"` then call `db.projects.getById()`, `db.files.upsert()`, etc.
- **Type Safety**: Full TypeScript types exported from schema (`User`, `Project`, `NewProject`, etc.)
- **Migrations**: Managed by Drizzle Kit (see below)
- **Config**: `drizzle.config.ts` at project root

**Database Migrations** (Drizzle Kit):
- **Development**: `pnpm db:push` - Direct schema sync, no migration files (rapid prototyping)
- **Production Workflow**:
  1. Make schema changes in `src/lib/db/providers/drizzle/schema.ts`
  2. Run `pnpm db:generate` locally (creates migration SQL files in `/drizzle`)
  3. Commit migration files to git
  4. Deploy: `pnpm deploy` (auto-generates migrations if needed, applies them, builds, previews)
- **Pull from DB**: `pnpm db:pull` - Generate TypeScript schema from existing database
- **Studio**: `pnpm db:studio` - Visual database browser at https://local.drizzle.studio
- **Migration files**: Stored in `/drizzle` folder (auto-generated, version-controlled)
- **History tracking**: Drizzle maintains `__drizzle_migrations` table automatically
- **Commands**:
  - `db:push` - Best for development, pushes schema changes directly to DB
  - `db:generate` - Generates SQL migration files from schema changes
  - `db:migrate` - Applies pending migrations to database
  - `db:pull` - Introspects database and generates schema.ts
  - `db:studio` - Opens Drizzle Studio for visual DB management
  - `deploy` - Production deployment: generate migrations → apply → build → preview

**Config**: `ai_provider`, `{provider}_api_key`, `default_ai_model`, `setup_complete` (stored in DB via `db.config` operations)

**Files**: Mirrored in DB + filesystem • Use `writeProjectFiles`/`listProjectFiles` (`src/lib/file-system.ts`)

**Docker**:
- **Preview**: `doce-preview-{projectId}` on random ports 10000-20000
- **Deployment**: `doce-deploy-{projectId}`
- **Port Allocation**: Random selection from range (see @src/lib/docker.ts `findAvailablePort()`)
- **Constants**: @src/lib/docker/constants.ts
- **Source of Truth**: Docker state is authoritative; DB `preview_url` is cache (see @src/lib/docker.ts `getPreviewState()`)

**AI Models**:
- **Available Models**: See @src/domain/llms/models/ai-models.ts for all supported models
- **Configuration**: Managed by @src/domain/llms/models/llm-config.ts
- **Icons**: Provider logos in @src/components/ui/svgs/

**Logger Provider** (`src/lib/logger/`):
- **Location**: `src/lib/logger/providers/pino.ts`
- **API**: `src/lib/logger/index.ts`
- **Usage**: `import { createLogger } from "@/lib/logger"` then `const logger = createLogger("namespace")`

**Code Gen**:
- **Templates**: @templates/ contains one folder per template (currently `astro/`). These are base projects that the AI model copies and modifies to generate new projects.
- **Format**: Fenced blocks with `file="path"` attribute, or JSON with files array
- **Parser**: @src/domain/projects/lib/code-generator.tsx (tries JSON first, then extracts code blocks)
- **File Operations**: @src/lib/file-system.ts (writes files to disk + DB)
- **CRITICAL**: Always generate `src/pages/index.astro` as complete page with full HTML
- **Components**: All generated projects include full shadcn/ui library from template

## Middleware

**Location**: @src/middleware.ts

**Purpose**: Astro middleware that runs on every request:
- Redirects to `/setup` if setup is not complete
- Logs all Astro Action errors for debugging (400+ status codes)
- Allows `/setup` routes to bypass authentication

**Docs**: https://docs.astro.build/en/guides/middleware/

## Actions Structure

**Main Export**: `src/actions/index.ts` re-exports all domain actions

**Current Actions**:
- `actions.projects.*` - Project operations (see @src/domain/projects/actions/project-actions.ts)
- `actions.config.*` - AI configuration (see @src/domain/llms/actions/llm-actions.ts)
- `actions.chat.*` - Chat operations (see @src/domain/conversations/actions/conversation-actions.ts)
- `actions.setup.*` - Setup wizard (see @src/domain/auth/actions/auth-actions.ts)
- `actions.deployments.*` - Deployment management (see @src/domain/system/actions/system-actions.ts)
- `actions.stats.*` - System statistics (see @src/domain/system/actions/system-actions.ts)
- `actions.admin.*` - Admin operations (see @src/domain/system/actions/system-actions.ts)

All actions exported via @src/actions/index.ts

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

## Debugging

**DB**: `sqlite3 ./data/doce.db "SELECT id, name, preview_url FROM projects;"`

**Docker**:
- `docker ps --filter "name=doce-preview"`
- `docker logs doce-preview-{id} --tail 50`

**Actions**:
```bash
curl -X POST http://localhost:4321/_actions/projects.getProjects \
  -H "Content-Type: application/json" -d '{}'
```

**API Routes**: Only for streaming
- Logs: `src/pages/api/projects/[id]/logs.ts`
- Chat: `src/pages/api/chat/[projectId].ts`

**Common Issues**:
- **Preview not starting** → Check Docker logs, verify `preview_url` in DB
- **Build fails** → Check import paths (`@/domain/...` not `@/domains/...`)
- **Actions fail** → Check `src/actions/index.ts` exports all domain actions
- **TypeScript errors** → Model types must match DB schema (snake_case)

## Guidelines

**Development**:
- Use **pnpm** for package management
- Run `pnpm format` to format code with Biome
- Run `pnpm build` frequently to catch errors
- Run `pnpm type-check` to catch type errors
- Follow MCA pattern for all new features
- Keep functions small (<20 lines) and focused

**Database**:
- Schema defined in @src/lib/db/providers/drizzle/schema.ts
- Migrations managed by Drizzle Kit (see Database Migrations section)
- Access via model layer, not directly from actions

**AI Models**:
- Add new models to @src/domain/llms/models/ai-models.ts
- **Icons**: UI uses `lucide-react` for interface icons. Provider logos in @src/components/ui/svgs/ (manually added SVG components)

**Testing**:
- Actions: `curl -X POST http://localhost:4321/_actions/{domain}.{action} -H "Content-Type: application/json" -d '{}'`
- Docker: Always check Docker state first (source of truth)
- Database: `sqlite3 ./data/doce.db` for direct queries

**Best Practices**:
- Use Actions, not fetch: `actions.projects.getProjects()` not `fetch('/api/projects')`
- Components in domain folders, not global `components/`
- Shared UI components in `components/ui/` only
- Provider abstraction for infrastructure (DB, Logger, Docker)

---

**Architecture**: MCA (Model-Component-Actions) pattern with provider abstraction. All new features follow domain organization.
