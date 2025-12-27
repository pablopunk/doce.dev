# COMPREHENSIVE REMEDIATION PLAN FOR DOCE.DEV

**Date Created**: December 27, 2025  
**Analysis Completed**: Full codebase audit  
**Total Issues Found**: 73 across 5 categories  
**Estimated Effort**: 15-18 weeks (5 developers concurrent)

---

## EXECUTIVE SUMMARY

### Overview
- **Critical Issues**: 4 (must fix, blocking deployment)
- **High Priority**: 18 (fix next sprint)
- **Medium Priority**: 27 (quarterly roadmap)
- **Low Priority**: 24 (technical debt)

### Quick Impact Assessment
- **Queue System**: Can silently crash and halt all processing
- **Lock System**: Race condition allows concurrent start/stop conflicts
- **UI Stability**: 4 major components can crash entire page without error boundaries
- **Memory**: EventSource connections accumulate, causing leaks
- **Documentation**: Critical information is missing or outdated
- **OpenCode Integration**: Missing ~100 lines of manual code the SDK provides
- **Code Quality**: Multiple violations of AGENTS.md clean code principles

---

## PHASE 1: CRITICAL FIXES (Week 1-2) ⚠️ BLOCKING

These **must be fixed** before any production deployment.

### Category A: Critical Bugs (4 issues)

#### A1. Queue Worker Silent Crash
**File**: `src/server/queue/queue.worker.ts:130-132`  
**Severity**: 🔴 CRITICAL  
**Impact**: Queue processing completely halts if any error occurs  
**Current Code**:
```typescript
loop().catch((error) => {
    logger.error({ error, workerId }, "Queue worker loop crashed");
});
```
**Problem**: Worker dies silently with no restart mechanism

**Fix Strategy**:
1. Add exponential backoff restart logic
2. Max 3 restarts before alerting
3. Log each restart attempt
4. Set alerting/monitoring threshold

**Success Criteria**:
- Worker automatically restarts on crash
- Alert sent if restart count exceeds 3
- No more than 5-second downtime between restart attempts

**Estimated Effort**: 2 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 1 (Lead - Reliability)

---

#### A2. Race Condition in Project Lock
**File**: `src/server/presence/manager.ts:71-88`  
**Severity**: 🔴 CRITICAL  
**Impact**: Multiple concurrent start/stop operations on same project  
**Current Code**:
```typescript
async function acquireLock(projectId: string): Promise<() => void> {
    while (projectLocks.has(projectId)) {
        await projectLocks.get(projectId);  // BUG: Race between check and get
    }
    // Another request could acquire lock here before this code runs
    let releaseFn: () => void;
    const lockPromise = new Promise<void>((resolve) => {
        releaseFn = resolve;
    });
    projectLocks.set(projectId, lockPromise);
    return () => {
        projectLocks.delete(projectId);
        releaseFn!();
    };
}
```

**Problem**: Time-of-check-time-of-use (TOCTOU) vulnerability

**Fix Strategy**:
1. Replace with atomic operation or proper mutex
2. Option A: Use `async-lock` package
3. Option B: Use Map.set() as atomic operation with versioning
4. Add unit tests with concurrent stress testing

**Success Criteria**:
- No race conditions under 100 concurrent requests
- Lock acquisition is strictly sequential per project
- All 5 test scenarios pass

**Estimated Effort**: 3 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 1 (Lead - Reliability)

**Testing Checklist**:
- [ ] 50 concurrent start requests to same project
- [ ] Mix of start/stop requests
- [ ] Verify only one operation runs at a time
- [ ] Check no deadlocks occur

---

#### A3. Missing React Error Boundaries
**Files**:
- `src/components/chat/ChatPanel.tsx`
- `src/components/preview/PreviewPanel.tsx`
- `src/components/setup/ContainerStartupDisplay.tsx`
- `src/components/queue/JobDetailLive.tsx`

**Severity**: 🔴 CRITICAL  
**Impact**: Single component error crashes entire page  
**Current State**: Components have no error boundaries

**Fix Strategy**:
1. Create `src/components/error/ErrorBoundary.tsx`
2. Add error boundary wrapper to 4 major components
3. Implement fallback UI with error message
4. Log errors to monitoring system

**Success Criteria**:
- Throwing error in ChatPanel shows error UI, not blank page
- Same for other 3 components
- Error state persists until user action
- Error logged with full stack trace

**Estimated Effort**: 4 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 3 (Components)

