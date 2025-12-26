/**
 * SSE Event normalization for the chat UI.
 * 
 * Uses SDK types directly and only adds doce.dev-specific transformations.
 * The main purpose of this layer is to:
 * 1. Transform SDK events into a simpler shape for the frontend
 * 2. Track state for streaming messages (text accumulation, tool calls)
 * 3. Generate stable IDs for UI elements
 */

import type {
  Event,
  EventMessagePartUpdated,
  EventSessionStatus,
  EventMessageUpdated,
  EventFileEdited,
  ToolPart as SDKToolPart,
  TextPart as SDKTextPart,
  ReasoningPart as SDKReasoningPart,
} from "@opencode-ai/sdk/v2/client";

// ============================================================================
// Normalized Event Types (for frontend consumption)
// ============================================================================

export type NormalizedEventType =
  | "chat.session.status"
  | "chat.message.part.added"
  | "chat.message.final"
  | "chat.tool.update"
  | "chat.reasoning.part"
  | "chat.file.changed"
  | "chat.event.unknown";

export interface NormalizedEventEnvelope {
  type: NormalizedEventType;
  projectId: string;
  sessionId?: string;
  time: string;
  payload: unknown;
}

// Payload types for each event
export interface SessionStatusPayload {
  status: string;
  cost?: number;
}

export interface MessagePartPayload {
  messageId: string;
  partId: string;
  partType: "text" | "tool" | "reasoning" | "error" | "file";
  deltaText?: string;
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  toolStatus?: "pending" | "running" | "completed" | "error";
  toolError?: string;
}

export interface MessageFinalPayload {
  messageId: string;
}

export interface ReasoningPartPayload {
  messageId: string;
  partId: string;
  text: string;
}

export interface ToolUpdatePayload {
  toolCallId: string;
  name: string;
  input?: unknown;
  status: "running" | "success" | "error";
  output?: unknown;
  error?: unknown;
}

export interface FileChangedPayload {
  path: string;
}

export interface UnknownEventPayload {
  upstreamEventType: string;
  upstreamData: unknown;
}

// ============================================================================
// Normalization State
// ============================================================================

/**
 * State maintained per SSE connection for tracking streaming context.
 */
export interface NormalizationState {
  /** Current assistant message being streamed */
  currentMessageId: string | null;
  /** Map of upstream tool callIDs to our stable tool IDs */
  toolCallMap: Map<string, string>;
  /** Counter for generating unique tool IDs */
  toolCounter: number;
  /** Map of part keys to stable part IDs */
  partIdMap: Map<string, string>;
}

export function createNormalizationState(): NormalizationState {
  return {
    currentMessageId: null,
    toolCallMap: new Map(),
    toolCounter: 0,
    partIdMap: new Map(),
  };
}

// ============================================================================
// ID Generation
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOrCreatePartId(state: NormalizationState, key: string, prefix: string): string {
  let id = state.partIdMap.get(key);
  if (!id) {
    id = generateId(prefix);
    state.partIdMap.set(key, id);
  }
  return id;
}

function getOrCreateToolId(state: NormalizationState, callId: string): string {
  let id = state.toolCallMap.get(callId);
  if (!id) {
    state.toolCounter++;
    id = generateId(`tool_${state.toolCounter}`);
    state.toolCallMap.set(callId, id);
  }
  return id;
}

// ============================================================================
// Event Normalization
// ============================================================================

/**
 * Normalize an SDK event into our simplified schema for the frontend.
 */
