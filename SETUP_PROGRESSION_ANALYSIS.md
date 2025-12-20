# Setup Step Progression Analysis

## Quick Summary

The setup process appears "stuck" at Step 1 for 20-30 seconds because the frontend only monitors the OpenCode event stream for step progression. However, the backend generates important state signals that are **not being consumed** by the frontend.

**The fix:** Check 3 additional fields from the presence polling response to detect steps 2-4.

---

## Current Implementation

### Step Progression Logic (SetupStatusDisplay.tsx)

The frontend currently has a very limited step progression mechanism:

1. **Step 1 (Files)** - Initial state, hard-coded
   - No trigger detected from backend
   - Stays at step 1 unless events arrive

2. **Step 2 (Docker)** - NEVER TRIGGERED
   - No mechanism advances currentStep from 1 to 2

3. **Step 3 (Agent)** - NEVER TRIGGERED
   - No mechanism advances currentStep from 2 to 3

4. **Step 4 (Build)** - TRIGGERED ONLY BY: `chat.message.delta` events
   - When streaming agent message starts, set currentStep = 4
   - Line 142: `setCurrentStep(4);`

5. **Step 5 (Done)** - TRIGGERED BY: `initialPromptCompleted === true`
   - Detected via polling `/api/projects/{id}/presence`
   - When `data.initialPromptCompleted === true`, set currentStep = 5 and reload
   - Lines 229-237

**Problem:** Steps 1→2, 2→3, and 3→4 have NO automatic progression. The UI jumps from step 1 directly to step 4 once agent starts responding.

---

## Expected Architecture vs Reality

### What SHOULD Trigger Each Step

#### Step 1→2: Docker Setup
**What should trigger:** `project.status = "running"`

**Backend signals:**
- ✓ dockerComposeUp handler: sets status to "starting" (line 23)
- ✓ dockerWaitReady handler: confirms status to "running" (line 71)
- ✗ Frontend doesn't poll or watch `project.status`

#### Step 2→3: Agent Session Setup
**What should trigger:** `bootstrapSessionId` is set

**Backend signals:**
- ✓ opencodeSessionCreate handler: sets bootstrapSessionId in DB (line 46)
- ✗ Frontend doesn't poll for bootstrapSessionId changes

#### Step 3→4: Send Initial Prompt
**What should trigger:** `initialPromptSent = true`

**Backend signals:**
- ✓ opencodeSendInitialPrompt handler: marks initialPromptSent=true (line 57)
- ✗ Frontend doesn't poll for initialPromptSent flag

**Current behavior:** Frontend detects step 4 via chat.message.delta (event stream), which is incorrect - by then the agent is already responding.

#### Step 4→5: Completion
**What should trigger:** `initialPromptCompleted = true`

**Backend signals:**
- ✓ Event stream detects `session.status == "idle"` and marks initialPromptCompleted=true (event.ts line 177-180)
- ✓ Presence system also detects session idle via direct API call (manager.ts line 193-204)
- ✓ Frontend polls for initialPromptCompleted and reloads page (SetupStatusDisplay lines 221-237)
- **WORKING** ✓

---

## Root Cause Analysis

### Why Setup is Stuck at Step 1

**Primary Issue:** Step progression relies ONLY on OpenCode event stream, not on backend status signals.

**Sequence of what ACTUALLY happens:**

1. **Step 1 (Files):** Project created
   - projectCreate handler runs ✓
   - Enqueues dockerComposeUp ✓
   - **Frontend never advances** - no event triggers step transition

2. **[Time passes: 10-30 seconds for docker/opencode to start]**

3. **Step 2-3 (Docker + Agent Init):** Happens in background
   - dockerWaitReady confirms running ✓
   - opencodeSessionCreate creates session, sets bootstrapSessionId ✓
   - opencodeSessionInit initializes agent ✓
   - **Frontend still at step 1** - has no signal

4. **Step 4 (Build):** Agent starts responding
   - opencodeSendInitialPrompt sends the user's prompt ✓
   - OpenCode processes it, streams chat.message.delta events ✓
   - **Frontend sees chat.message.delta and jumps to step 4** ✓
   - **Steps 2-3 are skipped in UI**

5. **Step 5 (Done):** Agent finishes
   - OpenCode emits session.status=idle ✓
   - Event stream marks initialPromptCompleted=true ✓
   - Presence polling detects initialPromptCompleted=true ✓
   - **Frontend advances to step 5** ✓

### Why It Feels "Stuck"

The UI shows step 1 for **10-30+ seconds** until the agent actually starts responding and sends chat.message.delta events. During this time:
- Docker is starting (5-15 seconds)
- OpenCode is starting (5-15 seconds)
- Session is created and initialized (1-2 seconds)
- Initial prompt is queued but not processed (0-5 seconds)

All of this happens **silently** with no UI feedback.

---

## Missing Pieces

### 1. Frontend Step 1→2 Detection (CRITICAL)
**Missing:** Check for `status === "running"` in presence polling

**Field available:** `response.status` is returned by `/api/projects/{id}/presence`

**Where generated:** `src/server/queue/handlers/dockerWaitReady.ts` line 71

**Why it matters:** Users need feedback that Docker is starting/ready

### 2. Frontend Step 2→3 Detection (CRITICAL)
**Missing:** Check for `bootstrapSessionId !== null` in presence polling

**Field available:** `response.bootstrapSessionId` is returned by `/api/projects/{id}/presence`

**Where generated:** `src/server/queue/handlers/opencodeSessionCreate.ts` line 46

**Why it matters:** Users need feedback that agent session is initialized