**Error Boundary Template**:
```typescript
// src/components/error/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<...> {
  onError(error: Error, errorInfo: ErrorInfo) {
    logger.error({ error, componentStack: errorInfo.componentStack });
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

---

#### A4. EventSource Memory Leak
**File**: `src/components/chat/ChatPanel.tsx:336-367` (and similar)  
**Severity**: 🔴 CRITICAL (treats as critical for stability)  
**Impact**: Memory accumulates, multiple zombie connections  
**Current Code**:
```typescript
useEffect(() => {
    if (!opencodeReady) return;

    const eventSource = new EventSource(...);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("chat.event", (e) => {
        try {
            const event = JSON.parse(e.data);
            handleEvent(event);
        } catch {
            // Ignore parse errors
        }
    });

    eventSource.onerror = () => {
        eventSource.close();
        setTimeout(() => {
            if (eventSourceRef.current === eventSource) {
                // Will be handled by the useEffect cleanup/re-run
            }
        }, 2000);
    };

    return () => {
        eventSource.close();
        eventSourceRef.current = null;
    };
}, [projectId, opencodeReady]);
```

**Problems**:
1. Event listeners never manually removed
2. Timeout can fire after component unmounts
3. Multiple reconnections can accumulate
4. No proper cleanup order

**Fix Strategy**:
1. Use AbortController for cleanup
2. Manually remove event listeners in cleanup
3. Prevent reconnection timeout after unmount
4. Apply same fix to similar components

**Success Criteria**:
- `ps aux` shows no accumulating EventSource processes
- Memory usage stable over 1 hour of chat activity
- No console errors on component unmount
- All event listeners cleaned up

**Estimated Effort**: 3 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 1 (Lead - Reliability)

**Reference Implementation**:
```typescript
useEffect(() => {
    const controller = new AbortController();
    const eventSource = new EventSource(...);

    const handleEvent = (e: Event) => {
        if (controller.signal.aborted) return;
        // Process event
    };

    eventSource.addEventListener("chat.event", handleEvent);

    return () => {
        controller.abort();
        eventSource.removeEventListener("chat.event", handleEvent);
        eventSource.close();
    };
}, [projectId, opencodeReady]);
```

---

### Category B: Critical Documentation Fixes (3 issues)

#### B1. Fix Session Init Flow Documentation
**File**: `docs/project-creation-flow.md` (lines 44-66)  
**Severity**: 🔴 CRITICAL  
**Impact**: Developers misunderstand architecture  

**Current State**:
- Claims `session.init()` happens once during template prep
- Implies no per-project LLM call needed

**Reality** (from `src/server/queue/handlers/opencodeSessionCreate.ts:103-111`):
```typescript
// Fire and forget - don't await
void (
    client.session.init({
        sessionID: sessionId,
        model: { providerID, modelID },
        messageID: initMessageId,
    }) as Promise<unknown>
)
```
- `session.init()` IS called per-project
- Happens asynchronously (fire-and-forget)
- Doesn't block user prompt sending

**Fix Strategy**:
1. Rewrite section 5.3 "Pre-Initialized Template"
2. Rename to "Parallel Session Initialization"
3. Explain fire-and-forget pattern
4. Show timing diagram: init runs parallel to prompt

**Success Criteria**:
- Documentation accurately reflects code behavior
- Developer understands async/parallel execution
- Clear explanation of why this optimization works

**Estimated Effort**: 1 hour  
**Dependencies**: Understanding opencode SDK behavior  
**Owner Assignment**: Developer 5 (Backend)

**New Documentation Structure**:
```markdown
### 5.3 Parallel Session Initialization (Optimization)

**Flow**: Instead of sequential init→prompt, we run them in parallel:

