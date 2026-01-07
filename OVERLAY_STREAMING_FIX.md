# Building Preview Overlay Fix

## Problem

The "Building preview..." overlay disappears momentarily after each tool call completes, even though the agent is still working. This happens because `isStreaming` flag gets set to `false` when `chat.message.final` event fires, which occurs when text streaming completes - not when the entire agent response is complete.

## Root Cause

**Event Lifecycle Mismatch:**

The current implementation treats these events as equivalent:
- `chat.message.final` - fires when **text message stops streaming**
- `chat.session.status: "idle"` - fires when **session completely finishes processing**

But they don't happen at the same time. The actual sequence is:

```
1. chat.message.part.added (text streaming)
   → setIsStreaming(true) ✓
   
2. chat.tool.update (tool execution)
   
3. chat.message.final (text stops streaming)
   → setIsStreaming(false) ✗ WRONG! Agent still working
   
4. More tool execution happens
   
5. chat.session.status: "idle" (agent truly done)
   → SHOULD set isStreaming(false)
```

## Solution

Use **`chat.session.status`** as the source of truth for overall processing state, not `chat.message.final`.

### Implementation Strategy

**Key Principles:**
1. Separate concerns: track message streaming separately from session processing
2. Use session status as the definitive "done" signal
3. For the overlay, use session status, not text streaming status

### Option A: Simple Fix (Recommended)

Modify the event handler in `ChatPanel.tsx` to NOT set `isStreaming = false` on `chat.message.final`:

**Remove this** (line 499-515):
```typescript
case "chat.message.final": {
    const { messageId } = payload as { messageId: string };

    setItems((prev) =>
        prev.map((item) =>
            item.id === messageId && item.type === "message"
                ? {
                        ...item,
                        data: { ...(item.data as Message), isStreaming: false },
                    }
                : item,
        ),
    );

    setIsStreaming(false);  // ← REMOVE THIS LINE
    break;
}
```

This way, `isStreaming` only changes based on:
- `true` → when user sends message (setIsStreaming(true) at line 774)
- `true` → when text first streams (setIsStreaming(true) at line 433)
- `false` → ONLY when session becomes idle (line 584)

**Pros:**
- Minimal code change
- Works immediately
- Preserves all existing logic

**Cons:**
- The isStreaming flag becomes slightly misleading (it's not just about streaming)
- Should rename to `sessionActive` for clarity (optional)

### Option B: Comprehensive Refactor

Rename `isStreaming` to `sessionActive` throughout and be explicit:

1. **In ChatPanel.tsx:**

```typescript
// Replace line 54
const [sessionActive, setSessionActive] = useState(false);

// Update event handlers:
case "chat.message.part.added": {
    // ... existing code ...
    setSessionActive(true);  // Changed from setIsStreaming
    break;
}

case "chat.message.final": {
    // REMOVE setIsStreaming(false) here
    // Session might still have tools running
    break;
}

case "chat.tool.update": {
    // No need to change - tools running doesn't affect session status
    break;
}

case "chat.session.status": {
    const { status } = payload as { status: string };
    // Set active true if session starts, false if it ends
    if (status === "idle" || status === "completed") {
        setSessionActive(false);
    } else if (status === "busy" || status === "running") {
        setSessionActive(true);
    }
    break;
}
```

2. **Update callback prop name:**
```typescript
// Line 27-29
onStreamingStateChange?: ((userMessageCount: number, sessionActive: boolean) => void) | undefined;

// Line 349
onStreamingStateChange?.(userMessageCount, sessionActive);
```

3. **Update ProjectContentWrapper.tsx:**
```typescript
// Line 33
const [sessionActive, setSessionActive] = useState(false);

// Line 108-111
onStreamingStateChange={(count, active) => {
    setUserMessageCount(count);
    setSessionActive(active);
}}
```

4. **Update PreviewPanel.tsx:**
```typescript
// Change prop name from isStreaming to sessionActive
// Line condition remains the same:
{userMessageCount === 1 && sessionActive && (
    // overlay...
)}
```

**Pros:**
- Clear semantics - code says what it means
- Future maintainers understand the intent
- More accurate flag name

**Cons:**
- Larger refactor (but still small)
- Touches more files

## Event Lifecycle Reference

From `/src/server/opencode/normalize.ts`, the normalized events are:

1. **`chat.message.part.added`** - Text is streaming
   - Triggered by `message.part.updated` with a text delta
   - Use to show: text appearing in real-time

2. **`chat.tool.update`** - Tool is running/completed
   - Triggered by `message.part.updated` with tool part
   - Statuses: "running", "success", "error"
   - Use to show: tool progress

3. **`chat.message.final`** - Message complete (text streaming done)
   - Triggered by `message.updated` event
   - Does NOT mean session is done
   - Don't use for overlay visibility

4. **`chat.session.status`** - Session status changed
   - Triggered by `session.status` event
   - Values: "idle", "busy", "completed", etc.
   - Use as source of truth for "is work still happening"

5. **`chat.file.changed`** - File was edited
   - Use for file watching/refresh

## When to Show the Overlay

**Current (buggy):**
```typescript
{userMessageCount === 1 && isStreaming && (
    // overlay
)}
```

**Fixed:**
```typescript
{userMessageCount === 1 && sessionActive && (
    // overlay
)}
```

Where `sessionActive` is:
- `true` when session starts processing (first text or any non-idle status)
- `false` when session reaches "idle" or "completed"

## Testing

After implementing the fix:

1. Send initial prompt to agent
2. Watch overlay appear
3. Observe as tools execute (glob, read, edit, etc)
4. **Overlay should stay visible** through all tool execution
5. Overlay should only disappear when session truly completes

## Files to Modify

1. `/src/components/chat/ChatPanel.tsx` - Main fix
2. `/src/components/projects/ProjectContentWrapper.tsx` - Pass renamed prop
3. `/src/components/preview/PreviewPanel.tsx` - Use renamed prop

**Option A** (Simple): Only modify ChatPanel.tsx line 513 (remove one line)

**Option B** (Comprehensive): Rename and update all three files