export function normalizeEvent(
  projectId: string,
  event: Event,
  state: NormalizationState
): NormalizedEventEnvelope | null {
  const time = new Date().toISOString();

  switch (event.type) {
    // Session status changes (idle, busy, etc.)
    case "session.status": {
      const statusEvent = event as EventSessionStatus;
      const status = statusEvent.properties?.status;
      return {
        type: "chat.session.status",
        projectId,
        time,
        payload: {
          status: typeof status === "object" && status !== null && "type" in status
            ? (status as { type?: string }).type ?? "unknown"
            : "unknown",
        } satisfies SessionStatusPayload,
      };
    }

    // Message part updates (text streaming, tool calls, reasoning)
    case "message.part.updated": {
      const partEvent = event as EventMessagePartUpdated;
      const part = partEvent.properties?.part;
      const delta = partEvent.properties?.delta;

      if (!part) return null;

      // Text part with streaming delta
      if (part.type === "text" && delta) {
        const textPart = part as SDKTextPart;
        const messageId = textPart.messageID || state.currentMessageId || generateId("msg");
        state.currentMessageId = messageId;

        const partId = getOrCreatePartId(state, `text_${messageId}`, "part_text");

        return {
          type: "chat.message.part.added",
          projectId,
          time,
          payload: {
            messageId,
            partId,
            partType: "text",
            deltaText: delta,
          } satisfies MessagePartPayload,
        };
      }

      // Reasoning part
      if (part.type === "reasoning") {
        const reasoningPart = part as SDKReasoningPart;
        const messageId = reasoningPart.messageID || state.currentMessageId || generateId("msg");
        const partId = getOrCreatePartId(state, `reasoning_${messageId}`, "part_reasoning");

        return {
          type: "chat.reasoning.part",
          projectId,
          time,
          payload: {
            messageId,
            partId,
            text: reasoningPart.text || "",
          } satisfies ReasoningPartPayload,
        };
      }

      // Tool part - emit single update event with current status
      if (part.type === "tool") {
        const toolPart = part as SDKToolPart;
        const { callID, tool, state: toolState } = toolPart;
        
        if (!callID || !tool) return null;

        const toolCallId = getOrCreateToolId(state, callID);
        const sdkStatus = toolState?.status;

        // Map SDK status to UI status
        let uiStatus: "running" | "success" | "error" = "running";
        if (sdkStatus === "completed") {
          uiStatus = "success";
          state.toolCallMap.delete(callID);
        } else if (sdkStatus === "error") {
          uiStatus = "error";
          state.toolCallMap.delete(callID);
        }

        // Emit single tool update event
        return {
          type: "chat.tool.update",
          projectId,
          time,
          payload: {
            toolCallId,
            name: tool,
            input: (toolState as any)?.input,
            status: uiStatus,
            output: (toolState as any)?.output,
            error: (toolState as any)?.error,
          } satisfies ToolUpdatePayload,
        };
      }

      return null;
    }

    // Message completed
    case "message.updated": {
      const msgEvent = event as EventMessageUpdated;
      const info = msgEvent.properties?.info;
      
      // Only emit final for assistant messages
      if (info?.role === "assistant" && state.currentMessageId) {
        const messageId = state.currentMessageId;
        state.currentMessageId = null;
        
        return {
          type: "chat.message.final",
          projectId,
          time,
          payload: { messageId } satisfies MessageFinalPayload,
        };
      }
      return null;
    }

    // File edited
    case "file.edited": {
      const fileEvent = event as EventFileEdited;
      const file = fileEvent.properties?.file;
      
      if (file) {
        return {
          type: "chat.file.changed",
          projectId,
          time,
          payload: { path: file } satisfies FileChangedPayload,
        };
      }
      return null;
    }

    // Session events we can ignore
    case "session.updated":
    case "session.created":
    case "session.deleted":
    case "session.idle":
    case "session.compacted":
    case "session.diff":
    case "session.error":
      return null;

    // Other events we don't need to handle
    case "permission.updated":
    case "permission.replied":
    case "message.removed":
    case "message.part.removed":
    case "file.watcher.updated":
    case "vcs.branch.updated":
    case "pty.created":
    case "pty.updated":
    case "pty.exited":
    case "pty.deleted":
    case "lsp.client.diagnostics":
    case "lsp.updated":
    case "installation.updated":
    case "installation.update-available":
    case "project.updated":
    case "server.connected":
    case "server.instance.disposed":
    case "todo.updated":
    case "command.executed":
    case "mcp.tools.changed":
    case "tui.prompt.append":
    case "tui.command.execute":
    case "tui.toast.show":
    case "global.disposed":
      return null;

    default:
      // Unknown event type - return for debugging if needed
      return {
        type: "chat.event.unknown",
        projectId,
        time,
        payload: {
          upstreamEventType: (event as { type: string }).type,
          upstreamData: (event as { properties?: unknown }).properties,
        } satisfies UnknownEventPayload,
      };
  }
}

/**
 * Parse SSE data line into an SDK Event object.
 */
export function parseSSEData(data: string): Event | null {
  try {
    const parsed = JSON.parse(data);
    if (typeof parsed === "object" && parsed !== null && "type" in parsed) {
      return parsed as Event;
    }
    return null;
  } catch {
    return null;
  }
}