1. Create session
2. Send init() asynchronously (fire-and-forget)
3. Send user prompt (doesn't wait for init)
4. Both produce events on stream concurrently

**Why This Works**:
- Init events processed before prompt events (OpenCode SDK ordering)
- No data loss from parallel execution
- Faster perceived response time
- User sees first token from init/reasoning while init completes
```

---

#### B2. Create Missing Production Deployment Doc
**New File**: `docs/production-deployment.md`  
**Severity**: 🔴 CRITICAL  
**Impact**: Production deployment system completely invisible to developers  

**Current State**: System exists in code but has zero documentation
- Queue jobs: `production.build`, `production.start`, `production.waitReady`, `production.stop`
- DB columns: `productionPort`, `productionUrl`, `productionStatus`, `productionStartedAt`, `productionError`
- API endpoints: `/api/projects/[id]/production.ts`, `/api/projects/[id]/deploy.ts`, etc.
- Database model: `src/server/productions/productions.model.ts`

**Content Needed**:
1. Architecture overview (what is production deployment?)
2. Status state diagram (queued → building → running → failed/stopped)
3. Build flow (trigger → queue job → await → mark ready)
4. Start/stop lifecycle
5. API reference (all endpoints and parameters)
6. Event streaming (what events are emitted?)
7. Error handling and recovery
8. Integration with project lifecycle

**Success Criteria**:
- Developer can understand production system from doc alone
- All API endpoints documented
- Status states and transitions clear
- Error cases explained

**Estimated Effort**: 3 hours  
**Dependencies**: Review production code  
**Owner Assignment**: Developer 5 (Backend)

**Template Outline**:
```markdown
# Production Deployment System

## Overview
Production deployments allow projects to build and run as standalone services on dedicated ports.

## Status States
- `queued`: Job queued, waiting to build
- `building`: Build in progress
- `running`: Build complete, container started
- `failed`: Build or startup failed
- `stopped`: Manually stopped or cleaned up

## Job Queue
- productionBuild: Builds project output
- productionStart: Starts container on allocated port
- productionWaitReady: Waits for health check
- productionStop: Stops and cleans up

## API Endpoints
### GET /api/projects/[id]/production
Returns current production status

### POST /api/projects/[id]/deploy
Triggers build and deployment

### GET /api/projects/[id]/production-stream
SSE stream for build/start events

### POST /api/projects/[id]/stop-production
Stops production server
```

---

#### B3. Update Database Schema Documentation
**File**: `docs/database-schema.md`  
**Severity**: 🔴 CRITICAL  
**Missing**: 7 columns across 2 tables

**Missing Columns**:

*Projects Table*:
- `currentModelProviderID` (line 81 in schema.ts) - For model tracking
- `currentModelID` (line 82 in schema.ts) - For model tracking
- `productionPort` (line 84) - Allocated port for production
- `productionUrl` (line 85) - Full URL for production
- `productionStatus` (line 86-88) - Current status (queued/building/running/failed/stopped)
- `productionStartedAt` (line 89) - When production started
- `productionError` (line 90) - Error message if build/start failed

*Sessions Table*:
- `createdAt` (line 24 in schema.ts) - When session was created

**Fix Strategy**:
1. Add "Production Deployment Fields" section
2. Add "Model Tracking Fields" subsection
3. Explain purpose of each column
4. Add examples/usage

**Success Criteria**:
- All 7 missing columns documented
- Developers understand model split (provider vs model ID)
- Production field purposes clear

**Estimated Effort**: 1 hour  
**Dependencies**: None  
**Owner Assignment**: Developer 5 (Backend)

---

## PHASE 2: HIGH PRIORITY FIXES (Week 3-5) 🔴

### Category C: Critical OpenCode Integration Issues (8 issues)

#### C1. Replace Manual SSE Parsing with SDK Event Stream
**File**: `src/pages/api/projects/[id]/opencode/event.ts:48-225`  
**Severity**: 🔴 HIGH  
**Impact**: Missing automatic retry, 100+ LOC duplicate code  

**Current State**: Manual SSE protocol parsing with custom error handling

**SDK Capability**: `client.global.event()` or `client.global.subscribe()` with:
- Automatic reconnection
- Event parsing built-in
- Error callbacks
- Retry logic with exponential backoff
- Last-Event-ID tracking

**Fix Strategy**:
1. Remove TextDecoderStream parsing (lines 155-225)
2. Use SDK's event stream method
3. Keep event normalization layer
4. Add retry configuration

**Success Criteria**:
- 100+ lines of manual SSE removed
- Automatic retry on network failures
- Same event output to client
- No data loss

**Estimated Effort**: 4 hours  
**Dependencies**: SDK version verification  
**Owner Assignment**: Developer 2 (OpenCode Integration)

**Reference Implementation**:
```typescript
// Replace lines 48-225 with:
const client = createOpencodeClient(project.opencodePort);
const { stream } = await client.global.subscribe({
  onSseEvent: async (event) => {
    const normalized = normalizeEvent(projectId, event.data, state);
    if (normalized) {
      res.write(`data: ${JSON.stringify(normalized)}\n\n`);
    }
  },
  onSseError: (error) => {
    logger.error({ error, projectId }, "Event stream error");
  },
  sseMaxRetryAttempts: 5,
  sseDefaultRetryDelay: 3000,
});

try {
  for await (const event of stream) {
    // Processing happens in callback above
  }
} finally {
  res.end();
}
```

---

#### C2. Add Error Handling to Session Init
**File**: `src/server/queue/handlers/opencodeSessionCreate.ts:102-123`  
**Severity**: 🔴 HIGH  
**Issue**: Type assertion hides errors, fire-and-forget without retry  

**Current Code**:
```typescript
void (
    client.session.init({...}) as Promise<unknown>
)
    .then(() => {...})
    .catch((error: unknown) => {
        logger.warn({...}, "Session initialization failed (non-fatal)");
    });
```

**Problems**:
1. `as Promise<unknown>` suppresses error checking
2. Only logs warning, doesn't retry
3. Error isn't properly typed

**Fix Strategy**:
1. Remove type assertion
2. Wrap with proper error handler
3. Add retry mechanism
4. Queue recovery job if init fails

**Estimated Effort**: 2 hours  
**Dependencies**: D5 (Error handler utility)  
**Owner Assignment**: Developer 2 (OpenCode Integration)

---

#### C3. Add Error Handling to promptAsync
**File**: `src/server/queue/handlers/opencodeSendUserPrompt.ts:106-113`  
**Severity**: 🔴 HIGH  
**Issue**: No try/catch around critical API call  

**Current Code**:
```typescript
await client.session.promptAsync({
    sessionID: sessionId,
    model: { ... },
    parts,
});
```

**Fix Strategy**:
1. Add try/catch wrapper
2. Validate response structure
3. Log meaningful errors
4. Queue retry on timeout

**Estimated Effort**: 2 hours  
**Dependencies**: D5 (Error handler utility)  
**Owner Assignment**: Developer 2 (OpenCode Integration)

---

#### C4. Replace Polling with Event-Based Message Detection
**File**: `src/server/queue/handlers/opencodeSendUserPrompt.ts:122-198`  
**Severity**: 🔴 HIGH  
**Issue**: Fixed 1-second delay, polling instead of events  

**Current Code**:
```typescript
// Wait 1 second, then poll for messages
await new Promise((resolve) => setTimeout(resolve, 1000));
const messagesResponse = await client.session.messages({ sessionID: sessionId });
```

**Problems**:
- Fixed 1-second delay (could be too long or too short)
- No backoff if message not found
- Polling instead of event-based
- Message lookup is O(n) string matching

**Fix Strategy**:
1. Listen for `message.updated` events instead of polling
2. Extract message ID from event
3. No delay needed - event is immediate
4. Much faster feedback

**Estimated Effort**: 3 hours  
**Dependencies**: C1 (event stream refactoring)  
**Owner Assignment**: Developer 2 (OpenCode Integration)

**Reference Implementation**:
```typescript
// Instead of polling loop, listen for message event:
for await (const event of eventStream) {
  if (event.type === "message.updated") {
    const msg = event.properties;
    if (msg?.info?.role === "user" && msg.info.id) {
      const messageId = msg.info.id;
      await updateUserPromptMessageId(project.id, messageId);
      break; // Found it
    }
  }
}
```

---

#### C5. Add Proper Type Safety to SDK Responses
**Files**:
- `src/server/queue/handlers/opencodeSessionCreate.ts:73`
- `src/server/queue/handlers/opencodeSendUserPrompt.ts:130-136`
- `src/server/opencode/normalize.ts:267-270`

**Severity**: 🟡 MEDIUM (classifying as HIGH for integration)  
**Issue**: Loose type assertions (`as any`, loose assertions)  

**Fix Strategy**:
1. Import SDK types directly
2. Remove `as any` casts
3. Use type guards instead of assertions
4. Leverage SDK's TypeScript definitions

**Estimated Effort**: 3 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 2 (OpenCode Integration)

**Examples**:
```typescript
// Before:
const sessionData = sessionResponse.data as { id?: string } | undefined;

// After:
import type { SessionCreateResponses } from "@opencode-ai/sdk";
const sessionId = sessionResponse.data?.id;
if (!sessionId) throw new Error("Invalid session response");

// Type guards:
const isUserMessage = (msg: any): msg is UserMessage => 
  msg?.role === "user";
```

---

#### C6. Cache OpenCode Client
**Files**:
- `src/server/queue/handlers/opencodeSessionCreate.ts:69`
- `src/server/queue/handlers/opencodeSendUserPrompt.ts:103`

**Severity**: 🟡 MEDIUM (in HIGH phase for efficiency)  
**Issue**: Creating new client on each call  

**Fix Strategy**:
1. Add client caching by port number
2. Reuse connections
3. Clear cache on project cleanup

**Estimated Effort**: 1 hour  
**Dependencies**: None  
**Owner Assignment**: Developer 2 (OpenCode Integration)

**Implementation**:
```typescript
// src/server/opencode/client.ts
const clientCache = new Map<number, OpencodeClient>();

export function getOpencodeClient(port: number): OpencodeClient {
  if (!clientCache.has(port)) {
    clientCache.set(port, createOpencodeClient(port));
  }
  return clientCache.get(port)!;
}

export function clearClientCache(port: number): void {
  clientCache.delete(port);
}
```

---

#### C7. Implement Additional Event Normalization
**File**: `src/server/opencode/normalize.ts`  
**Severity**: 🟡 MEDIUM  
**Missing Events**:
- `file.watcher.updated` - File system changes
- `pty.created`, `pty.updated`, `pty.exited` - Terminal events
- `command.executed` - Command completion
- `lsp.updated` - Language server diagnostics
- `session.idle` - Session finished

**Fix Strategy**:
1. Extend normalizeEvent with 5+ new event types
2. Map to existing or new client event types
3. Stream to frontend for real-time UI updates

**Estimated Effort**: 3 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 2 (OpenCode Integration)

**Example Cases**:
```typescript
case "file.watcher.updated": {
  return {
    type: "chat.file.watcher.updated",
    projectId,
    payload: { path: event.properties?.path },
  };
}

case "pty.updated": {
  return {
    type: "chat.pty.output",
    projectId,
    payload: {
      ptyId: event.properties?.ptyID,
      output: event.properties?.output,
    },
  };
}
```

---

#### C8. Update/Verify SDK Version
**File**: `package.json`  
**Severity**: 🟡 MEDIUM  
**Issue**: Version mismatch between package.json (1.0.203) and source (1.0.201)  

**Fix Strategy**:
1. Check published versions: `npm view @opencode-ai/sdk versions --json | tail -20`
2. Update to latest: `pnpm update @opencode-ai/sdk@latest`
3. Test thoroughly
4. Lock version if needed

**Estimated Effort**: 1 hour  
**Dependencies**: None  
**Owner Assignment**: Developer 2 (OpenCode Integration)

---

### Category D: Code Quality & Consistency Issues (12 issues)

#### D1. Remove Dead Code - Unused SVG Components
**Files** (5 total):
- `src/components/ui/svgs/anthropicBlackWordmark.tsx`
- `src/components/ui/svgs/anthropicWhiteWordmark.tsx`
- `src/components/ui/svgs/geminiWordmark.tsx`
- `src/components/ui/svgs/openaiWordmarkDark.tsx`
- `src/components/ui/svgs/openaiWordmarkLight.tsx`

**Severity**: 🟢 LOW (but quick wins)  
**Impact**: 94 LOC of unused code  
**Status**: Never imported anywhere

**Fix**: Delete all 5 files  
**Estimated Effort**: 15 minutes  
**Dependencies**: Verify no hidden imports  
**Owner Assignment**: Developer 5 (Backend)

---

#### D2. Remove Unused Hook & Exports
**Files**:
- `src/hooks/useAutoScroll.ts` (235 lines, never used)
- `src/server/presence/manager.ts` (ViewerRecord, ProjectPresence interfaces)
- `src/middleware.ts` (SESSION_COOKIE_NAME_EXPORT)

**Severity**: 🟢 LOW  
**Impact**: ~250 LOC  

**Fix**: Delete or document reason for keeping  
**Estimated Effort**: 30 minutes  
**Dependencies**: Verify with grep  
**Owner Assignment**: Developer 5 (Backend)

---

#### D3. Extract Duplicate Health Check Logic
**Locations**: 3 files with identical 80 LOC
- `src/server/projects/health.ts:6-50`
- `src/server/queue/handlers/productionWaitReady.ts:12-31`
- Similar in other handlers

**Severity**: 🟡 MEDIUM  
**Impact**: Code duplication makes maintenance harder  

**Fix Strategy**:
1. Create `src/server/health/checkHealthEndpoint.ts`
2. Implement generic health check function
3. Replace all 3 locations with function call

**Success Criteria**:
- Single source of truth for health checks
- All 3 locations use same function
- Consistent retry/timeout behavior

**Estimated Effort**: 2 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 5 (Backend)

---

#### D4. Extract Project Validation Pattern
**Locations**: 5+ queue handlers repeat same 5-line pattern

**Severity**: 🟡 MEDIUM  
**Pattern**:
```typescript
const project = await getProjectByIdIncludeDeleted(...);
if (!project) { logger.warn(...); return; }
if (project.status === "deleting") { logger.info(...); return; }
```

**Fix Strategy**:
1. Create `src/server/queue/helpers/getProjectOrSkip.ts`
2. Encapsulate validation and logging
3. Replace 5+ locations with function call

**Estimated Effort**: 1 hour  
**Dependencies**: None  
**Owner Assignment**: Developer 5 (Backend)

---

#### D5. Standardize Error Handling Patterns
**Scope**: Entire codebase  
**Severity**: 🟡 MEDIUM  
**Issues**:
- Inconsistent `error` vs `err` vs unnamed catches
- Same function silently swallows some errors while throwing others
- Files: `src/server/projects/delete.ts`, many handlers

**Fix Strategy**:
1. Define standard error handling pattern in AGENTS.md
2. Document try/catch conventions
3. Create error handler utility for common patterns
4. Apply consistently across codebase

**New Document**: `docs/error-handling-strategy.md`

**Pattern to Standardize**:
```typescript
// Standard: Name error variable, log with context, rethrow or handle
try {
  // operation
} catch (error) {
  logger.error(
    { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: "operation context",
    },
    "Operation failed"
  );
  throw error; // or handle gracefully
}
```

**Estimated Effort**: 3 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 5 (Backend)

---

#### D6. Standardize Database Query Patterns
**Files**: `queue.model.ts`, `projects.model.ts`  
**Severity**: 🟡 MEDIUM  
**Issues**:
- 3 different styles for similar queries
- Inconsistent null handling (??  vs .length > 0 vs optional chaining)
- Some use raw SQL, others use ORM

**Fix Strategy**:
1. Document standard pattern in AGENTS.md (new section)
2. Create helpers for common patterns
3. Refactor 10+ queries to use standard style

**New Document**: `docs/database-patterns.md`

**Example Standard**:
```typescript
// Standard: Use Drizzle ORM, explicit error handling
export async function getProjectById(id: string) {
  try {
    const project = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);
    
    return project.length > 0 ? project[0] : null;
  } catch (error) {
    logger.error({ error, projectId: id }, "Failed to fetch project");
    return null;
  }
}
```

**Estimated Effort**: 4 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 5 (Backend)

---

#### D7. Standardize Async/Promise Patterns
**Severity**: 🟡 MEDIUM  
**Issues**:
- Fire-and-forget without error handling (opencodeSessionCreate.ts:102-123)
- Blocking while loop instead of rescheduling (dockerEnsureRunning.ts)
- Different timeout strategies in 3 wait handlers

**Fix Strategy**:
1. Document 3 patterns: fire-and-forget, polling, waiting
2. When to use each pattern
3. Error handling for each
4. Apply consistently

**New Document**: `docs/async-patterns.md`

**Estimated Effort**: 3 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 5 (Backend)

---

### Category E: Missing Documentation (2 issues)

#### E1. Create Asset Management Documentation
**New File**: `docs/asset-management.md`  
**Severity**: 🔴 HIGH  

**Content Needed**:
1. Asset storage architecture
2. Upload workflow and file handling
3. Asset organization in projects
4. API for file operations
5. Integration with image attachments in prompts

**Code References**:
- Component hierarchy: AssetsTab, AssetsList, AssetItem, AssetUploadZone
- API endpoint: `/api/projects/[id]/files.ts`
- Image attachment support in queue payloads

**Estimated Effort**: 2 hours  
**Dependencies**: Review asset code  
**Owner Assignment**: Developer 5 (Backend)

---

#### E2. Create Additional Missing Docs
**Files to Create** (3 total):

**2a. docs/error-handling-strategy.md**
- Standard error handling patterns
- When to throw vs return null
- Error logging conventions
- Recovery strategies

**2b. docs/async-patterns.md**
- Fire-and-forget pattern (when/why)
- Polling pattern (when/why)
- Waiting/promise-based pattern (when/why)
- Error handling for each

**2c. docs/database-transactions.md**
- Multi-step operations and consistency
- When to use transactions
- Rollback strategies
- Example: Project deletion

**Severity**: 🟡 MEDIUM  
**Estimated Effort**: 3 hours total  
**Dependencies**: Code review  
**Owner Assignment**: Developer 5 (Backend)

---

## PHASE 3: MEDIUM PRIORITY (Week 6-12) 🟡

### Category F: Code Structure Refactoring (12 issues)

#### F1. Break Down ChatPanel Component
**File**: `src/components/chat/ChatPanel.tsx` (849 lines)  
**Severity**: 🟡 MEDIUM  
**Current**: Handles messages, input, streaming, tools, events  
**Target**: <300 lines main component + sub-components  

**Sub-components Structure**:
```
src/components/chat/
├── ChatPanel.tsx (wrapper, ~200 LOC)
├── messages/
│   ├── ChatMessageList.tsx (~150 LOC)
│   ├── ChatMessage.tsx (existing, move here)
│   └── MessageRenderer.tsx
├── input/
│   ├── ChatInput.tsx (~100 LOC)
│   └── InputControls.tsx
├── stream/
│   └── ChatEventHandler.tsx (~80 LOC)
└── tools/
    └── ToolCallDisplay.tsx (improve, move here)
