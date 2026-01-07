# OpenCode Event Lifecycle - Visual Guide

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER SENDS INITIAL PROMPT                         │
│                                                                      │
│  - handleSend() called                                              │
│  - setIsStreaming(true)  ← Streaming starts                         │
│  - POST /prompt_async                                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                     [SSE Stream Opens]
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  chat.message.part.added                                            │
│  (partType: "text", deltaText: "I'll...")                          │
│                                                                      │
│  Handler: Append text to message                                   │
│  Result:  setIsStreaming(true) [already true]                      │
│  Overlay: VISIBLE ✓                                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  chat.tool.update (read_file)                                      │
│  (status: "running")                                               │
│                                                                      │
│  Handler: Add tool to display, status "running"                    │
│  Result:  isStreaming unchanged                                    │
│  Overlay: VISIBLE ✓                                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                      [Tool Executes]
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  chat.tool.update (read_file)                                      │
│  (status: "success", output: "file contents...")                   │
│                                                                      │
│  Handler: Update tool status, show output                          │
│  Result:  isStreaming unchanged                                    │
│  Overlay: VISIBLE ✓                                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  chat.message.part.added (more text)                               │
│  (partType: "text", deltaText: " Found the issue...")             │
│                                                                      │
│  Handler: Append more text to message                             │
│  Result:  setIsStreaming(true) [still true]                        │
│  Overlay: VISIBLE ✓                                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  chat.message.final                                                │
│  (messageId: "msg_...")                                            │
│                                                                      │
│  Handler: Mark message.isStreaming = false (UI only)              │
│  Result:                                                            │
│    BEFORE FIX: setIsStreaming(false) → Overlay DISAPPEARS ✗       │
│    AFTER FIX:  No state change       → Overlay VISIBLE ✓           │
│                                                                      │
│  💡 Why? More tools might execute!                                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
         [Agent might execute more tools or send more text]
                              ↓
                  [Repeat tool execution pattern]
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  chat.session.status                                               │
│  (status: "idle" or "completed")                                  │
│                                                                      │
│  Handler: Agent is DONE with ALL work                              │
│  Result:  setIsStreaming(false)  ✓ FINAL                           │
│  Overlay: DISAPPEARS (as intended)                                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                [SSE Stream Remains Open]
              [Ready for next user message]
```

## State Timeline

```
Time →

isStreaming:  F──────T─────────T─────────T────────T─────────────────F
              Init  Send   Text1   Tool1  Text2 Final(no change!)  Idle
              
Overlay:      ─     SHOW    SHOW    SHOW   SHOW      SHOW FIXED    HIDE
                                                    (WAS: disappeared)

chat.message.final → Before: ruins it ✗
                  → After:  ignored ✓
                  
chat.session.status idle → Trusted endpoint ✓
```

## Event Type Significance

```
┌──────────────────────────────────────────────────────────────────────┐
│ EVENT TYPE              │ WHAT IT MEANS          │ USE FOR            │
├─────────────────────────┼────────────────────────┼────────────────────┤
│ chat.message.part.added │ Text is streaming      │ Display text       │
│                         │ or tool started        │ Show tools         │
├─────────────────────────┼────────────────────────┼────────────────────┤
│ chat.tool.update        │ Tool status changed    │ Update tool state  │
│ (running/success/error) │ (running → complete)   │ Show output        │
├─────────────────────────┼────────────────────────┼────────────────────┤
│ chat.message.final      │ TEXT MESSAGE DONE      │ Mark message done  │
│                         │ (NOT entire response)  │ WRONG for overlay! │
├─────────────────────────┼────────────────────────┼────────────────────┤
│ chat.session.status     │ SESSION STATE CHANGED  │ Source of truth    │
│ (idle/completed/busy)   │ (ENTIRE response)      │ for completion ✓   │
└──────────────────────────────────────────────────────────────────────┘
```

## The Key Insight

```
chat.message.final fires at:
  "I have finished streaming MY TEXT"
  └─ May or may not be the end of agent work

chat.session.status: "idle" fires at:
  "I have finished ALL my work"
  └─ Definitely the end of agent work ✓

Therefore:
  Use message.final for:  Marking text as done (internal)
  Use session.status for: Declaring completion (UI)
```

## Event Sequence Variations

The agent might take different paths:

### Path A: Single Response (Simple)
```
message.part.added (text)
message.final
session.status: idle
```

### Path B: Text + Tools + More Text (Current Bug)
```
message.part.added (text)     ← Agent thinking
message.final                  ← Text done (but more work!)
chat.tool.update (running)
chat.tool.update (success)
message.part.added (text)     ← More explanation
message.final                  ← NOW text is really done
session.status: idle           ← EVERYTHING done
```

### Path C: Multiple Tool Rounds (Complex)
```
message.part.added (text)
message.final
tool group 1:
  tool.update (running)
  tool.update (success)
message.part.added (more text)
message.final
tool group 2:
  tool.update (running)
  tool.update (success)
message.part.added (final text)
message.final
session.status: idle
```

**In ALL cases:** Only `session.status: idle` marks true completion!

## Implications for UI Design

```
┌─────────────────────────────────────────────┐
│ WHEN TO SHOW "BUILDING PREVIEW..." OVERLAY │
├─────────────────────────────────────────────┤
│                                             │
│ Show when:  userMessageCount === 1         │
│             && isStreaming === true         │
│                                             │
│ Hide when:  chat.session.status === "idle" │
│             └─ setIsStreaming(false)        │
│                                             │
│ NOT when:   chat.message.final              │
│             └─ This is too early!           │
│                                             │
└─────────────────────────────────────────────┘
```

## Summary

The fix changes **when** `isStreaming` gets set to false:

**BEFORE:**
- message.final event → setIsStreaming(false) ✗ **Too early**
- session.status idle → setIsStreaming(false) ✓ **Redundant**

**AFTER:**
- message.final event → no state change ✓ **Correct**
- session.status idle → setIsStreaming(false) ✓ **True signal**

This ensures the overlay stays visible for the entire agent response lifecycle!
