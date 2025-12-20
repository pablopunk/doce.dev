# doce.dev

> Delicious Open Code Environments

## About this project

This project aims to provide a web UI that's easily self-hosted so users can build and deploy their own websites using AI agents.

It's basically a UI on top of the opencode SDK. Users can create a project with a prompt that describe their website, and that will:

* Create a new project in the DB
* Spin up a docker container with pnpm/node/opencode installed
* Run the opencode server on the docker container
* Connect to the opencode server and start the agent with the initial prompt, which should bootstrap the website
* Our UI should basically be a split between a chat interface on the left and the web preview on the right
* Since our chat is just a UI for the opencode server, it will always be on-par with opencode features, with tool calls, subagents, etc
* User can keep sending messages to interact with the opencode agent, asking to modify the website or whatever they want

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

## Architecture (check context7 for more details on each component)

* pnpm
* typescript
* astro v5 for the framework
  * use astro actions for server-side operations, like CRUD, api calls, etc
  * use astro pages for the UI
  * use react for the UI components
  * use layouts as top-level components so each page should be inside a layout
* shadcn/ui is the main UI framework:
  * choose CSS Variables instead of utility classes
  * use their components whenever you can
  * use their icons whenever you can
  * all
* tailwindcss for styling
  * v4 without any config in js
* drizzle for the database ORM
  * use sqlite with a file both for dev and production
  * abstract everything db-related into model files, i.e. each model (e.g. User or Project) should have its own file with all the operations
  * handle migrations and bootstrapping a new db
* pino for logging. Use it for development and production
* zod for validation

## UI Overview

* Setup (first time, admin user creation and openrouter API key setup)
* Navbar
  * Logo
  * Dark/Light mode toggle
  * Settings
* Dashboard
  * Prompt input to create a new project
    * Model selector from opencode's models
  * Projects grid
* Project
  * Chat UI (opencode frontend)
    * Shows all history, including messages and tool calls (in a compact way)
    * Shows opencode's To Do list
    * Allows sending messages and images to opencode
  * Preview UI
    * Shows the website preview, which is just a `pnpm run dev` server inside the project's docker container
    * Shows the website's URL
    * Terminal dock on the bottom. Logs from the docker container are streamed via SSE.
* Settings
  * Openrouter API key
  * Default model
  * Delete all projects
* Queue (admin)
  * View background jobs
  * Pause/resume worker
  * Cancel/retry/force-unlock jobs

## Project Setup Phase System

The project creation process is tracked through a queue-integrated `setupPhase` field that progresses through the following stages:

**Setup Phase States:**
```
not_started
  → (queue: project.create)
creating_files
  → (queue: docker.composeUp)
starting_docker
  → (queue: docker.waitReady)
initializing_agent
  → (queue: opencode.sessionCreate)
waiting_completion (Build)
  → (queue: opencode.sendInitialPrompt + opencode.waitIdle)
completed
```

If any queue job fails:
- `setupPhase` is automatically set to `failed`
- UI shows error state with retry button
- Queue system automatically retries on configurable schedule

**Key Features:**
- **Automatic tracking**: Each queue handler updates setupPhase when it starts/completes
- **Refresh recovery**: Users can refresh at any stage and see correct status (no more "Waiting for opencode" during file creation!)
- **User-friendly messages**: Setup page shows which step is currently running (e.g., "Sending your prompt...")
- **Spinner feedback**: Visual spinner indicates ongoing setup
- **Error handling**: Both automatic retry and manual retry button on UI
- **Preview protection**: Preview doesn't start until `setupPhase === "completed"` to avoid showing untouched template

**UI Behavior:**
- While `setupPhase !== "completed"`: Show "Setting up your project..." page with spinner and current step message
- When `setupPhase === "completed"`: Show chat + preview split
- If `setupPhase === "failed"`: Show error message with retry button

**Implementation Details:**
- `setupPhase` column added to `projects` table as enum field
- `updateProjectSetupPhase(id, phase)` helper function in projects.model.ts
- Each queue handler wraps logic in try-catch to set phase to "failed" on error before re-throwing
- PresenceResponse includes `setupPhase` field for client polling
- SetupStatusDisplay component provides user-friendly status UI

## Other features

* Use openrouter for all models. For now we'll just list these for the initial prompt and the chat UI:
  * `openai/gpt-5.2` (openai's top model)
  * `openai/gpt-4.1-mini` (openai's fastest model)
  * `anthropic/claude-opus-4.5` (anthropic's top model)
  * `anthropic/claude-haiku-4.5` (anthropic's fastest model)
  * `google/gemini-3-pro` (google's top model)
  * `google/gemini-2.5-flash` (google's fastest model)
* Projects are automatically named with AI, with a quick model that uses the prompt to generate a small name
* For small operations (like naming project, and future AI-led things), use a fast model like `google/gemini-2.5-flash`
* Projects are deleted from the grid optimistically
* Destructive / lifecycle operations run via a DB-backed queue
  * Tables: `queue_jobs`, `queue_settings`
  * Worker: in-process loop started from `src/middleware.ts`
  * Orchestration rule: only queue handlers run `docker compose`
  * Admin UI: `/queue` (controls + job inspection)
* Even though we use astro actions for everything, we'll use astro's API routes for other stuff like streaming and SSE
* There should be a data/ directory containing the db file and all projects (in folders)
* Projects are just folders with a docker-compose.yml that exposes PWD and exposes the development port
* Since we can have several projects running at the same time, all exposed ports should be different/random, but persisted
* Containers run on-demand: they start when a user views a project page and stop after 3 minutes of inactivity
* The host app proxies all opencode API calls - browser never connects directly to container ports
* Use `@opencode-ai/sdk` for opencode server communication