```

**Success Criteria**:
- Main component <300 lines
- Clear separation of concerns
- Each sub-component <200 lines
- No prop drilling (use context for large prop sets)

**Estimated Effort**: 8 hours  
**Dependencies**: None (independent refactor)  
**Owner Assignment**: Developer 3 (Components)

---

#### F2. Break Down PreviewPanel Component
**File**: `src/components/preview/PreviewPanel.tsx` (498 lines)  
**Severity**: 🟡 MEDIUM  
**Current**: Tabs, iframe, deployment, production status  
**Target**: <250 lines main component  

**Sub-components Structure**:
```
src/components/preview/
├── PreviewPanel.tsx (wrapper, ~150 LOC)
├── iframe/
│   └── PreviewIframe.tsx (~80 LOC)
├── tabs/
│   └── PreviewTabs.tsx (~100 LOC - route to tab content)
└── deployment/
    ├── DeploymentControls.tsx (~80 LOC)
    └── ProductionStatus.tsx (~100 LOC)
```

**Estimated Effort**: 6 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 4 (Frontend)

---

#### F3. Break Down QueueTableLive Component
**File**: `src/components/queue/QueueTableLive.tsx` (563 lines)  
**Severity**: 🟡 MEDIUM  
**Current**: Table, controls, dialogs, pagination  
**Target**: <300 lines  

**Sub-components Structure**:
```
src/components/queue/
├── QueueTableLive.tsx (wrapper, ~150 LOC)
├── table/
│   ├── QueueTable.tsx (~200 LOC)
│   ├── QueueTableRow.tsx (~60 LOC)
│   └── QueueControls.tsx (~80 LOC)
└── dialogs/
    └── QueueActionDialogs.tsx (~100 LOC)
