# Async/Promise Patterns

## Overview

This document defines three common async patterns used in doce.dev and when to use each one. Understanding these patterns is crucial for proper error handling, resource cleanup, and application stability.

## Pattern 1: Fire-and-Forget (Background Tasks)

### When to Use
- Background operations that don't block the response
- Cleanup tasks (deleting temp files, sending notifications)
- Non-critical operations (analytics, logging)
- Work that should continue even if the request completes

### How It Works

```typescript
// Fire-and-forget: Start async work but don't wait for it
void (async () => {
  try {
    await backgroundTask();
    logger.info("Background task completed");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Background task failed (non-fatal)"
    );
    // Don't rethrow - this runs in background, user won't see the error
  }
})();

// Immediately return to user
return { success: true };
```

### Examples in doce.dev

**Session Initialization** (`src/server/queue/handlers/opencodeSessionCreate.ts`):
```typescript
// Initialize session in background, don't wait
void client.session.init({
  sessionID: sessionId,
  model: { providerID, modelID },
}).catch((error) => {
  logger.error({ error, sessionId }, "Session init failed (non-fatal)");
  // User can still send prompts while init completes
});
```

**File Cleanup** (`src/server/projects/delete.ts`):
```typescript
// Delete project files in background after DB delete
void (async () => {
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
  } catch (error) {
    logger.error({ error, projectPath }, "File deletion failed");
  }
})();
```

### Error Handling
- ✅ Must have `.catch()` handler
- ✅ Log errors with context
- ✅ Never rethrow (won't reach user)
- ❌ Don't use for critical operations
- ❌ Don't rely on completion in response

## Pattern 2: Polling (Periodic Checks)

### When to Use
- Waiting for a resource to become ready
- Checking for status updates
- Background monitoring
- When event-based notifications aren't available

### How It Works

```typescript
// Polling: Check repeatedly until condition met or timeout
async function waitForReady(port: number): Promise<void> {
  const maxAttempts = 30;
  const delayMs = 1000;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        logger.info({ port }, "Service is ready");
        return; // Success
      }
    } catch {
      // Connection failed, expected while starting
    }

    attempts++;
    if (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Service didn't become ready after ${maxAttempts} attempts`);
}
```

### Examples in doce.dev

**Health Check Polling** (`src/server/health/checkHealthEndpoint.ts`):
```typescript
// Poll HTTP endpoint with exponential backoff
export async function checkHealthEndpoint(
  port: number,
  options?: HealthCheckOptions
): Promise<void> {
  const maxAttempts = options?.maxAttempts ?? 30;
  const initialDelayMs = options?.initialDelayMs ?? 100;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `http://localhost:${port}${options?.path ?? "/"}`,
        { timeout: 5000 }
      );
      if (response.ok) return;
    } catch {
      // Expected while starting
    }

    const delay = Math.min(
      initialDelayMs * Math.pow(1.5, attempt - 1),
      5000 // Cap at 5 seconds
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`Health check failed after ${maxAttempts} attempts`);
}
```

**Session Polling** (`src/components/chat/ChatPanel.tsx`):
```typescript
// Poll for presence data every 2 seconds
const pollForSession = useCallback(async () => {
  try {
    const response = await fetch(`/api/projects/${projectId}/presence`);
    if (!response.ok) return;

    const data = await response.json();
    if (data.sessions?.[0]) {
      setSessionId(data.sessions[0].id);
    }
  } catch (error) {
    logger.error({ error }, "Presence poll failed");
  }
}, [projectId]);