### 3. Frontend Step 3→4 Detection (CRITICAL)
**Missing:** Check for `initialPromptSent === true` in presence polling

**Field available:** `response.initialPromptSent` is returned by `/api/projects/{id}/presence`

**Where generated:** `src/server/queue/handlers/opencodeSendInitialPrompt.ts` line 57

**Why it matters:** Users need feedback that their prompt is being processed

**Current behavior:** This is detected via chat.message.delta from event stream, which is incorrect - by then the agent is already responding (should be step 4)

### 4. Event Stream Signals
**Status:** The event stream is working correctly, but only for final steps

**Event stream detects:**
- ✓ session.status=idle (marks initialPromptCompleted)
- ✓ chat.message.delta (used for step 4, but shouldn't drive progression)

**Event stream doesn't know about:**
- Docker status changes (project-level, not OpenCode agent)
- bootstrapSessionId creation (project-level, not OpenCode agent)
- initialPromptSent flag (project-level, not OpenCode agent)

---

## Data Flow: What Frontend Can Access

### Via Polling `/api/projects/{id}/presence` (POST)
Returns `PresenceResponse` containing:

```typescript
{
  projectId: string;
  status: ProjectStatus;              // 'created' | 'starting' | 'running' | ...
  viewerCount: number;
  previewUrl: string;
  previewReady: boolean;
  opencodeReady: boolean;
  message: string | null;
  nextPollMs: number;
  
  // THESE ARE RETURNED BUT MOSTLY IGNORED ✓
  initialPromptSent: boolean;         // Step 3→4 trigger - IGNORED
  initialPromptCompleted: boolean;    // Step 4→5 trigger - USED
  prompt: string;
  model: string | null;
  slug: string;
  bootstrapSessionId: string | null;  // Step 2→3 trigger - IGNORED
  setupError: string | null;          // Error detection - USED
}
```

**Current frontend polling (SetupStatusDisplay.tsx):**
- Polls every 2.5 seconds
- Only checks `data.initialPromptCompleted` and `data.setupError`
- **IGNORES** `status`, `bootstrapSessionId`, `initialPromptSent`

---

## Solution Map

### Option A: Polling-Based (Simplest - RECOMMENDED)
Enhance SetupStatusDisplay.tsx presence polling to detect all progression:

```typescript
const isStep1 = status !== 'running'
const isStep2 = status === 'running' && !bootstrapSessionId
const isStep3 = bootstrapSessionId && !initialPromptSent
const isStep4 = initialPromptSent && !initialPromptCompleted
const isStep5 = initialPromptCompleted
```

**Pros:** 
- Simple, no architectural changes needed
- Data already available in presence response
- Only 3 additional checks needed

**Cons:** 
- Relies on polling intervals (2.5 second delay)
- Laggy transitions

### Option B: Event-Stream Based
Create a new backend endpoint that emits project-level events:
- `project.status.changed` - when status changes to running
- `project.bootstrapSessionId.set` - when session ID is created
- `project.initialPromptSent` - when prompt is sent
- `project.initialPromptCompleted` - when agent finishes (already in event stream)

**Pros:** 
- Instant feedback
- Better UX
- Fewer polling requests

**Cons:** 
- Need new SSE endpoint and signaling mechanism
- More complex

### Option C: Hybrid (Better)
- Polling detects major state changes (status, bootstrapSessionId, initialPromptSent)
- Complements event stream for initial prompt completion
- Gives relatively fast feedback (polling runs every 2.5s) + instant completion detection

---

## Implementation Checklist

- [ ] **Frontend:** Update SetupStatusDisplay.tsx to track status === 'running'
- [ ] **Frontend:** Update SetupStatusDisplay.tsx to track bootstrapSessionId !== null
- [ ] **Frontend:** Update SetupStatusDisplay.tsx to track initialPromptSent === true
- [ ] **Frontend:** Update logic to set currentStep based on these flags
- [ ] **Testing:** Create a new project and verify all steps progress in correct order
- [ ] **Logging:** Add debug logging to track transitions (optional)

---

## Code Locations

### SetupStatusDisplay.tsx
- **File:** `src/components/setup/SetupStatusDisplay.tsx`
- **Polling loop:** Lines 202-252
- **Current checks:** Line 221 (only initialPromptCompleted)
- **Needed changes:** Add status, bootstrapSessionId, initialPromptSent checks after line 220

### Presence Manager
- **File:** `src/server/presence/manager.ts`
- **Handler:** `handlePresenceHeartbeat` (lines 133-312)
- **Response type:** `PresenceResponse` (lines 28-48)
- **Status:** All necessary fields are returned

### Queue Handlers
- **dockerWaitReady.ts:** Sets status='running' (line 71)
- **opencodeSessionCreate.ts:** Sets bootstrapSessionId (line 46)
- **opencodeSendInitialPrompt.ts:** Sets initialPromptSent (line 57)

---

## Verification Steps

After implementing the fix:

1. Create a new project
2. Watch browser DevTools Network tab for presence requests
3. Verify progression:
   - Step 1→2: Appears when `status === 'running'`
   - Step 2→3: Appears when `bootstrapSessionId` is populated
   - Step 3→4: Appears when `initialPromptSent === true`
   - Step 4→5: Appears when `initialPromptCompleted === true`

4. Timing verification:
   - Total setup time: typically 30-90 seconds
   - Step 1-2: Usually 15-30 seconds
   - Step 2-3: Usually < 5 seconds
   - Step 3-4: Usually < 5 seconds
   - Step 4-5: Variable (depends on model and prompt complexity, 10-60 seconds)