```

**Estimated Effort**: 5 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 4 (Frontend)

---

#### F4. Break Down ChatPanel.handleEvent() Function
**File**: `src/components/chat/ChatPanel.tsx:369-580` (212 lines)  
**Severity**: 🟡 MEDIUM  
**Current**: 6 different event type handlers in one function  
**Target**: Extract each case to separate handler  

**Handlers to Extract**:
- `handleChatMessagePartAdded()`
- `handleChatMessageDelta()`
- `handleChatMessageFinal()`
- `handleChatReasoningPart()`
- `handleChatToolUpdate()`
- `handleChatSessionStatus()`

**Estimated Effort**: 3 hours  
**Dependencies**: F1  
**Owner Assignment**: Developer 3 (Components)

---

#### F5. Split Actions File by Domain
**File**: `src/actions/index.ts` (1204 lines)  
**Severity**: 🟡 MEDIUM  
**Current**: All actions in one file  
**Target**: Split into domain files  

**New File Structure**:
```
src/actions/
├── index.ts (re-export hub, ~50 LOC)
├── auth.ts (~150 LOC)
├── projects.ts (~250 LOC)
├── queue.ts (~200 LOC)
├── assets.ts (~200 LOC)
├── settings.ts (~100 LOC)
└── setup.ts (~100 LOC)
```

**Success Criteria**:
- Each file focused on single domain
- index.ts just re-exports
- No circular dependencies
- Types imported where needed

**Estimated Effort**: 4 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 5 (Backend)

---

#### F6. Add Semantic Color Tokens
**File**: `src/styles/globals.css`  
**Severity**: 🟡 MEDIUM (AGENTS.md violation)  
**Current**: Components use hardcoded colors (text-red-500, bg-green-500)  
**Target**: Create semantic tokens, replace all hardcoded colors  

**Tokens to Create**:
```css
--color-success: oklch(52.43% 0.263 142.5); /* green */
--color-error: oklch(61.23% 0.257 29.23); /* red */
--color-warning: oklch(74.75% 0.168 70.08); /* yellow/orange */
--color-info: oklch(48.7% 0.259 241.57); /* blue */