useEffect(() => {
  const intervalId = setInterval(pollForSession, 2000);
  return () => clearInterval(intervalId);
}, [pollForSession]);
```

### Error Handling
- ✅ Expected failures during polling (network, service not ready)
- ✅ Log intermittent failures as debug/info
- ✅ Throw after max attempts exceeded
- ✅ Clear interval/timeout on cleanup
- ❌ Don't log every failed attempt as error

## Pattern 3: Waiting/Promise-Based (Sequential Operations)

### When to Use
- Critical path operations that must complete
- Dependent operations (must wait for first to complete)
- Operations where failure should propagate
- Response endpoints that need a result

### How It Works

```typescript
// Waiting pattern: Await critical operations sequentially
async function completeOperation(projectId: string) {
  try {
    // Step 1: Create resource
    const resource = await createResource(projectId);
    
    // Step 2: Wait for initialization (depends on step 1)
    await initializeResource(resource.id);
    
    // Step 3: Validate state (depends on step 2)
    await validateResource(resource.id);
    
    return resource;
  } catch (error) {
    // Any failure stops the chain and propagates up
    logger.error({ error, projectId }, "Operation chain failed");
    throw error; // Return fails
  }
}
```

### Examples in doce.dev

**Queue Handler Job Sequence** (`src/server/queue/queue.worker.ts`):
```typescript
// Handler must wait for completion and handle errors
async function handleProjectStart(ctx: QueueJobContext) {
  const { projectId } = ctx.job.payload;

  try {
    // Step 1: Create containers
    const container = await dockerCompose.up(projectId);
    
    // Step 2: Wait for health
    await checkHealthEndpoint(container.port);
    
    // Step 3: Update database
    await updateProjectStatus(projectId, "running");
    
    // Success - job completes
  } catch (error) {
    // Failure stops here, job is marked failed and can be retried
    logger.error({ error, projectId }, "Project start failed");
    throw error; // Queue will catch and handle retry
  }
}
```

**API Route Handler** (`src/pages/api/projects/[id]/deploy.ts`):
```typescript
// Action handler must wait for all steps
handler: async (input, context) => {
  try {
    // Step 1: Validate
    const project = await getProject(input.projectId);
    if (!project) throw new Error("Project not found");

    // Step 2: Build
    const buildResult = await buildProject(project);

    // Step 3: Deploy
    const url = await deployProject(project, buildResult);

    // Return result to user
    return { success: true, url };
  } catch (error) {
    logger.error({ error }, "Deployment failed");
    throw new ActionError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Deployment failed",
    });
  }
}
```

**React Component Data Loading**:
```typescript
// useEffect waits for data to load before rendering
useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error("Failed to load");
      
      const data = await response.json();
      setProject(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error loading");
    } finally {
      setLoading(false);
    }
  };

  loadData();
}, [projectId]);
```

### Error Handling
- ✅ Catch and log all errors
- ✅ Propagate to caller/user
- ✅ Stop execution on failure
- ✅ Include full context in error logs
- ❌ Don't silently ignore errors
- ❌ Don't continue if critical step fails

## Choosing the Right Pattern

| Pattern | Critical | Must Wait | Can Fail Silently |
|---------|----------|-----------|------------------|
| Fire-and-Forget | ❌ No | ❌ No | ✅ Yes |
| Polling | ❌ Sometimes | ✅ Yes | ❌ No |
| Waiting | ✅ Yes | ✅ Yes | ❌ No |

### Decision Tree

1. **Is this operation critical to the response?**
   - Yes → Use Waiting pattern
   - No → Consider Fire-and-Forget or Polling

2. **Must we wait for it to complete?**
   - Yes → Use Waiting or Polling pattern
   - No → Use Fire-and-Forget

3. **Can it fail without affecting the user?**
   - Yes → Use Fire-and-Forget with error logging
   - No → Use Waiting pattern with error propagation

## Common Mistakes

### ❌ Fire-and-Forget Without Error Handling

```typescript
// BAD: Errors are hidden, task fails silently
void backgroundTask();
```

### ✅ Correct: Fire-and-Forget With Error Handler

```typescript
// GOOD: Errors are logged even in background
void backgroundTask().catch(error => {
  logger.error({ error }, "Background task failed");
});
```

### ❌ Not Clearing Intervals

```typescript
// BAD: Interval keeps running after component unmounts
useEffect(() => {
  const intervalId = setInterval(poll, 5000);
  // Missing cleanup!
}, []);
```

### ✅ Correct: Cleanup Interval

```typescript
// GOOD: Interval is cleaned up
useEffect(() => {
  const intervalId = setInterval(poll, 5000);
  return () => clearInterval(intervalId); // Cleanup
}, []);
```

### ❌ Missing Await for Critical Operations

```typescript
// BAD: Don't wait for initialization, assume it's done
handler: async () => {
  initializeSession(); // Missing await!
  return { success: true };
}
```

### ✅ Correct: Await Critical Operations

```typescript
// GOOD: Wait for initialization before responding
handler: async () => {
  await initializeSession();
  return { success: true };
}
```

## References

- [error-handling-strategy.md](./error-handling-strategy.md) - Error handling patterns
- [queue-system.md](./queue-system.md) - Queue job patterns
- [AGENTS.md](./AGENTS.md) - Clean code principles
