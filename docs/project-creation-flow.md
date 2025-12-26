# Project Creation Flow (Simplified)

Projects are created through an async queue pipeline. The key optimization is that OpenCode session initialization happens once during template preparation, not per-project.

## The Flow

1. **User Submits Project** → Frontend calls `projects.create` action with prompt/model/images
2. **Project.Create Job** → Queue handler:
   - Generates project name (LLM call)
   - Creates unique slug
   - Allocates ports
   - Copies template to project directory
   - Updates `opencode.json` with selected model
   - Updates DB with initial status
   - Enqueues `docker.composeUp`

3. **Docker Compose Up** → Queue handler:
   - Runs `docker compose up` in project directory
   - Starts preview server + OpenCode containers
   - Enqueues `docker.waitReady`

4. **Docker Wait Ready** → Queue handler:
   - Polls both containers' health endpoints
   - Retries for up to 5 minutes
   - Enqueues `opencode.sessionCreate` when ready

5. **OpenCode Session Create** → Queue handler:
   - Calls `client.session.create()`
   - Gets session ID
   - Stores in DB
   - Enqueues `opencode.sendUserPrompt`

6. **Send User Prompt** → Queue handler:
   - Calls `client.session.promptAsync()` with user's request
   - Attaches uploaded images if any
   - Marks `initialPromptSent = true` in DB

7. **SSE Event Stream** → Frontend connects to `/event` endpoint:
   - Server receives `session.status` events from OpenCode container
   - On first idle event: marks `userPromptCompleted = true`, sends `setup.complete` to UI
   - Frontend shows chat interface

## Why This Architecture

### Pre-Initialized Template

- `session.init()` is called ONCE during template preparation (manual process)
- This call generates `AGENTS.md` which gets committed to the template
- Projects just copy the template + update `opencode.json` with their chosen model
- No LLM call needed per project for initialization

**Result**: 50-100% faster setup (skips 30-60 second init LLM call)

### Session Lifecycle

- Fresh session created per-project (stored in DB)
- OpenCode container reads the pre-initialized AGENTS.md from template
- Container loads user-selected model from updated opencode.json
- User prompt sent to agent with correct model + all project context

### Model Switching

- Template is pre-initialized with a default model
- Per-project, `opencode.json` is updated with user's selected model
- When container starts, it reads the updated config
- ✅ Works seamlessly - no need to re-init

## Completion Detection

The SSE event stream uses idle events to detect completion:

```
Idle event received
       ↓
Mark userPromptCompleted = true in DB
       ↓
Send setup.complete to frontend
       ↓
UI transitions to chat
```

## Database

Key columns tracking the flow:

| Column | Purpose |
|--------|---------|
| `initialPromptSent` | True when user prompt queued |
| `userPromptMessageId` | OpenCode message ID for user prompt |
| `userPromptCompleted` | True when user prompt goes idle |
| `initialPromptCompleted` | Legacy column (kept for backward compat) |
| `bootstrapSessionId` | Session ID for this project |

## Timeline

```
User submits project
       ↓
project.create enqueued
       ↓
docker.composeUp → services starting
       ↓
docker.waitReady → polling health checks
       ↓
sessionCreate → session.create() [no init call]
       ↓
sendUserPrompt → prompt_async() [sends user's request]
       ↓
SSE idle event detected
       ↓
userPromptCompleted = true, setup.complete sent
       ↓
Chat ready (~15-60s total, depending on LLM response time)
```

## Template Pre-Initialization

The template is manually initialized once:

1. Start template with `docker compose up`
2. Call `session.create()`
3. Call `session.init()` with default model + DOCE.md
4. Wait for idle event (AGENTS.md generated)
5. Snapshot project directory including AGENTS.md
6. Commit to repo

All future projects copy this pre-initialized template.