--color-status-running: var(--color-warning);
--color-status-queued: var(--color-info);
--color-status-failed: var(--color-error);
--color-status-success: var(--color-success);
```

**Tailwind Utilities** (in globals.css):
```css
@layer utilities {
  .text-success { @apply text-[var(--color-success)]; }
  .text-error { @apply text-[var(--color-error)]; }
  .bg-success { @apply bg-[var(--color-success)]; }
  /* etc */
}
```

**Files to Update** (20+):
- ToolCallDisplay.tsx (5 colors)
- ContainerStartupDisplay.tsx (3 colors)
- SetupStatusDisplay.tsx (2 colors)
- And 6 others listed in CODEBASE_REVIEW.md

**Success Criteria**:
- No hardcoded color names in components
- All colors come from CSS tokens
- Theme changes update single source
- Dark mode support via CSS variables

**Estimated Effort**: 6 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 4 (Frontend)

---

#### F7. Refactor QueueTableLive.handleConfirmAction()
**File**: `src/components/queue/QueueTableLive.tsx:204-248` (44 lines)  
**Severity**: 🟡 MEDIUM  
**Current**: Multiple operations (validation, routing, fetch, cleanup)  
**Target**: Extract action routing and API calls  

**Estimated Effort**: 2 hours  
**Dependencies**: F3  
**Owner Assignment**: Developer 4 (Frontend)

---

#### F8. Refactor Complex projects.create Action
**File**: `src/actions/index.ts:347-409`  
**Severity**: 🟡 MEDIUM  
**Current**: Validates, parses, generates, enqueues in one function  
**Target**: Break into helper functions  

**Estimated Effort**: 2 hours  
**Dependencies**: F5  
**Owner Assignment**: Developer 5 (Backend)

---

#### F9. Refactor Complex assets.upload Action
**File**: `src/actions/index.ts:941-1038`  
**Severity**: 🟡 MEDIUM  
**Current**: Multiple responsibilities  
**Target**: Extract validation, directory creation, response building  

**Estimated Effort**: 2 hours  
**Dependencies**: F5  
**Owner Assignment**: Developer 5 (Backend)

---

#### F10. Rename production Directory (Optional)
**Current**: `src/server/productions/` (redundant naming)  
**Target**: `src/server/production/`  

**Severity**: 🟢 LOW  
**Estimated Effort**: 30 minutes  
**Dependencies**: None  
**Owner Assignment**: Developer 5 (Backend)

---

#### F11. Post-Process shadcn Updates
**Location**: `scripts/shadcn-update.sh`  
**Severity**: 🟢 LOW  
**Current**: shadcn generates dark: prefixes which violate AGENTS.md  
**Target**: Add sed/regex to strip dark: prefixes after update  

**Script Addition**:
```bash
# After shadcn update, remove dark: prefixes from generated components
find src/components/ui -name "*.tsx" -type f -exec sed -i '' \
  's/dark:[a-z-]* //g' {} \;
