# OpenCode Session init() Calls - Complete Analysis

## Summary
There is **only ONE actual call to `session.init()`** in the entire codebase, located in the queue handler that creates OpenCode sessions. All other matches are comments or documentation references.

---

## ACTUAL INIT() CALL LOCATION

### File: `/Users/pablopunk/src/doce.dev/src/server/queue/handlers/opencodeSessionCreate.ts`

**Line 159**: `await client.session.init({`

**Full Context (Lines 150-199):**
```typescript
/**
 * Initialize a session with exponential backoff retry on failure.
 * Errors are logged but don't block the user prompt from being sent.
 */
async function initializeSessionWithRetry(
	client: ReturnType<typeof createOpencodeClient>,
	sessionId: string,
	modelInfo: { providerID: string; modelID: string },
	projectId: string,
	attemptNumber = 1,
	maxAttempts = 3,
): Promise<void> {
	try {
		await client.session.init({                           // ← LINE 159: ACTUAL CALL
			sessionID: sessionId,
			providerID: modelInfo.providerID,
			modelID: modelInfo.modelID,
			messageID: `msg_init_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		});

		logger.debug(
			{ projectId, sessionId, attempt: attemptNumber },
			"Session initialization completed",
		);
	} catch (error) {
		if (attemptNumber < maxAttempts) {
			const delayMs = Math.min(10000, 1000 * 2 ** (attemptNumber - 1));
			logger.warn(
				{
					projectId,
					sessionId,
					attempt: attemptNumber,
					maxAttempts,
					nextRetryMs: delayMs,
					error: error instanceof Error ? error.message : String(error),
				},
				"Session initialization failed, retrying",
			);

			await new Promise((resolve) => setTimeout(resolve, delayMs));
			return initializeSessionWithRetry(
				client,
				sessionId,
				modelInfo,
				projectId,
				attemptNumber + 1,
				maxAttempts,
			);
		}

		// Max attempts exceeded
		throw error;
	}
}
```

**Call Flow:**
- Called from: `handleOpencodeSessionCreate()` at line 120 as a **fire-and-forget** operation
- Pattern: `void initializeSessionWithRetry(...).catch((error) => { ... })`
- Retry Logic: Up to 3 attempts with exponential backoff (1s, 2s, 4s, max 10s)
- Non-blocking: Errors don't prevent user prompts from being sent
- Parameters passed:
  - `sessionID`: The session ID returned from `client.session.create()`
  - `providerID`: "openrouter" (default) or from opencode.json
  - `modelID`: "google/gemini-2.5-flash" (default) or from opencode.json
  - `messageID`: Unique ID for the init message

---

## COMMENTS REFERENCING SESSION.INIT (NOT ACTUAL CALLS)

### 1. File: `/Users/pablopunk/src/doce.dev/src/server/queue/enqueue.ts`
**Line 142**: Comment only
```typescript
/**
 * Enqueue sending the user's actual prompt (the project prompt).
 * This is called after session.init completes.
 */
```

### 2. File: `/Users/pablopunk/src/doce.dev/src/server/db/schema.ts`
**Line 75**: Comment only
```typescript
// User prompt tracking - session.init is now pre-initialized in template
```

### 3. File: `/Users/pablopunk/src/doce.dev/src/server/queue/handlers/opencodeSendUserPrompt.ts`
**Line 16**: Comment only
```typescript
/**
 * Handler for sending the user's actual project prompt.
 * This is called after session.init completes (which triggers AGENTS.md generation).
 */
```

### 4. File: `/Users/pablopunk/src/doce.dev/src/server/presence/manager.ts`
**Line 45**: Comment only
```typescript
// Prompt tracking (session.init no longer per-project)
```

### 5. File: `/Users/pablopunk/src/doce.dev/src/pages/api/projects/[id]/opencode/event.ts`
**Lines 84, 88, 122**: Comments only
```typescript
// Line 84: First idle = user prompt completed (session.init already done in template)
// Line 88: Check if the user prompt has completed (session.init was done in template).
// Line 122: First idle event = user prompt completed (session.init was pre-done in template)
```

---

## QUEUE HANDLERS FOLDER STRUCTURE

Location: `/Users/pablopunk/src/doce.dev/src/server/queue/handlers/`

**14 Handler Files (sorted by function type):**

### Docker Management (4 files)
- `dockerComposeUp.ts` - Brings up docker containers
- `dockerEnsureRunning.ts` - Ensures containers are running
- `dockerStop.ts` - Stops containers
- `dockerWaitReady.ts` - Waits for containers to be ready

### OpenCode Session (3 files)
- `opencodeSessionCreate.ts` ← **Contains the ONLY `session.init()` call**
- `opencodeSendInitialPrompt.ts` - Sends the initial setup prompt
- `opencodeSendUserPrompt.ts` - Sends the user's project prompt

### Production Deployment (4 files)
- `productionBuild.ts` - Builds the project for production
- `productionStart.ts` - Starts the production deployment
- `productionStop.ts` - Stops production deployment
- `productionWaitReady.ts` - Waits for production to be ready

### Project Lifecycle (3 files)
- `projectCreate.ts` - Creates a new project
- `projectDelete.ts` - Deletes a project
- `projectsDeleteAllForUser.ts` - Deletes all projects for a user

---

## KEY ARCHITECTURAL INSIGHTS

### 1. **Fire-and-Forget Pattern**
The `session.init()` call is intentionally **non-blocking**:
```typescript
void initializeSessionWithRetry(client, sessionId, modelInfo, project.id)
	.catch((error) => {
		logger.error(..., "Session initialization failed after retries");
		// Non-fatal: session.init failure doesn't block user prompts
	});
```

### 2. **Execution Timeline**
```
1. handleOpencodeSessionCreate() [line 15]
   ├─ Create session ID via client.session.create() [line 74]
   ├─ Store session ID in DB [line 104]
   ├─ Start session.init() in background [line 120] ← FIRE-AND-FORGET
   │   └─ initializeSessionWithRetry() [line 150]
   │       └─ await client.session.init(...) [line 159] ← ACTUAL CALL
   │
   └─ Enqueue user prompt immediately [line 139] ← Can run while init() still processing
       └─ This will be sent BEFORE session.init() completes
```

### 3. **Retry Strategy**
- **Max Attempts**: 3
- **Backoff**: Exponential (1s, 2s, 4s, max 10s between retries)
- **Error Handling**: Non-fatal - logged but doesn't block user prompts

### 4. **Model Configuration**
Session init receives model information:
- **Default**: `providerID: "openrouter"`, `modelID: "google/gemini-2.5-flash"`
- **Source**: Can be overridden via `opencode.json` in the project
- **Storage**: Model info stored in database after session creation

### 5. **Related Dependencies**
Files that interact with this flow but don't call init():
- `/src/server/queue/handlers/opencodeSendUserPrompt.ts` - Waits for init to complete
- `/src/pages/api/projects/[id]/opencode/event.ts` - Monitors init completion via idle events
- `/src/server/db/schema.ts` - Tracks init state
- `/src/server/presence/manager.ts` - Manages session state

---

## SEARCH RESULTS SUMMARY

| Search Term | Files Found | Type |
|------------|------------|------|
| `session.init` | 1 (+ 5 comments) | 1 call, 5 references |
| `opencodeSessionInit` | 0 | N/A |
| `.init(` | 1 | 1 call in opencodeSessionCreate.ts |
| `SessionInit` | 0 | N/A |

**Total Files Analyzed**: 100+ source files
**Actual init() Calls**: 1
**Comment References**: 5
