# Tech Stack

## Package Manager

**pnpm** - Fast, disk-efficient package manager. Always use `pnpm`, never `npm`, `yarn`, or `bun`.

## Language

**TypeScript** - Used throughout for type safety. Strict mode enabled.

## Framework

**Astro v5** - Full-stack framework providing:
- Astro Pages for file-based routing
- Astro Actions for type-safe server-side operations like CRUD
- React integration for interactive components
- SSR with on-demand rendering

## UI

**React** - Used for all interactive components within Astro pages.

**shadcn/ui** - Component library providing accessible, customizable primitives.

**Tailwind CSS** - Utility-first styling. Use only semantic color tokens defined in `globals.css` - no hardcoded colors or `dark:` prefixes. Theme switching is handled automatically via CSS custom properties.

## Database

**SQLite** - File-based database using WAL mode for concurrent access. Stored at `data/db.sqlite`.

**Drizzle ORM** - Type-safe database abstraction with schema defined in `src/server/db/schema.ts`.

## Validation

**Zod** - Schema validation used for API inputs, queue job payloads, and configuration.

## Logging

**Pino** - Structured JSON logging. Logger configured in `src/server/logger.ts`.

## Containerization

**Docker Compose** - Each project runs in isolated containers (preview server + OpenCode agent).

## AI Integration

**OpenCode SDK** (`@opencode-ai/sdk`) - TypeScript client for communicating with OpenCode AI agents.

**OpenRouter** - LLM provider abstraction, allowing users to select from multiple AI models.
