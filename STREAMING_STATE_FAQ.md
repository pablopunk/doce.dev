# Building Preview Overlay - FAQ

## Your Original Questions & Answers

### Q1: What's the reliable way to detect when the ENTIRE initial response is complete?

**Answer:** Use `chat.session.status` event with status value of `"idle"` or `"completed"`.

This is the only event that fires after the agent has truly finished ALL work:
- Text streaming
- Tool execution
- File modifications
- Any other processing

**Code:**
```typescript
case "chat.session.status": {
    const { status } = payload as { status: string };
    if (status === "idle" || status === "completed") {
        // ✓ Agent is DONE with everything
        setIsStreaming(false);
    }
    break;
}
```

**Why not other events?**
- `chat.message.final` - Only means text stopped streaming, not agent done
- `chat.tool.update` - Only means one tool completed, more might run
- `chat.message.part.added` - Just means text is coming, not done

---

### Q2: Should I be looking at `chat.session.status` "idle" as the source of truth instead of `isStreaming`?

**Answer:** YES, absolutely.

**For completion detection:** `chat.session.status` is the only source of truth.

**But `isStreaming` flag still has value:**
- It tracks user-facing activity state
- It controls UI elements (input disable, loading states)
- It drives visual feedback

**The key:** Don't set `isStreaming = false` on `chat.message.final`. Only set it false when session status indicates completion.

**Updated mental model:**
```
isStreaming = "Is the agent doing ANY work right now?"

Sources that set it TRUE:
  1. User sends message → setIsStreaming(true)
  2. Text starts streaming → setIsStreaming(true)

Source that sets it FALSE:
  1. chat.session.status: "idle"/"completed" → setIsStreaming(false) ✓

What DOESN'T set it FALSE anymore:
  1. chat.message.final (REMOVED) ✗
```

---

### Q3: Are there other events besides `chat.message.final` and `chat.session.status` that indicate completion?

**Answer:** Here are ALL the events, but none are reliable for completion:

| Event | Fires When | Indicates Complete? |
|-------|-----------|-----------------|
| `chat.message.part.added` | Text or tool streaming | ✗ No - just started |
| `chat.message.final` | Text stops streaming | ✗ No - more might come |
| `chat.tool.update` (success) | Tool finishes | ✗ No - more might run |
| `chat.tool.update` (error) | Tool fails | ✗ No - agent continues |
| `chat.file.changed` | File modified | ✗ No - more coming |
| `chat.reasoning.part` | Thinking shown | ✗ No - still thinking |
| `chat.session.status` (idle) | Session finishes | ✓ YES - truly done |
| `chat.session.status` (completed) | Session marked done | ✓ YES - truly done |

**Only reliable indicators:** `chat.session.status` with value `"idle"` or `"completed"`

---

### Q4: What's the lifecycle of a typical agent response?

**Answer:** Here's the complete lifecycle with all possible events:

#### Scenario A: Simple Response (Just text)
```
1. chat.message.part.added (text delta)
2. chat.message.final (text done)
3. chat.session.status: "idle" (agent done) ✓ Completion here
```

#### Scenario B: Text + Single Tool (Current case)
```
1. chat.message.part.added (text: "I'll analyze...")
2. chat.message.final (text done, but wait...)
3. chat.tool.update (read: "running")
4. chat.tool.update (read: "success", output)
5. chat.message.part.added (text: "Found issue...")
6. chat.message.final (text done again)
7. chat.session.status: "idle" (agent done) ✓ Completion here
```

#### Scenario C: Text + Multiple Tools
```
1. chat.message.part.added (text)
2. chat.message.final
3. chat.tool.update (glob: "running")
4. chat.tool.update (glob: "success")
5. chat.tool.update (read: "running")
6. chat.tool.update (read: "success")
7. chat.tool.update (edit: "running")
8. chat.tool.update (edit: "success")
9. chat.message.part.added (text: "Done!")
10. chat.message.final
11. chat.session.status: "idle" (agent done) ✓ Completion here
```

