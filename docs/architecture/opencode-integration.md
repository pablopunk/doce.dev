# OpenCode Integration

The application integrates with the OpenCode SDK to provide AI-powered code generation and chat capabilities.

## Client

The OpenCode client is created using `@opencode-ai/sdk` and communicates with the OpenCode server running in each project's container via HTTP.

Each project has its own OpenCode instance running on a dynamically allocated port. The client is created on-demand when needed for API calls.

## SSE Event Normalization

The OpenCode server emits raw Server-Sent Events (SSE) during chat sessions. The normalization layer transforms these into a stable schema for the frontend.

**Why normalize?**
- Decouple frontend from OpenCode's internal event format
- Add semantic meaning (tool start vs finish, error states)
- Track message/part IDs for UI rendering
- Handle reasoning content accumulation

**Normalized Event Types**:
- `chat.session.status` - Session state changes (idle, busy)
- `chat.message.delta` - Streaming text content
- `chat.message.part.added` - New message part added
- `chat.message.final` - Complete message ready
- `chat.tool.start` - Tool execution began
- `chat.tool.finish` - Tool execution completed
- `chat.tool.error` - Tool execution failed
- `chat.reasoning.part` - AI reasoning/thinking content
- `chat.file.changed` - File was modified
- `chat.event.unknown` - Unrecognized upstream event

## Session Lifecycle

1. **Create**: Call OpenCode API to create a new session
2. **Init**: Initialize with system prompt (triggers AGENTS.md creation)
3. **Prompt**: Send user messages via `prompt_async` API
4. **Stream**: Receive SSE events for real-time updates
5. **Idle**: Session goes idle when AI finishes responding

## File Structure

```
src/server/opencode/
├── client.ts      # OpenCode SDK client factory
└── normalize.ts   # SSE event normalization
```
