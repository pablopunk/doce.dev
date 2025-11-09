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

**AI Model Selection**: Users can select their preferred AI model from the dashboard input prompt. The settings icon shows the currently selected model's provider logo. Available models are centralized in `src/shared/config/ai-models.ts`.

## 🎨 Design System

**Pure B&W System**: Monochromatic design using only black, white, and grays. No accent colors. Light mode is literally the inverse of dark mode.

**Theme Modes**: Light/Dark/System theme switching via toggle in TopNav. Theme stored in localStorage, defaults to system preference.

**Color Tokens**:
- **Neutrals** (HSL with S=0%): `--bg-base`, `--bg-surface`, `--bg-raised`, `--text-strong`, `--text-muted`, `--border`, `--border-strong`, `--highlight`
- **Primary**: Pure white (#fcfcfc) in dark mode, pure black (#050505) in light mode for buttons/CTAs
- **Semantic** (OKLCH): `--success`, `--warning`, `--danger` (only for alerts/notifications)
- **Shadows**: Two-layer system using `--shadow-1` (short/darker) + `--shadow-2` (long/lighter) - stronger shadows for depth

**Dark Mode** (default):
- Base: 3% L (deep black #080808)
- Surface: 5% L (cards)
- Raised: 8% L (elevated)
- Text: 98% L (near-white)
- Borders: 15% L subtle, 25% L strong
- Primary: 98% L (white buttons)

**Light Mode** (inverted):
- Base: 97% L (near-white)
- Surface: 95% L (cards)
- Raised: 92% L (elevated)
- Text: 2% L (near-black)
- Borders: 85% L subtle, 75% L strong
- Primary: 2% L (black buttons)

**Visual Elements**:
- **Cards**: 2px borders with subtle top highlight, hover state with shadow increase
- **Buttons**: B&W with 2px borders, font-semibold, scale-on-press animation
- **Inputs**: 2px borders, focus ring, hover state
- **All elements**: 2px borders for definition, no rounded corners except where specified

**Tailwind Extensions**: `bg-base`, `bg-surface`, `bg-raised`, `text-strong`, `text-muted`, `border-strong`, `shadow-elevation`, `shadow-elevation-lg`

**Theme Hook**: `src/hooks/use-theme.ts` - Manages light/dark/system theme switching

---

## 🏗️ Architecture (Clean Architecture + DDD)

**Flow**: API Route → Facade → Use Case → Domain Service → Repository → Infrastructure

**Layers**:
```
API (src/pages/api/)           → Thin Astro routes
Application (src/application/) → Use cases + Facades (temp)
Domain (src/domains/*/domain/) → Business logic, ZERO infrastructure deps
Infrastructure (src/infrastructure/) → SQLite, Docker, File System, AI providers
Shared (src/shared/)           → Errors, types, config, logging
```

**Key Structure**:
```
src/
├── domains/{domain}/
│   ├── domain/
│   │   ├── models/           # Aggregate roots (e.g., Project)
│   │   ├── repositories/     # Interfaces ONLY
│   │   └── services/         # Business logic
│   └── application/
│       └── use-cases/        # Orchestrates domain + infrastructure
├── infrastructure/
│   ├── database/sqlite/      # Repository implementations
│   ├── container-orchestration/docker/  # Docker logic (TODO)
│   ├── file-system/          # File operations (TODO)
│   └── ai-providers/         # AI provider logic (TODO)
├── application/facades/      # Temp adapters during migration
└── shared/                   # Errors, types, config, logging
```

**Migration Status**:
- ✅ **Migrated**: Projects domain + 8 API routes
- 🔄 **In Progress**: Conversations, files, deployments domains
- ⏳ **TODO**: Docker/file-system to infrastructure, AI providers, code generation

**Frontend Structure**:
```
src/
├── layouts/
│   └── BaseLayout.astro        # Shared HTML boilerplate
├── pages/
│   ├── *.astro                 # Routes (use BaseLayout)
│   └── api/                    # API endpoints
└── components/
    ├── *.tsx                   # React components (interactive UI)
    └── ui/                     # shadcn/ui components
```

---

## 💡 Adding a New Feature

**1. Domain Model** (business logic):
```typescript
// domains/my-feature/domain/models/my-entity.model.ts
export class MyEntity extends AggregateRoot<Props> {
  static create(data: CreateData): MyEntity { /* validation */ }
}
```

**2. Repository Interface** (in domain):
```typescript
// domains/my-feature/domain/repositories/my-entity.repository.interface.ts
export interface IMyEntityRepository {
  findById(id: string): Promise<MyEntity | null>;
  save(entity: MyEntity): Promise<void>;
}
```

**3. Use Case** (orchestration):
```typescript
// domains/my-feature/application/use-cases/create.use-case.ts
export class CreateMyEntityUseCase {
  constructor(private repo: IMyEntityRepository, private logger: Logger) {}
  async execute(dto: CreateDto): Promise<ResultDto> {
    const entity = MyEntity.create(dto);
    await this.repo.save(entity);
    return this.toDto(entity);
  }
}
```

**4. Repository Implementation** (infrastructure):
```typescript
// infrastructure/database/sqlite/repositories/my-entity.repository.ts
export class SqliteMyEntityRepository implements IMyEntityRepository {
  async findById(id: string): Promise<MyEntity | null> {
    const row = getDatabase().prepare("SELECT * FROM table WHERE id = ?").get(id);
    return row ? MyEntity.fromPersistence(row) : null;
  }
}
```

**5. Facade** (temp):
```typescript
// application/facades/my-entity-facade.ts
class MyEntityFacade {
  private repo = new SqliteMyEntityRepository();
  async create(data) {
    const useCase = new CreateMyEntityUseCase(this.repo, logger);
    return useCase.execute(data);
  }
}
export const myEntityFacade = new MyEntityFacade();
```

**6. API Route**:
```typescript
// pages/api/my-endpoint.ts
import { myEntityFacade } from '@/application/facades/my-entity-facade';
export const POST: APIRoute = async ({ request }) => {
  const result = await myEntityFacade.create(await request.json());
  return Response.json(result);
};
```

**7. UI Page** (if needed):
```astro
---
// pages/my-page.astro
import BaseLayout from "@/layouts/BaseLayout.astro";
import { MyComponent } from "@/components/my-component";
---

<BaseLayout title="My Page">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">My Page</h1>
    <MyComponent client:load />
  </div>
</BaseLayout>
```

**8. React Component** (for interactive UI):
```tsx
// components/my-component.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MyComponent() {
  const [data, setData] = useState([]);

  // Fetch data, handle events, etc.

  return <div>{/* Proper React JSX */}</div>;
}
```

---

## Rules

**DO**:
- Keep domain pure (no infrastructure imports)
- Small functions (< 20 lines)
- Use proper error types (`ValidationError`, `NotFoundError`, etc.)
- Define interfaces in domain, implement in infrastructure
- Type-safe (avoid `any`)
- **Use shared layouts** for all pages (`src/layouts/BaseLayout.astro`)
- **Create proper React components** for interactive UI (in `src/components/`)
- **Use Astro islands** with `client:load` for React components in `.astro` pages

**DON'T**:
- Import infrastructure in domain layer
- Put business logic in API routes
- Directly access database from routes
- **NEVER use `innerHTML` or string-based DOM manipulation** - use React components
- **NEVER duplicate HTML boilerplate** across pages - use layouts
- **NEVER create full HTML pages in `.astro` files** - use layouts with slots

---

## Data & Files

**Database**: Tables: `config`, `users`, `projects`, `conversations`, `messages`, `files`, `deployments` • Access via repositories (new) or `db.ts` (legacy) • **Migrations**: Auto-run on first DB connection (dev/preview/production start, NOT during build)

**Config Table Keys**:
- `ai_provider` - Provider name (openrouter, openai, anthropic)
- `{provider}_api_key` - API key for each provider
- `default_ai_model` - Currently selected AI model ID
- `setup_complete` - Setup wizard completion flag

**Files**: Mirrored in DB + filesystem • Use `writeProjectFiles` / `listProjectFiles` from `src/lib/file-system.ts`

**Docker**: Preview containers: `doce-preview-{projectId}` on ports 10000-20000 • **Docker is source of truth** — DB `preview_url` is cache

---

## Code Generation

Use fenced blocks with `file="path"`:
```tsx file="src/components/Widget.tsx"
export function Widget() { return <div /> }
```

**Stack**: Astro 5 + React islands + Tailwind v4 + TypeScript • Parser tries JSON `{ files: [...] }` first, then extracts fenced blocks

---

## AI Models & Configuration

**Centralized Model Config**: All AI models are defined in `src/shared/config/ai-models.ts`:
- `DEFAULT_AI_MODEL` - Default model constant
- `AVAILABLE_AI_MODELS` - Array of 7 available models (OpenAI, Anthropic, Google, MoonshotAI, xAI)
- `getModelById()` - Helper to find a model by ID
- `isValidModel()` - Helper to validate model IDs

**Model Selection UI**:
- Dashboard prompt shows selected model's provider icon (replaces settings icon)
- Popover displays all available models with provider icons and descriptions
- Selection persisted in DB `config` table under `default_ai_model` key

**Provider Icons**: SVG logos installed from [SVGL](https://svgl.app/) via shadcn/ui registry:
- Located in `src/components/ui/svgs/`
- Styled with muted grey colors to match dark theme
- Registry configured in `components.json` under `registries.@svgl`

---

## Debugging

**DB**: `sqlite3 ./data/doceapp.db "SELECT id, name, preview_url FROM projects;"`

**Docker**: `docker ps --filter "name=doce-preview"` • `docker logs doce-preview-{id} --tail 50`

**API**: `curl -s http://localhost:4321/api/projects/{id} | jq`

**Common Issues**:
- Preview not showing? Check `preview_url` (snake_case) in API response
- Build errors? Ensure proper imports: `@/domains/...`, `@/infrastructure/...`, `@/shared/...`
- Type errors? Domain imports only from `@/shared/kernel/`

---

## Guidelines

- **Always use pnpm** (not npm)
- **Run `pnpm build`** frequently to catch errors
- **Schema changes**: Add to `src/lib/migrations.ts` (migrations auto-run on app start)
- **Test APIs with curl** before UI changes
- **Check Docker first** when debugging previews
- **Adding new AI models**: Update `src/shared/config/ai-models.ts` only (single source of truth)
- **Adding provider icons**: Use `pnpm dlx shadcn@latest add @svgl/{icon-name}` to install from SVGL registry

---

Scope: This file defines architecture for the entire repo. New features follow Clean Architecture. Legacy code is gradually migrating.
