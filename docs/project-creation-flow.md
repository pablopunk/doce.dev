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

### Parallel Session Initialization (Optimization)

- `session.init()` is called **per-project** after session creation  
- This call is made **asynchronously (fire-and-forget)** and does NOT block user prompt sending
- The parallel execution means init and prompt events arrive concurrently on the event stream
- Init events are processed before prompt events due to OpenCode SDK event ordering

**Flow**:
```
sessionCreate → [async] init() fires → event stream receives events
         ↓
    prompt() fires immediately (doesn't wait)
         ↓
    Both init and prompt events stream concurrently
```

**Result**: Faster perceived response time (user sees first token from init/reasoning while init completes in parallel)

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
sessionCreate → session.create() + [async] init() fires
       ↓
sendUserPrompt → prompt_async() [sends user's request, doesn't wait for init]
       ↓
Both init and prompt events arrive concurrently on event stream
       ↓
SSE idle event detected (from prompt)
       ↓
userPromptCompleted = true, setup.complete sent
       ↓
Chat ready (~15-60s total, depending on LLM response time)
```

**Key Difference**: Init no longer blocks prompt - they execute in parallel for faster setup.

## Template Notes

- Templates are copied for each project as-is
- Per-project sessions initialize with OpenCode SDK's session.init() call
- AGENTS.md is generated dynamically during session.init() (not pre-computed)
- Each project gets its own AGENTS.md based on the project template and selected model
