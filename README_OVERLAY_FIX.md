# Building Preview Overlay Fix - Documentation Index

## Quick Summary

Fixed the "Building preview..." overlay disappearing prematurely by removing `setIsStreaming(false)` from the `chat.message.final` event handler and relying instead on `chat.session.status` for completion detection.

**Change:** 1 line removed  
**Impact:** Overlay now stays visible through entire agent response  
**Build:** ✅ Passes

## Your Questions Answered

### Q1: What's the reliable way to detect when the ENTIRE initial response is complete?

**Answer:** Use `chat.session.status` event when status is `"idle"` or `"completed"`.

This is the only event that fires after all agent work finishes.

**Read More:** `STREAMING_STATE_FAQ.md` → Question 1

### Q2: Should I be looking at `chat.session.status` "idle" as the source of truth?

**Answer:** YES, absolutely.

`chat.session.status` is the definitive completion signal. The `isStreaming` flag should only be controlled by this event.

**Read More:** `STREAMING_STATE_FAQ.md` → Question 2

### Q3: Are there other events indicating completion?

**Answer:** NO. Only `chat.session.status` with "idle" or "completed".

`chat.message.final` is misleading - it only means text stopped streaming, not everything is done.

**Read More:** `STREAMING_STATE_FAQ.md` → Question 3

### Q4: What's the event lifecycle?

**Answer:** Text → Message Final → Tools → More Tools → Session Idle

Multiple tools can execute after `chat.message.final` fires.

**Read More:** `EVENT_LIFECYCLE_DIAGRAM.md` → Event Flow Diagram

## Documentation Files

### Primary References

| File | Purpose | Read When |
|------|---------|-----------|
| **STREAMING_STATE_FAQ.md** | Your 4 questions answered | First - answers your specific questions |
| **EVENT_LIFECYCLE_DIAGRAM.md** | Visual event flow and timing | Want to understand event order |
| **OVERLAY_FIX_SUMMARY.md** | Complete implementation guide | Need full context on the fix |
| **OVERLAY_STREAMING_FIX.md** | Technical deep dive | Want technical analysis |

### Quick Start

1. **I just want the answer to my question:**
   → Read `STREAMING_STATE_FAQ.md`

2. **I want to understand the event lifecycle:**
   → Read `EVENT_LIFECYCLE_DIAGRAM.md`

3. **I want to know everything:**
   → Read all files in the order above

4. **I want to see the implementation:**
   → Look at `src/components/chat/ChatPanel.tsx` lines 499-520

## The Fix at a Glance

### Problem
```
chat.message.final (text stops)
  ↓
setIsStreaming(false)  ← Too early!
  ↓
Overlay disappears ✗ (but tools still running)
```

### Solution
```
chat.message.final (text stops)
  ↓
No change to isStreaming
  ↓
Overlay stays visible ✓
  ↓
chat.session.status: idle (EVERYTHING done)
  ↓
setIsStreaming(false) ✓ Now it's correct
  ↓
Overlay disappears
```

## Key Insights

### 1. Event Names Are Misleading
- `chat.message.final` sounds like "everything is final"
- But it really means "this text message part is final"
- More work can happen after this event

### 2. Session vs Message
- Message = one unit of communication
- Session = entire conversation/interaction
- Completion = session done, not message done

### 3. Complex Workflows Need Complex State
- Text can stream multiple times
- Tools execute between text
- Multiple rounds of tools possible
- Only session status captures true completion

### 4. State Sources Matter
- `chat.message.part.added` - Part is streaming
- `chat.tool.update` - Tool executed
- `chat.message.final` - Message text done (NOT session)
- `chat.session.status` - Session done (TRUE completion) ✓

## Implementation Details

### Files Modified
1. `src/components/chat/ChatPanel.tsx` - Removed problematic line
2. `src/components/preview/PreviewPanel.tsx` - Fixed types

### Commits
1. `c335746` - fix: keep building preview overlay visible...
2. `f1bd6db` - docs: add comprehensive overlay fix documentation
3. `7ba5db7` - docs: add FAQ answering original streaming state questions

### Build Status
✅ Builds successfully
✅ No TypeScript errors
✅ All type checks pass

## Testing

After deploying:

1. Send initial prompt to agent
2. Observe "Building preview..." overlay appears
3. Watch tools execute (read, glob, edit, etc)
4. **CRITICAL:** Overlay should stay visible the ENTIRE time
5. Overlay disappears when agent finishes
6. Chat input re-enables

## Technical Details

### Why chat.message.final Is Not Reliable

```
chat.message.final fires when:
  - Text part of message stops streaming
  - But agent might execute more tools after

Example sequence:
  1. chat.message.part.added (text: "I'll analyze...")
  2. chat.message.final ← Text done!
  3. chat.tool.update (glob) ← But more work!
  4. chat.tool.update (read)
  5. chat.message.part.added (text: "Here's what I found...")
  6. chat.message.final ← NOW text is really done
  7. chat.session.status: "idle" ← EVERYTHING done ✓
```

### Why chat.session.status IS Reliable

```
chat.session.status: "idle" fires when:
  - Session has completed ALL work
  - No more tools will execute
  - No more text will stream
  - Interaction is truly done
```

## Future Improvements

1. **Better naming:** Rename `isStreaming` to `sessionActive` - clearer semantics
2. **Granular tracking:** Separate message streaming from session state
3. **Better events:** Consider contributing improved naming upstream to OpenCode SDK
4. **Enhanced UI:** Show different indicators for text vs tools

## Debugging Tips

If overlay still behaves incorrectly:

1. Check session status values being sent
   ```typescript
   case "chat.session.status": {
       console.log('Status:', payload.status);
   }
   ```

2. Log all events
   ```typescript
   const handleEvent = (event) => {
       console.log('Event:', event.type);
   };
   ```

3. Track overlay visibility
   ```typescript
   console.log('Overlay visible:', userMessageCount === 1 && isStreaming);
   ```

4. Verify session ID consistency
   ```typescript
   if (eventSessionId) console.log('Session:', eventSessionId);
   ```

## Related Files

- `src/server/opencode/normalize.ts` - Event normalization, event types
- `src/components/chat/ChatPanel.tsx` - Event handling implementation
- `src/components/preview/PreviewPanel.tsx` - Overlay rendering
- `src/types/message.ts` - Message and event types

## Questions?

See the comprehensive documentation:
- **Your specific questions:** STREAMING_STATE_FAQ.md
- **Visual reference:** EVENT_LIFECYCLE_DIAGRAM.md  
- **Complete guide:** OVERLAY_FIX_SUMMARY.md
- **Technical deep dive:** OVERLAY_STREAMING_FIX.md

## Status

✅ **COMPLETE AND READY FOR DEPLOYMENT**

- Code fix implemented
- Build verified
- Comprehensive documentation created
- Ready for code review and deployment
