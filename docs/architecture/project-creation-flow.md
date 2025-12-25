# Project Creation Flow (Split Prompt Tracking)

When a project is created, TWO separate prompts are sent to the AI agent. This document explains why and how they're tracked.

## The Two Prompts

### 1. Init Prompt

Triggered by `session.init` in the `opencodeSessionInit` handler.

**Purpose**: Creates `AGENTS.md` file with project-specific instructions for the AI agent.

**Tracking**:
- Message ID stored in `projects.initPromptMessageId`
- Completion tracked via `projects.initPromptCompleted`

### 2. User Prompt

Sent by the `opencodeSendUserPrompt` handler.

**Purpose**: Contains the user's actual project request (e.g., "build a todo app", "clone this website").

**Tracking**:
- Message ID stored in `projects.userPromptMessageId`
- Completion tracked via `projects.userPromptCompleted`

## Why Split Tracking?

The init prompt and user prompt are separate operations that complete independently. The UI needs to know when BOTH are done before showing the chat interface.

Without split tracking:
- Setup display might disappear too early (after init, before user prompt completes)
- Users might see confusing AGENTS.md creation messages in their chat history

## Completion Detection

The SSE event handler (`event.ts`) counts idle events:

```
1st session.status: idle  →  Mark initPromptCompleted
2nd session.status: idle  →  Mark userPromptCompleted, emit setup.complete
```

## UI Behavior

**Setup Display**: Shows loading state until `initPromptCompleted && userPromptCompleted`

**Chat History**: Filters out init prompt messages using `initPromptMessageId`. Users only see their actual prompt and the AI's response.

## Database Columns

| Column | Purpose |
|--------|---------|
| initPromptMessageId | OpenCode message ID for init prompt |
| userPromptMessageId | OpenCode message ID for user prompt |
| initPromptCompleted | True when init prompt goes idle |
| userPromptCompleted | True when user prompt goes idle |
| initialPromptCompleted | Legacy column (kept for backward compatibility) |

## Timeline

```
Project created
      │
      ▼
session.init called
      │
      ├── AGENTS.md being generated
      │
      ▼
1st idle event ────► initPromptCompleted = true
      │
      ▼
prompt_async called with user's prompt
      │
      ├── AI working on user request
      │
      ▼
2nd idle event ────► userPromptCompleted = true
      │             initialPromptCompleted = true (legacy)
      │             emit setup.complete
      │
      ▼
UI transitions to chat view
```