```

**Estimated Effort**: 1 hour  
**Dependencies**: None  
**Owner Assignment**: Developer 4 (Frontend)

---

#### F12. Improve TypeScript Strictness
**Severity**: 🟡 MEDIUM  
**Issues**:
- Loose any casts in normalize.ts
- Date serialization inconsistencies
- Message type handling

**Fix Strategy**:
1. Enable stricter TS checks in tsconfig.json
2. Fix violations one by one
3. Use type guards instead of assertions
4. Improve message type handling

**Estimated Effort**: 4 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 2 (OpenCode Integration)

---

### Category G: Additional Bug Fixes (8 issues)

#### G1. Fix Database Transaction Issues
**File**: `src/server/projects/delete.ts:26-105`  
**Severity**: 🟡 MEDIUM  
**Issue**: Not transactional - if step 3 fails, step 5 still runs, orphaning DB record  

**Current Flow**:
1. Update status to "stopping"
2. Docker down
3. File system delete (can fail)
4. Production delete
5. DB delete (still runs even if #3 fails)

**Fix Strategy**:
1. Wrap in SQLite transaction
2. Or implement rollback on failure
3. Use try/catch to clean up on error

**Estimated Effort**: 3 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 1 (Lead)

---

#### G2. Fix Password Verification Error Handling
**File**: `src/server/auth/password.ts:15-27`  
**Severity**: 🟡 MEDIUM  
**Issue**: No try/catch around timingSafeEqual or buffer conversion  

**Current Code**:
```typescript
const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
const keyBuffer = Buffer.from(key, "hex"); // Can throw if malformed
return timingSafeEqual(derivedKey, keyBuffer); // Can throw
```

**Fix**: Add try/catch, return false on error  
**Estimated Effort**: 1 hour  
**Dependencies**: None  
**Owner Assignment**: Developer 1 (Lead)

---

#### G3. Fix State Mutation in ChatPanel
**File**: `src/components/chat/ChatPanel.tsx:400-406`  
**Severity**: 🟡 MEDIUM  
**Issue**: Mutating textPart.text and msg.parts directly  

**Fix**: Create new objects instead of mutations  
**Estimated Effort**: 2 hours  
**Dependencies**: F1 (may be resolved during refactor)  
**Owner Assignment**: Developer 3 (Components)

---

#### G4. Fix Optional Chaining Inconsistency
**File**: `src/server/queue/handlers/opencodeSendUserPrompt.ts:145-172`  
**Severity**: 🟡 MEDIUM  
**Issue**: Inconsistent null checks  

**Fix**: Use consistent optional chaining throughout  
**Estimated Effort**: 2 hours  
**Dependencies**: C2  
**Owner Assignment**: Developer 2 (OpenCode Integration)

---

#### G5. Fix Docker Logging Memory Leak
**File**: `src/server/docker/logs.ts:154-246`  
**Severity**: 🟡 MEDIUM  
**Issue**: Orphaned processes if streams are null or stuck  

**Fix**:
1. Add timeout cleanup
2. Verify stream handlers attached
3. Clean up on error path

**Estimated Effort**: 2 hours  
**Dependencies**: None  
**Owner Assignment**: Developer 1 (Lead)

---

#### G6. Fix EventSource Cleanup (Component-Level)
**File**: Various components using EventSource  
**Severity**: 🟡 MEDIUM  
**Issue**: Event listeners never removed, timeout can fire after unmount  

**Fix**: Use AbortController, manually remove listeners  
**Estimated Effort**: 2 hours  
**Dependencies**: A4 (partially overlaps)  
**Owner Assignment**: Developer 3 (Components)

---

#### G7. Fix ContainerStartupDisplay JSON Parsing
**File**: `src/components/setup/ContainerStartupDisplay.tsx:196-264`  
**Severity**: 🟡 MEDIUM  
**Issue**: JSON parse not in try/catch, shows infinite loading on error  

**Fix**: Move JSON parsing into try block, set error state  
**Estimated Effort**: 1 hour  
**Dependencies**: None  
**Owner Assignment**: Developer 4 (Frontend)

---

#### G8. Add Reaper Error Handling
**File**: `src/server/presence/manager.ts:371-373`  
**Severity**: 🟢 LOW  
**Issue**: startReaper() async but no error handler  

**Fix**: Attach .catch() handler  
**Estimated Effort**: 30 minutes  
**Dependencies**: None  
**Owner Assignment**: Developer 1 (Lead)

---

## PHASE 4: DOCUMENTATION IMPROVEMENTS (Week 12-14) 📚

### Category H: Complete Documentation Updates (8 files)

#### H1. Update docs/opencode-integration.md
**Additions**:
- Document SDK event stream usage
- Document client caching strategy
- Document new event types (file.watcher, pty.*, etc.)
- Document health check fallback mechanism

**Estimated Effort**: 2 hours  
**Owner Assignment**: Developer 5 (Backend)

---

#### H2. Update docs/queue-system.md
**Additions**:
- Expand deduplication section (dedupeActive, behavior)
- Explain retry backoff calculation
- Add circuit breaker patterns (if applicable)
- Document job handler organization

**Estimated Effort**: 2 hours  
**Owner Assignment**: Developer 5 (Backend)

---

#### H3. Update docs/presence-system.md
**Additions**:
- Clarify reaper behavior and intervals
- Document PRESENCE_HEARTBEAT_MS, REAPER_INTERVAL_MS, etc.
- Clarify auto-stop/restart flow
- Document edge cases (deleting status, etc.)

**Estimated Effort**: 1.5 hours  
**Owner Assignment**: Developer 5 (Backend)

---

#### H4. Update docs/model-selection.md
**Additions**:
- Specify opencode.json field names and format
- Document provider/model split tracking
- Add example configuration

**Estimated Effort**: 1 hour  
**Owner Assignment**: Developer 5 (Backend)

---

#### H5. Update docs/project-lifecycle.md
**Changes**:
- Improve state machine diagram clarity
- Show only stopped → starting transition (not bidirectional)
- Clarify error state (terminal vs recoverable)
- Document deleting flow

**Estimated Effort**: 1 hour  
**Owner Assignment**: Developer 5 (Backend)

---

#### H6. Add Cross-References to All Docs
**Locations**:
- database-schema.md → links to project-lifecycle.md, production-deployment.md
- queue-system.md → links to project-creation-flow.md, production-deployment.md
- project-creation-flow.md → links to opencode-integration.md

**Estimated Effort**: 1.5 hours  
**Owner Assignment**: Developer 5 (Backend)

---

#### H7. Update AGENTS.md
**Additions**:
- Document standard error handling pattern
- Document standard database query pattern
- Document standard async/await patterns
- Add "Dead Code" section with cleanup checklist
- Link to new docs (error-handling-strategy.md, etc.)

**Estimated Effort**: 2 hours  
**Owner Assignment**: Developer 5 (Backend)

---

#### H8. Create New Technical Docs (3 files)
- `docs/error-handling-strategy.md`
- `docs/async-patterns.md`
- `docs/database-transactions.md`

**Estimated Effort**: 3 hours total  
**Owner Assignment**: Developer 5 (Backend)

---

## EXECUTION STRATEGY

### Dependency Graph
```
Phase 1 (Blocking) - All Independent:
├─ A1: Queue worker ✓
├─ A2: Lock race ✓
├─ A3: Error boundaries ✓
├─ A4: EventSource leak ✓
└─ B1-B3: Docs ✓

Phase 2 (High Priority):
├─ C1: SSE refactor → enables C4
├─ C2: Session error → requires D5
├─ C3: promptAsync error → requires D5
├─ C4: Event-based msg → requires C1
├─ C5-C8: OpenCode ✓
└─ D1-D7: Code quality ✓

Phase 3 (Medium Priority):
├─ E1-E2: Asset docs ✓
├─ F1-F9: Component refactoring (mostly parallel)
├─ G1-G8: Bug fixes (some dependent on F)
└─ H1-H8: Docs (mostly parallel)

