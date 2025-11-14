# AGENTS.md — doce.dev

## Overview
Self-hosted AI website builder: Astro 5 + React islands + Tailwind v4 + TypeScript + SQLite + Docker.

**Stack**: Astro (Node adapter) • better-sqlite3 (`./data/doceapp.db`) • `ai` SDK with OpenRouter • Docker

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

**API**: Astro Actions for all server operations. Streaming endpoints (`logs`, `chat`) use API routes in `pages/api/`.

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
"use client";
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
- Use `"use client"` directive
- Import `actions` from `astro:actions`
- Use shadcn/ui components from `@/components/ui/`

**hooks/** - Domain-specific React hooks (optional)
- Custom hooks for domain state management
- Example: `use-project-lifecycle.ts`

**lib/** - Domain-specific utilities (optional)
- Helper functions specific to the domain
- Example: `projects/lib/code-generator.tsx`

## Rules

**DO**:
- Organize by domain (feature) • Small functions (<20 lines) • Type-safe
- Models call DB provider • Actions call models • Components call actions
- Use Astro Actions for server functions • Zod schemas for validation
- Use BaseLayout • React components with `client:load` • Import `actions` from `astro:actions`

**DON'T**:
- Direct DB access from actions • Business logic in actions
- Skip the model layer • `innerHTML` or string DOM manipulation
- Duplicate HTML • Full pages in `.astro` without layouts
- Use `fetch()` for internal APIs (use Actions instead)
- Create API routes for non-streaming endpoints (use Actions)

## Data & Infrastructure

**DB Provider** (`src/lib/db/`):
- **Location**: `src/lib/db/providers/sqlite.ts`
- **API**: `src/lib/db/index.ts` exports namespaced operations + legacy functions
- **Tables**: `config`, `users`, `projects`, `conversations`, `messages`, `files`, `deployments`
- **Access from models**: `import * as db from "@/lib/db"` then call `db.getProject()`, `db.saveFile()`, etc.
- **Migrations**: `src/lib/migrations.ts` - auto-run on first connection

**Config**: `ai_provider`, `{provider}_api_key`, `default_ai_model`, `setup_complete` (stored in DB via `db.config` operations)

**Files**: Mirrored in DB + filesystem • Use `writeProjectFiles`/`listProjectFiles` (`src/lib/file-system.ts`)

**Docker**:
- **Preview**: `doce-preview-{projectId}` on ports 10000-20000
- **Deployment**: `doce-deploy-{projectId}`
- **Constants**: `src/lib/docker/constants.ts`
- Docker is source of truth, DB `preview_url` is cache

**AI Models**:
- **Location**: `src/domain/llms/models/ai-models.ts`
- **Exports**: `DEFAULT_AI_MODEL`, `AVAILABLE_AI_MODELS`, `getModelById()`, `isValidModel()`
- **Icons**: `src/components/ui/svgs/` (provider logos via SVGL)
- **Config**: Managed by `LLMConfig` model in `domain/llms/models/llm-config.ts`

**Logger Provider** (`src/lib/logger/`):
- **Location**: `src/lib/logger/providers/pino.ts`
- **API**: `src/lib/logger/index.ts`
- **Usage**: `import { createLogger } from "@/lib/logger"` then `const logger = createLogger("namespace")`

**Code Gen**:
- **Location**: `src/domain/projects/lib/code-generator.tsx`
- **Format**: Fenced blocks with `file="path"` attribute
- **Parser**: JSON first, then code block extraction
- **CRITICAL**: Always generate `src/pages/index.astro` as complete page with full HTML
- **Templates**: All projects include full shadcn/ui library in `src/components/ui/` - use these components

## Actions Structure

**Main Export**: `src/actions/index.ts` re-exports all domain actions

**Current Actions**:
- `actions.projects.*` - 15 actions (CRUD, preview, deploy, env, files, heartbeat)
- `actions.config.*` - 4 actions (API keys, model selection) - from `llms` domain
- `actions.chat.*` - 2 actions (history, delete message) - from `conversations` domain
- `actions.setup.*` - 4 actions (user creation, AI config, completion) - from `auth` domain
- `actions.deployments.*` - 2 actions (get, delete) - from `system` domain
- `actions.stats.*` - 1 action (system stats) - from `system` domain
- `actions.admin.*` - 1 action (cleanup) - from `system` domain

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

**DB**: `sqlite3 ./data/doceapp.db "SELECT id, name, preview_url FROM projects;"`

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
- Run `pnpm build` frequently to catch errors
- Follow MCA pattern for all new features
- Keep functions small (<20 lines) and focused

**Database**:
- Schema defined in `src/lib/db/providers/sqlite.ts`
- Migrations in `src/lib/migrations.ts` (auto-run on first connection)
- Access via model layer, not directly from actions

**AI Models**:
- Add new models to `src/domain/llms/models/ai-models.ts`
- Icons: `pnpm dlx shadcn@latest add @svgl/{provider-name}`

**Testing**:
- Actions: `curl -X POST http://localhost:4321/_actions/{domain}.{action} -H "Content-Type: application/json" -d '{}'`
- Docker: Always check Docker state first (source of truth)
- Database: `sqlite3 ./data/doceapp.db` for direct queries

**Best Practices**:
- Use Actions, not fetch: `actions.projects.getProjects()` not `fetch('/api/projects')`
- Components in domain folders, not global `components/`
- Shared UI components in `components/ui/` only
- Provider abstraction for infrastructure (DB, Logger, Docker)

---

**Architecture**: MCA (Model-Component-Actions) pattern with provider abstraction. All new features follow domain organization.
