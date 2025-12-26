# doce.dev

> Delicious Open Code Environments

## About this project

An open-source, self-hostable web UI for building and deploying websites with AI agents. Think v0, Lovable, or Bolt – but self-hosted and community-driven. Built on top of the OpenCode SDK to provide a full-featured AI development environment accessible anywhere.

## Rules for agentic development

* Always use the tool `context7` to get appropiate documentation for every part of the stack you're working on
* When asked to manually test something in the browser/UI, you can use the tool `chrome-devtools` to navigate pages and debug logs/network requests
* When possible, split task into smaller To Dos so they can be tackled by subagents
* Always read @AGENTS.md and update it when it's needed, either one adding new features/architecture that make it incomplete or when modifying existing ones that make it outdated
* All code modifications/additions should adhere to clean code principles defined below
* Always use `pnpm` for everything, never `npm` nor `yarn` nor `bun`
* When debugging problems, be proactive (with read-only actions please), i.e. you can always get more info running DB queries yourself, checking docker logs from the CLI, running the server yourself in the background piping the logs to a file... Be creative, without making destructive operations just for debugging.

## Clean code

* Separate domains with folders. Nest as much as you want/need.
* Use abstractions for everything that's not in the domain of the file you're working on.
* Functions should have one purpose only, and have as few lines as possible. When performing complex operations, or just several actions, break them into smaller functions. Again, nest as much as you want.
* Function code should declare what it's doing, instead of how it's doing it, i.e. a function that calls 10 smaller functions in a row is more readable than a function that does 10 things with simple logic.
* Files should have one clear purpose, defined by the name of the file.
* Avoid complex UI components, always break them into smaller components, in nested folders if needed.
* Always think about the MVC pattern, but applied to our framework (model=db, view=components, controller=actions), to separate concerns.

## Tech Stack

### Package Manager
**pnpm** - Fast, disk-efficient package manager. Always use `pnpm`, never `npm`, `yarn`, or `bun`.

### Language
**TypeScript** - Used throughout for type safety. Strict mode enabled.

### Framework
**Astro v5** - Full-stack framework providing:
- Astro Pages for file-based routing
- Astro Actions for type-safe server-side operations like CRUD
- React integration for interactive components
- SSR with on-demand rendering

### UI
**React** - Used for all interactive components within Astro pages.

**shadcn/ui** - Component library providing accessible, customizable primitives.

**Tailwind CSS** - Utility-first styling. Use only semantic color tokens defined in `globals.css` - no hardcoded colors or `dark:` prefixes. Theme switching is handled automatically via CSS custom properties.

### Database
**SQLite** - File-based database using WAL mode for concurrent access. Stored at `data/db.sqlite`.

**Drizzle ORM** - Type-safe database abstraction with schema defined in `src/server/db/schema.ts`.

### Validation
**Zod** - Schema validation used for API inputs, queue job payloads, and configuration.

### Logging
**Pino** - Structured JSON logging. Logger configured in `src/server/logger.ts`.

### Containerization
**Docker Compose** - Each project runs in isolated containers (preview server + OpenCode agent).

### AI Integration
**OpenCode SDK** (`@opencode-ai/sdk`) - TypeScript client for communicating with OpenCode AI agents.

**OpenRouter** - LLM provider abstraction, allowing users to select from multiple AI models.


## Documentation

See `docs/` for implementation details:

- `docs/queue-system.md` - Job queue, handlers, worker flow
- `docs/docker-management.md` - Container lifecycle, compose operations
- `docs/opencode-integration.md` - SDK v2 client, SSE event normalization
- `docs/database-schema.md` - Tables, relationships
- `docs/presence-system.md` - Real-time state, heartbeats, auto start/stop
- `docs/project-lifecycle.md` - Creation & deletion flows, status states
- `docs/model-selection.md` - AI model switching in chat
- `docs/project-creation-flow.md` - Split prompt tracking during project setup