#### Scenario D: Complex (Multiple rounds)
```
1. chat.message.part.added (text)
2. chat.message.final
3. [Tool Round 1: multiple tools]
4. chat.message.part.added (text)
5. chat.message.final
6. [Tool Round 2: more tools]
7. chat.message.part.added (text)
8. chat.message.final
9. chat.session.status: "idle" (agent done) ✓ Completion here
```

**Pattern:** In ALL scenarios, only `chat.session.status: "idle"` marks true completion.

---

## Event Handler Decision Tree

```
┌─ chat.message.part.added?
│  └─ YES: Is it text (deltaText)?
│     ├─ YES: Append text, setIsStreaming(true)
│     └─ NO: Handle tool or reasoning, don't change isStreaming
│
├─ chat.tool.update?
│  └─ YES: Update tool state, DON'T change isStreaming
│
├─ chat.message.final?
│  ├─ Before fix: setIsStreaming(false) ✗ WRONG
│  └─ After fix: Mark message done, DON'T change isStreaming ✓
│
└─ chat.session.status?
   └─ "idle" or "completed"?
      ├─ YES: setIsStreaming(false) ✓ CORRECT
      └─ NO: Probably "busy", don't change
```

---

## The Missing Piece: Why `chat.message.final` is Misleading

**What its name suggests:**
"The message is final and done, no more work"

**What it actually means:**
"The text part of this message is done streaming"

**Why the confusion?**
- Named poorly for UI logic
- It's a message event, not a session event
- Multiple messages can exist in one agent response
- Tools are separate from messages in the event model

**The fix:**
Don't use `chat.message.final` for completion detection. It's only useful for:
- Marking the visual message as "not streaming"
- Removing cursor animation
- Other UI-only purposes

**Use `chat.session.status` instead** for everything involving:
- UI state (input enable/disable)
- Loading overlays
- Completion detection
- Processing indicators

---

## Implementation Checklist

After implementing this fix:

- [x] Removed `setIsStreaming(false)` from `chat.message.final` handler
- [x] Kept `setIsStreaming(false)` in `chat.session.status` handler  
- [x] Verified overlay stays visible during tool execution
- [x] Added comments explaining why the change was needed
- [x] Tested with various agent response patterns
- [ ] Monitor production for any edge cases
- [ ] Consider renaming `isStreaming` to `sessionActive` (future)

---

## Key Takeaways

1. **`chat.session.status: "idle"` is the source of truth** for "is work done?"

2. **`chat.message.final` is not reliable** for completion - it fires too early

3. **Multiple events can fire** during a single agent response - don't assume one means done

4. **Event names can be misleading** - understand what each event ACTUALLY means, not what it sounds like

5. **The overlay fix is simple:** Don't react to `message.final`, wait for `session.status`

---

## Debugging Tips

If the overlay still disappears prematurely:

1. **Check event order in browser console:**
```javascript
// Add to handleEvent in ChatPanel.tsx:
console.log('Event:', type, 'Status:', payload.status);
```

2. **Look for unexpected status values:**
```javascript
// Which status values are being sent?
// Beyond "idle" and "completed"?
case "chat.session.status": {
    console.log('Session status:', payload.status);
    // Should see: "idle" or "completed" when truly done
}
```

3. **Trace the complete event sequence:**
Record all events for one user message and map them:
- When does overlay appear?
- When does it disappear?
- What events fired in between?

4. **Check the session ID:**
```javascript
// Are all events from the same session?
// Or did a new session start?
if (eventSessionId) {
    console.log('Session ID changed:', eventSessionId);
}
```

---

## Related Documentation

- `OVERLAY_STREAMING_FIX.md` - Technical analysis
- `OVERLAY_FIX_SUMMARY.md` - Fix summary and testing
- `EVENT_LIFECYCLE_DIAGRAM.md` - Visual event flow
- `src/server/opencode/normalize.ts` - Event normalization logic
- `src/components/chat/ChatPanel.tsx` - Event handlers

---

## Questions Not Covered Here?

See the main documentation files for:
- Alternative solutions considered
- Future improvements
- More detailed event flow diagrams
- Implementation alternatives
