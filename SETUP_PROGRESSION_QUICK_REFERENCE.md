# Setup Progression - Quick Reference

## Problem in 30 Seconds

Setup appears stuck at "Step 1: Creating project files..." for 20-30 seconds, then jumps to "Step 4: Building your website..." when the agent starts responding. Steps 2 and 3 are never shown.

**Why?** Frontend only checks the event stream for progress. The backend sends state flags to presence API, but the frontend ignores them.

**The Fix:** Add 3 simple checks in SetupStatusDisplay.tsx to monitor the presence polling response.

---

## Current vs Expected

| Time | Current UI | Expected UI |
|------|-----------|------------|
| 0s   | Step 1    | Step 1     |
| 5s   | Step 1    | Step 1     |
| 10s  | Step 1    | Step 1     |
| 15s  | Step 1    | Step 2 ✓ (Docker) |
| 20s  | Step 1    | Step 3 ✓ (Agent) |
| 22s  | Step 1    | Step 4 ✓ (Build) |
| 25s  | Step 4    | Step 4     |
| 40s  | Step 5    | Step 5     |

---

## What's Missing

Three simple checks that should be added to the presence polling handler:

```javascript
// File: src/components/setup/SetupStatusDisplay.tsx
// Location: Inside poll() function, after line 220

if (data.status === 'running' && currentStep < 2) {
  setCurrentStep(2);
}

if (data.bootstrapSessionId && currentStep < 3) {
  setCurrentStep(3);
}

if (data.initialPromptSent && currentStep < 4) {
  setCurrentStep(4);
}
```

That's it. These fields are already being returned by the presence API.

---

## Data Already Available

The presence polling response includes all needed fields:

```json
{
  "status": "running",                    // ← Use for step 2
  "bootstrapSessionId": "session-123",    // ← Use for step 3
  "initialPromptSent": true,              // ← Use for step 4
  "initialPromptCompleted": false,        // ← Already used for step 5
  "setupError": null
}
```

**Current code:** Only checks `initialPromptCompleted` and `setupError`

**Needed:** Also check `status`, `bootstrapSessionId`, and `initialPromptSent`

---

## What Each Step Represents

| Step | Label | What Happens | Duration | Backend Signal |
|------|-------|--------------|----------|-----------------|
| 1 | Files | Project template copied, .env written | 15-30s | status='created' (initial) |
| 2 | Docker | Docker compose up, containers started, health checks pass | 5-15s | status='running' |
| 3 | Agent | OpenCode session created and initialized with model | 1-2s | bootstrapSessionId set |
| 4 | Build | User prompt sent, agent processes and responds | 10-60s | initialPromptSent=true |
| 5 | Done | Agent finished, session idle, setup complete | - | initialPromptCompleted=true |

---

## Backend Flow

```
project.create
  ↓ (status='created')
projectCreate handler (15-30s)
  ↓
dockerComposeUp handler
  ↓ (status='starting')
docker compose up (5-15s)
  ↓
dockerWaitReady handler
  ↓ (status='running') ← STEP 2 TRIGGER
opencodeSessionCreate handler
  ↓ (bootstrapSessionId set) ← STEP 3 TRIGGER
opencodeSessionInit handler
  ↓
opencodeSendInitialPrompt handler
  ↓ (initialPromptSent=true) ← STEP 4 TRIGGER
  🤖 Agent processing (10-60s)
  ↓ (initialPromptCompleted=true) ← STEP 5 TRIGGER
```

---

## Where to Make Changes

**File:** `src/components/setup/SetupStatusDisplay.tsx`

**Function:** `poll()` (lines 202-252)

**Location:** After line 220 where data is parsed

**Current code:**
```typescript
const data = await response.json();
const isPromptCompleted = data.initialPromptCompleted ?? false;

if (data.setupError) {
  setSetupError(data.setupError);
  return;
}
```

**Add before the error check:**
```typescript
const data = await response.json();
const isPromptCompleted = data.initialPromptCompleted ?? false;

// Step progression detection
if (data.status === 'running' && currentStep < 2) {
  setCurrentStep(2);
}
if (data.bootstrapSessionId && currentStep < 3) {
  setCurrentStep(3);
}
if (data.initialPromptSent && currentStep < 4) {
  setCurrentStep(4);
}

if (data.setupError) {
  setSetupError(data.setupError);
  return;
}
```

---

## Verification

After implementing:

1. Create a new project
2. Open DevTools Network tab
3. Look for `POST /api/projects/{id}/presence` requests
4. In the response, verify these fields exist and change:
   - `status`: changes to `'running'` (Docker ready)
   - `bootstrapSessionId`: gets populated (agent initialized)
   - `initialPromptSent`: becomes `true` (prompt sent)
   - `initialPromptCompleted`: becomes `true` (done)
5. UI should show steps 1→2→3→4→5 in sequence

---

## Impact

**Effort:** 4 lines of code

**Complexity:** Trivial (just add three if statements)

**User Experience:** Much better - users see progress instead of apparent freeze

**Risk:** Minimal - just using existing data that's already validated

---

## FAQ

**Q: Why doesn't the event stream handle this?**
A: Event stream is from OpenCode (the agent). It only knows about chat events, not project state like Docker status or session creation.

**Q: Why is the frontend ignoring the presence response?**
A: Historical oversight - the fields were added but the UI code wasn't updated to use them.

**Q: Will this make setup faster?**
A: No, same duration. It just shows progress earlier so users know it's not frozen.

**Q: Can we emit events from the backend?**
A: Yes, but that's more work. Polling approach is simpler and already works.

---

## File Locations

| What | File | Line |
|------|------|------|
| Frontend UI component | `src/components/setup/SetupStatusDisplay.tsx` | 202-252 |
| Backend presence handler | `src/server/presence/manager.ts` | 133-312 |
| Response type definition | `src/server/presence/manager.ts` | 28-48 |
| Docker ready → status='running' | `src/server/queue/handlers/dockerWaitReady.ts` | 71 |
| Agent init → bootstrapSessionId | `src/server/queue/handlers/opencodeSessionCreate.ts` | 46 |
| Prompt sent → initialPromptSent | `src/server/queue/handlers/opencodeSendInitialPrompt.ts` | 57 |

