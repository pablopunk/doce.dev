# OpenCode Integration

The application integrates with the OpenCode SDK (v2) to provide AI-powered code generation and chat capabilities.

## SDK Version

Using `@opencode-ai/sdk` v2 API which provides:
- Type-safe API client with full TypeScript support
- All event types exported from `@opencode-ai/sdk/v2/client`
- Flat parameter structure for API calls
- Health check endpoint via `client.global.health()`

## Client

The OpenCode client is created using `createOpencodeClient` from `@opencode-ai/sdk/v2/client` and communicates with the OpenCode server running in each project's container via HTTP.

Each project has its own OpenCode instance running on a dynamically allocated port. The client is created on-demand when needed for API calls.

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";

const client = createOpencodeClient({
  baseUrl: `http://127.0.0.1:${port}`,
});

// Session management
await client.session.create();
await client.session.init({ sessionID, modelID, providerID, messageID });
await client.session.promptAsync({ sessionID, parts: [...] });
await client.session.messages({ sessionID });

// Health check
await client.global.health();
```

## SSE Event Normalization

The OpenCode server emits typed SDK events during chat sessions. The normalization layer transforms these into a simplified schema for the frontend React components.

**Why normalize?**
- Simplify complex SDK event types for React state management
- Track message/part IDs for UI rendering
- Handle streaming state (current message, tool call tracking)
- Provide stable IDs across component re-renders

**SDK Event Types Used** (from `@opencode-ai/sdk/v2/client`):
- `EventSessionStatus` - Session state changes (idle, busy)
- `EventMessagePartUpdated` - Text streaming, tool calls, reasoning
- `EventMessageUpdated` - Message completion
- `EventFileEdited` - File modifications

**Normalized Event Types** (for frontend):
- `chat.session.status` - Session state changes
- `chat.message.part.added` - Streaming text content with delta
- `chat.message.final` - Complete message ready
- `chat.tool.start` - Tool execution began
- `chat.tool.finish` - Tool execution completed
- `chat.tool.error` - Tool execution failed
- `chat.reasoning.part` - AI reasoning/thinking content
- `chat.file.changed` - File was modified

## Session Lifecycle

1. **Create**: `client.session.create()` - Create a new session
2. **Prompt**: `client.session.promptAsync({ sessionID, model, parts })` - Send user messages with model config
3. **Stream**: Receive SSE events via `/event` endpoint
4. **Idle**: Session goes idle when AI finishes responding

## Types

The SDK exports all message and part types that can be used directly:

```typescript
import type {
  Event,
  EventSessionStatus,
  EventMessagePartUpdated,
  TextPart,
  ToolPart,
  ReasoningPart,
  ToolState,
  Message,
  UserMessage,
  AssistantMessage,
} from "@opencode-ai/sdk/v2/client";
```

For UI components, simplified types are defined in `src/types/message.ts` which re-exports SDK types with `SDK` prefix and provides doce-specific extensions like `ImagePart`.

## File Structure

```
src/server/opencode/
├── client.ts      # OpenCode SDK v2 client factory
└── normalize.ts   # SSE event normalization using SDK types

src/types/
└── message.ts     # Re-exports SDK types + doce-specific types (ImagePart)
```

## Queue Handlers

Session management is handled by queue handlers using the SDK client:

```
src/server/queue/handlers/
├── opencodeSessionCreate.ts   # client.session.create()
├── opencodeSessionInit.ts     # client.session.init() + client.session.messages()
└── opencodeSendUserPrompt.ts  # client.session.promptAsync() + client.session.messages()
```