Phase 4: All documentation (can start after Phase 1)
```

### Team Assignment (5 Developers)

**Developer 1 (Lead - Reliability)**
- **Phase 1**: A1, A2, A4 (Queue worker, lock, EventSource)
- **Phase 2**: C2, C3 (Error handling)
- **Phase 3**: G1, G2, G5 (Transactions, password, docker)
- **Time**: 8 weeks full, then documentation

**Developer 2 (OpenCode Integration)**
- **Phase 1**: None
- **Phase 2**: C1-C8 (All OpenCode improvements, 3 weeks)
- **Phase 3**: G4 (Optional chaining)
- **Time**: 3-4 weeks intensive, then lighter load

**Developer 3 (React Components)**
- **Phase 1**: A3 (Error boundaries)
- **Phase 3**: F1, F4 (ChatPanel refactor, 8 hours)
- **Phase 3**: G3, G6 (State mutations)
- **Time**: 3-4 weeks

**Developer 4 (Frontend)**
- **Phase 3**: F2, F3, F6 (PreviewPanel, QueueTable, colors, 17 hours)
- **Phase 3**: F7, F11 (Confirm action, shadcn)
- **Phase 3**: G7 (JSON parsing)
- **Time**: 4-5 weeks

**Developer 5 (Backend)**
- **Phase 2**: D1-D7 (Code quality, 18 hours)
- **Phase 3**: F5, F8, F9, D3, D4 (Actions, health check, project pattern)
- **Phase 4**: H1-H8 (All documentation, 12 hours)
- **Time**: 6-8 weeks

### Timeline Breakdown

| Phase | Weeks | Focus | Team | Parallel Tasks |
|-------|-------|-------|------|---|
| 1 | 2 | Critical bugs & docs | 5 | A1, A2, A3, A4, B1-B3 (all parallel) |
| 2 | 3 | OpenCode + Code quality | 5 | Dev2 on C1-C8 / Dev5 on D1-D7 / Dev1 on C2-C3 |
| 3 | 7 | Refactoring + Bugs | 5 | F1-F9 (mostly parallel) / G1-G8 (some serial) |
| 4 | 2 | Documentation | 2-3 | H1-H8 (all parallel) |
| **Total** | **14-16** | All 73 items | **5 concurrent** | High parallelization |

### Success Criteria

**Phase 1 Complete** ✅
- ✅ Queue worker doesn't crash silently
- ✅ No lock race conditions in presence manager  
- ✅ All major components have error boundaries
- ✅ EventSource cleanup prevents memory leaks
- ✅ Critical documentation corrected (B1-B3)

**Phase 2 Complete** ✅
- ✅ All OpenCode SDK capabilities used properly (C1-C8)
- ✅ Error handling consistent across codebase (C2, C3, D5)
- ✅ Dead code removed (D1, D2)
- ✅ Code patterns standardized (D3-D7)

**Phase 3 Complete** ✅
- ✅ All components <500 lines (major ones <300)
- ✅ Functions follow single responsibility (F1-F9)
- ✅ All semantic colors implemented (F6)
- ✅ Remaining bugs fixed (G1-G8)

**Phase 4 Complete** ✅
- ✅ All docs up-to-date with code (H1-H7)
- ✅ New features fully documented (E1-E2, H8)
- ✅ AGENTS.md reflects actual patterns (H7)

---

## QUICK START CHECKLIST

### Week 1 Priorities (Pick 3-4)
- [ ] **A1**: Queue worker restart mechanism (Dev 1, 2h)
- [ ] **A2**: Fix lock race condition (Dev 1, 3h)
- [ ] **A3**: Add error boundaries (Dev 3, 4h)
- [ ] **B1**: Fix project-creation-flow.md (Dev 5, 1h)
- [ ] **B3**: Update database-schema.md (Dev 5, 1h)

**Total Week 1**: 11 hours, clears 5 critical issues

### Daily Standup Talking Points
1. Are A1, A2, A4 passing stress tests?
2. Lock testing with concurrent requests?
3. Error boundary coverage complete?
4. EventSource connections accumulating?

### Common Issues to Watch
1. **EventSource cleanup** - Test with `ps aux | grep EventSource` or similar
2. **Lock testing** - Use `ab -c 100 -n 1000 http://localhost/api/projects/:id/start`
3. **Type safety** - Run `tsc --strict` to catch remaining issues
4. **Documentation** - Cross-reference docs against actual code
5. **Concurrent testing** - Load test critical paths before Phase 2

---

## IMPLEMENTATION NOTES

### Testing Strategy
- Phase 1: Unit tests for critical fixes (A1-A4)
- Phase 2: Integration tests for OpenCode improvements (C1-C8)
- Phase 3: Component tests for refactored components (F1-F9)
- Phase 4: Docs validation (ensure docs match code)

### Code Review Checklist
**All Phase 1** requires 2-reviewer approval:
- [ ] Code follows AGENTS.md clean code principles
- [ ] No new warnings/errors in `tsc --strict`
- [ ] Tests pass locally
- [ ] No performance regressions

**Phase 2+** requires 1-reviewer approval for refactoring

### Staging & Testing
1. **Phase 1+2**: Test thoroughly before Phase 3 begins
2. **Phase 3**: Refactoring can proceed in parallel with Phase 2
3. **Phase 4**: Documentation can be written anytime after corresponding code changes

### Backward Compatibility
- All refactoring maintains API compatibility
- No breaking changes to queue job schema
- No database migrations required for Phase 1-3
- Documentation only (Phase 4) has zero impact

---

## ESTIMATED EFFORT SUMMARY

| Developer | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total |
|-----------|---------|---------|---------|---------|-------|
| Dev 1 (Lead) | 8h | 4h | 6h | 0h | **18h** |
| Dev 2 (OpenCode) | 0h | 16h | 2h | 0h | **18h** |
| Dev 3 (Components) | 4h | 0h | 8h | 0h | **12h** |
| Dev 4 (Frontend) | 0h | 0h | 17h | 0h | **17h** |
| Dev 5 (Backend) | 2h | 18h | 12h | 12h | **44h** |
| **Total** | **14h** | **38h** | **45h** | **12h** | **109 hours** |

**At 5 developers, 40 hours/week**: ~5.5 weeks serial, ~2.5 weeks with parallel work

---

## REFERENCES

Detailed Analysis Files:
- `BUG_ANALYSIS.md` - 15 bugs with code locations
- `CODEBASE_REVIEW.md` - AGENTS.md violations
- `DOCUMENTATION_REVIEW.md` - Missing/outdated docs
- `OPENCODE_SDK_ANALYSIS.md` - SDK improvements

---

**Last Updated**: December 27, 2025  
**Status**: Ready for execution  
**Next Step**: Assign Phase 1 tasks to developers
