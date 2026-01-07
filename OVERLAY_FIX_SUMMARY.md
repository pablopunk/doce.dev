# Building Preview Overlay Fix - Summary

## What Was Fixed

The "Building preview..." overlay that shows when the user sends their first message was disappearing momentarily after each tool execution (read, glob, edit, etc.), even though the agent was still working.

## The Root Cause

**Premature `isStreaming` state reset:**

The overlay visibility was controlled by:
```typescript
{userMessageCount === 1 && isStreaming && (
    // overlay
)}
```

The `isStreaming` flag was being set to `false` too early - when the `chat.message.final` event fired. But this event only indicates that **text streaming has stopped**, not that the **entire agent response is complete**.

## The Event Lifecycle (Order of Events)

Understanding the actual order of events is critical:

```
1. User sends initial prompt
   └─ handleSend() sets isStreaming = true

2. chat.message.part.added (text: "I'll analyze...")
   └─ isStreaming = true ✓

3. chat.tool.update (read_file: "running")
   └─ no state change

4. chat.tool.update (read_file: "success")
   └─ no state change

5. chat.message.part.added (text: " Here's what I found...")
   └─ isStreaming = true (still streaming)

6. chat.message.final (message text complete)
   └─ BEFORE: setIsStreaming(false) ❌ WRONG!
   └─ Overlay disappears prematurely

7. chat.tool.update (glob: "running")
   └─ More tools can execute here!

8. ... more tool execution ...

9. chat.session.status: "idle" or "completed"
   └─ AFTER FIX: setIsStreaming(false) ✓ NOW it's correct
   └─ Overlay finally disappears
```

## The Solution

**Stop setting `isStreaming = false` on `chat.message.final` event.**

Instead, rely exclusively on `chat.session.status` to determine completion, since it fires after ALL processing is done.

### Code Change in ChatPanel.tsx

**Before:**
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
    
    setIsStreaming(false);  // ← REMOVED THIS
    break;
}
```

**After:**
```typescript
case "chat.message.final": {
    const { messageId } = payload as { messageId: string };
    
    // Mark the message as no longer streaming text, but don't set session-wide
    // isStreaming to false yet - the agent might still be executing tools.
    // We rely on chat.session.status event to determine overall completion.
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
    
    // Note: Do NOT set setIsStreaming(false) here.
    // The session might still be executing tools. We wait for
    // chat.session.status to become "idle" or "completed".
    break;
}
```

The only place `isStreaming` is now set to `false` is when session status is "idle" or "completed":
```typescript
case "chat.session.status": {
    const { status } = payload as { status: string };
    if (status === "completed" || status === "idle") {
        setIsStreaming(false);  // ✓ Correct - session truly done
    }
    break;
}
```

## State Flow After Fix

```
isStreaming = false (initial)
    ↓
[User sends first message]
    ↓
isStreaming = true (handleSend sets it)
    ↓
chat.message.part.added events (text streaming)
    ↓
chat.message.final event (text stops)
    ├─ Mark message as not streaming
    ├─ But DON'T change isStreaming ← KEY FIX
    ↓
chat.tool.update events (any more tools)
    ├─ No effect on isStreaming
    ↓
chat.session.status: "idle" or "completed"
    ├─ isStreaming = false ✓ NOW it's time
    ↓
Overlay disappears
```

## What This Fixes

✅ Overlay now stays visible throughout:
- Text streaming
- Tool execution
- File modifications
- All agent processing

✅ Overlay only disappears when:
- Session reaches "idle" or "completed" status
- Agent has finished ALL work

✅ No more flickering/flashing during tool execution

## What Doesn't Change

- Text still streams smoothly
- Tools still execute normally
- User can't send messages while processing (input stays disabled)
- All existing functionality preserved

## Testing Checklist

After deploying:

- [ ] Create a new project
- [ ] Send initial prompt to agent
- [ ] Verify "Building preview..." overlay appears
- [ ] Observe tools executing (read, glob, edit, etc)
- [ ] **Overlay stays visible the entire time** ← Most important
- [ ] Overlay disappears when agent finishes
- [ ] Chat input re-enables when overlay disappears
- [ ] Can send follow-up messages normally

## Technical Details

### Event Types Reference

From `/src/server/opencode/normalize.ts`:

| Event | Fires When | Lifecycle |
|-------|-----------|-----------|
| `chat.message.part.added` | Text streaming | During response |
| `chat.message.final` | Text stops streaming | Mid-response |
| `chat.tool.update` | Tool starts/completes | During response |
| `chat.session.status` | Session status changes | End of response |

**Key Insight:** Only `chat.session.status` fires when the session is truly complete. It's the source of truth for "is work still happening?"

### Why This Matters

The OpenCode SDK event model allows:
1. Multiple rounds of tool execution
2. Tool calls after initial text response
3. Continued processing after message finalization

This is why we need to wait for session status, not message finalization.

### Related Files

- `/src/components/chat/ChatPanel.tsx` - Event handling (main fix)
- `/src/components/preview/PreviewPanel.tsx` - Overlay rendering
- `/src/server/opencode/normalize.ts` - Event types documentation
- `/src/types/message.ts` - Message types

## Future Improvements

1. **Better semantic naming:** Consider renaming `isStreaming` to `sessionActive` since it now tracks session status, not text streaming
2. **Granular status tracking:** Could track "idle" vs "busy" vs "streaming" separately for more control
3. **Tool execution indicator:** Could add separate visual indicator for tool execution
4. **Session status display:** Could show more detailed status in UI

## Questions?

See `OVERLAY_STREAMING_FIX.md` for detailed technical analysis and alternative solutions considered.
