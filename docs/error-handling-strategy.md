# Error Handling Strategy

## Overview

This document defines standard error handling patterns used throughout the doce.dev codebase to ensure consistent, maintainable error management across all layers (server, database, API, components).

## Core Principles

1. **Always name the error variable** - Use `error` or `err`, never unnamed catches
2. **Log with context** - Include relevant IDs and operation details
3. **Choose: throw or handle** - Either recover gracefully or fail fast, never silently ignore
4. **Distinguish critical from non-critical** - Critical failures should stop execution; non-critical can continue
5. **Provide meaningful messages** - End users see messages, developers see logs and stack traces

## Pattern: Server-Side (Backend)

### Try-Catch with Context Logging

```typescript
// Standard: Log error with context, then rethrow or handle
try {
  const result = await criticalOperation(params);
  return result;
} catch (error) {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: user.id,
      operationId: operationId,
    },
    "Critical operation failed - investigation required"
  );
  throw error; // Rethrow to propagate to caller
}
```

### Non-Critical Operations (Log and Continue)

```typescript
// Non-critical: Log warning and return null or default
try {
  const email = await sendNotificationEmail(userId, message);
  return email;
} catch (error) {
  logger.warn(
    {
      error: error instanceof Error ? error.message : String(error),
      userId: userId,
    },
    "Email notification failed (non-fatal) - continuing"
  );
  return null; // Graceful degradation
}
```

### Database Operations

```typescript
// Database with proper error context
try {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return user[0] ?? null;
} catch (error) {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
      userId: userId,
      operation: "getUser",
    },
    "Database query failed"
  );
  throw error; // Let caller decide how to handle
}
```

## Pattern: Async Operations

### Promise-Based Error Handling

```typescript
// Async operation with proper cleanup
const promise = someAsyncOperation()
  .then(result => {
    logger.debug({ result }, "Operation succeeded");
    return result;
  })
  .catch(error => {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Operation failed"
    );
    throw error; // Propagate
  });
```

### Fire-and-Forget with Error Handler

```typescript
// Fire-and-forget pattern: No await, must have .catch()
void (async () => {
  try {
    await backgroundTask();
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Background task failed"
    );
    // Don't rethrow - this runs in background
  }
})();
```

### Interval-Based Operations

```typescript
// Interval that needs error handling
const intervalId = setInterval(async () => {
  try {
    await pollForUpdates();
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Poll failed - will retry on next interval"
    );
    // Continue - interval will retry
  }
}, 5000);
```

## Pattern: React Components

### Error Boundaries (Class Components)

```typescript
// src/components/error/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      },
      "Component error caught by boundary"
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-status-error-light border border-status-error rounded">
          <p className="text-status-error">
            Something went wrong. Please refresh the page.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Async State Management

```typescript
// Hook with error state
const [data, setData] = useState(null);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      const result = await fetch("/api/data");
      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }
      setData(await result.json());
      setError(null);
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to fetch data"
      );
      setError("Failed to load data");
      setData(null);
    }
  };

  fetchData();
}, []);
```

## Pattern: API Routes

### Astro Actions

```typescript
// Handler with validation and error response
handler: async (input, context) => {
  try {
    // Validate access
    const user = context.locals.user;
    if (!user) {
      throw new ActionError({
        code: "UNAUTHORIZED",
        message: "Must be logged in",
      });
    }

    // Perform operation
    const result = await db.insert(table).values(input);

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ActionError) {
      throw error; // Already formatted
    }

    // Unexpected error
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        userId: user?.id,
      },
      "Action failed unexpectedly"
    );

    throw new ActionError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Operation failed",
    });
  }
}
```

## Error Types and Status Codes

### ActionError Codes (Astro Actions)

- **UNAUTHORIZED** - Authentication/authorization failure
- **BAD_REQUEST** - Validation or input error
- **NOT_FOUND** - Resource not found
- **CONFLICT** - Duplicate resource or state conflict
- **INTERNAL_SERVER_ERROR** - Unexpected server error

### Queue Job Errors

```typescript
// RescheduleError - job should retry
throw new RescheduleError("Temporary failure, will retry");

// Normal Error - job fails permanently
throw new Error("Permanent failure, job abandoned");
```

## Common Mistakes to Avoid

### ❌ Silent Failures

```typescript
// BAD: Error is silently ignored
try {
  await importantOperation();
} catch {
  // Nothing happens - bug is hidden!
}
```

### ✅ Correct: Log and Handle

```typescript
// GOOD: Error is logged, then handled appropriately
try {
  await importantOperation();
} catch (error) {
  logger.error(
    { error: error instanceof Error ? error.message : String(error) },
    "Operation failed"
  );
  // Handle or rethrow
}
```

### ❌ Unnamed Error Variables

```typescript
// BAD: Can't tell what error is
try {
  await operation();
} catch (e) {
  console.log(e); // What is e? Where did it come from?
}
```

### ✅ Correct: Descriptive Names

```typescript
// GOOD: Clear what we're catching and handling
try {
  await operation();
} catch (error) {
  console.error("Operation failed:", error);
}
```

### ❌ Type-Unsafe Error Access

```typescript
// BAD: Assuming error has a message property
catch (error) {
  console.log(error.message); // error might be a string!
}
```

### ✅ Correct: Type-Safe Access

```typescript
// GOOD: Handle any error type safely
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(message);
}
```

## Logging Best Practices

### Include Relevant Context

```typescript
logger.error(
  {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    userId: user?.id,          // Who was affected
    projectId: project?.id,    // What resource
    operationId: operationId,  // Which operation
    duration: Date.now() - startTime, // How long it took
  },
  "Descriptive message about what failed"
);
```

### Structure for Analysis

- Always include `error` field with message
- Always include `stack` for unexpected errors
- Always include relevant IDs (user, project, etc.)
- Descriptive final message for log searching

## Testing Error Handling

### Test Happy Path and Error Cases

```typescript
// ✅ Test successful operation
test("creates user successfully", async () => {
  const user = await createUser({ username: "test" });
  expect(user.id).toBeDefined();
});

// ✅ Test error handling
test("throws on duplicate username", async () => {
  await createUser({ username: "test" });
  await expect(
    createUser({ username: "test" })
  ).rejects.toThrow("already exists");
});

// ✅ Test recovery
test("retries on network error", async () => {
  // Setup mock to fail once, then succeed
  mockFetch.mockRejectedValueOnce(new Error("Network error"));
  mockFetch.mockResolvedValueOnce({ ok: true });
  
  const result = await fetchWithRetry("/api/data");
  expect(result).toBeDefined();
});
```

## References

- [AGENTS.md](./AGENTS.md) - Clean code principles
- [async-patterns.md](./async-patterns.md) - Pattern-specific guides
- [database-transactions.md](./database-transactions.md) - Transaction error handling
