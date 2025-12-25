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

## Key Features

### Files Tab
The project page now includes a "Files" tab alongside the "Preview" tab:
- Browse project source files in a collapsible file tree (from `src/` folder only)
- Click any file to open it in Monaco Editor (read-only)
- Last selected file is remembered and restored on tab switch
- Resizable separator between file tree and editor

**Components:**
- `src/components/files/FileTree.tsx` - Recursive file/folder tree display
- `src/components/files/ReadOnlyEditor.tsx` - Monaco editor with syntax highlighting
- `src/components/files/FilesTab.tsx` - Container managing tree + editor + resizing

**Backend:**
- `src/pages/api/projects/[id]/files.ts` - API endpoint for listing files and fetching content
  - `GET /api/projects/[id]/files` → Returns file tree from `src/`
  - `GET /api/projects/[id]/files?path=...` → Returns file content

## Documentation

See `docs/` for implementation details:

- `docs/tech-stack.md` - Technology stack and dependencies
- `docs/architecture/` - System architecture documentation
  - `queue-system.md` - Job queue, handlers, worker flow
  - `docker-management.md` - Container lifecycle, compose operations
  - `opencode-integration.md` - SDK client, SSE event normalization
  - `database-schema.md` - Tables, relationships
  - `presence-system.md` - Real-time state, heartbeats, auto start/stop
  - `project-lifecycle.md` - Creation & deletion flows, status states
  - `model-selection.md` - AI model switching in chat
  - `project-creation-flow.md` - Split prompt tracking during project setup
