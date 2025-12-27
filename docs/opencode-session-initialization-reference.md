# OpenCode Web Reference Implementation Analysis

## Summary: Session Creation & Chat Initialization Flow

The OpenCode reference implementation (in the official `opencode` repository) demonstrates a **clear separation between session creation and prompt sending**. There is **NO implicit initialization call** - instead, sessions are created empty and prompts are sent directly.

---

## Key Findings

### 1. Session Creation: `client.session.create()`

**File:** `/packages/app/src/components/prompt-input.tsx` (lines 828-832)

```typescript
let existing = info()
if (!existing) {
  const created = await sdk.client.session.create()
  existing = created.data ?? undefined
  if (existing) navigate(existing.id)
}
```

**What it does:**
- Creates a new empty session
- Returns a `Session.Info` object with an `id` field
- NO parameters needed (optional: `directory`, `parentID`, `title`)
- Session is now ready to receive prompts

---

### 2. Sending a Prompt: `client.session.prompt()`

**File:** `/packages/app/src/components/prompt-input.tsx` (lines 932-938)

```typescript
sdk.client.session.prompt({
  sessionID: existing.id,
  agent,
  model,
  messageID,
  parts: requestParts,
})
```

**What happens:**
- Sends user message to an existing session
- Creates a user message from the parts
- Automatically starts processing (LLM inference)
- Returns immediately OR streams response (depending on variant)

---

### 3. The `init()` Method: A Separate Feature

**File:** OpenCode SDK (`/packages/sdk/js/src/v2/gen/sdk.gen.ts`)

The `init()` method exists but is:
- **NOT called automatically**
- **NOT required for first prompts**
- Used specifically to **analyze the project and generate AGENTS.md**

```typescript
public init<ThrowOnError extends boolean = false>(
  parameters: {
    sessionID: string
    directory?: string
    modelID?: string
    providerID?: string
    messageID?: string
  },
  options?: Options<never, ThrowOnError>,
)
```

**Purpose:**
- Runs the `Command.Default.INIT` command
- Generates project-specific agent configurations
- Optional optimization step (not blocking)

---

## The Correct Flow: OpenCode Web App

### Step 1: Create Session
```typescript
const session = await client.session.create()
// session.id is now available
// Session is empty, ready to receive prompts
```

### Step 2: Send Prompt (Directly)
```typescript
client.session.prompt({
  sessionID: session.id,
  agent: "agent-name",
  model: { providerID: "openrouter", modelID: "model-id" },
  messageID: generateId(),
  parts: [
    { type: "text", text: "user prompt" },
    // ... file attachments, images, etc
  ]
})
```

### That's It!
The prompt is sent immediately. There is **no init() call** in the critical path.

---

## Why No `init()` in the Hot Path?

1. **Non-blocking operation**: `init()` generates AGENTS.md in the background
2. **First prompt doesn't need it**: The agent can work without AGENTS.md initially
3. **Optimization**: AGENTS.md helps with better code understanding, but isn't required for basic functionality
4. **Fire-and-forget pattern**: Can be started in the background after session creation

---

## Server Implementation Details

### Session Creation Endpoint
**File:** `opencode/src/server/server.ts`

```
POST /session
Response: Session.Info {
  id: string
  title?: string
  directory?: string
  // ...
}
```

Creates a new session record. That's all.

### Prompt Endpoint
**File:** `opencode/src/server/server.ts`

```
POST /session/{sessionID}/message
Body: SessionPrompt.PromptInput {
  sessionID: string
  messageID?: string
  model?: { providerID, modelID }
  agent?: string
  parts: Part[]
}
```

Sends a message to the session. The server automatically:
1. Creates a user message
2. Initializes session state if needed
3. Starts LLM processing
4. Returns the assistant response

### Init Endpoint
**File:** `opencode/src/server/server.ts`

```
POST /session/{sessionID}/init
Body: {
  modelID: string
  providerID: string
  messageID: string
}
```

Runs the INIT command to generate AGENTS.md. Optional.

---

## How the SDK Client Works

**File:** `/packages/sdk/js/src/v2/client.ts`

```typescript
export function createOpencodeClient(config?: Config) {
  const client = createClient(config)
  return new OpencodeClient({ client })
}
```

The `OpencodeClient` class provides:
- `session.create()` - create new session
- `session.prompt()` - send prompt, streaming response
- `session.promptAsync()` - send prompt, returns immediately
- `session.init()` - initialize session (background task)
- `session.messages()` - fetch session messages
- etc.

---

## Example: SDK Usage

**File:** `/packages/sdk/js/example/example.ts`

```typescript
const client = createOpencodeClient({ baseUrl: server.url })

// For each file: create session, send prompt
const session = await client.session.create()
await client.session.prompt({
  path: { id: session.data.id },
  body: {
    parts: [
      {
        type: "file",
        mime: "text/plain",
        url: `file://${file}`,
      },
      {
        type: "text",
        text: `Write tests for every public function in this file.`,
      },
    ],
  },
})
```

Notice: **No init() call**. Straight from create → prompt.

---

## Comparing to doce.dev Current Implementation

### Current doce.dev Pattern:

1. **Create session** ✓
2. **Call `session.init()` in background** (fire-and-forget)
3. **Send user prompt** ✓

**Problem:** Calling `init()` is unnecessary. The prompt works without it.

### Correct Pattern:

1. **Create session** ✓
2. **Send user prompt immediately** ✓
3. (Optional: Call `init()` in background if you want AGENTS.md)

---

## Key Architectural Insights

### Session Lifecycle

1. **Empty State**: Created via `create()`, no content
2. **User Message**: First prompt creates a user message
3. **Processing**: Server automatically initializes context if needed
4. **Response**: LLM processes and returns assistant message

### No Mandatory Initialization

- Sessions are **stateless containers** for conversations
- The first prompt **implicitly initializes** whatever context is needed
- `init()` is an **optional optimization** for project analysis

### Concurrency Model

- Multiple prompts can be sent to the same session
- Server handles message ordering and context management
- Sessions are designed for **stateful conversations**

---

## Recommendations for doce.dev

1. **Remove the `init()` call** from the hot path - it's not needed
2. **Send user prompt immediately** after session creation
3. If you want AGENTS.md generation:
   - Do it once during project setup
   - Or run it in background (fire-and-forget)
   - But don't block user prompts on it

---

## Implementation Pattern Summary

```
// CORRECT: OpenCode reference pattern
const session = await client.session.create()
await client.session.prompt({
  sessionID: session.id,
  // ... prompt details
})

// UNNECESSARY: doce.dev's extra init() call
// await client.session.init({ sessionID, model, ... })
// ^ This can be background/optional, not required
```

The reference implementation proves: **Create → Prompt. Done.**
