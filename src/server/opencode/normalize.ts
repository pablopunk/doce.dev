/**
 * Normalized event types for the chat UI.
 * These provide a stable interface regardless of opencode internal event shapes.
 */

export type NormalizedEventType =
  | "chat.session.status"
  | "chat.message.delta"
  | "chat.message.final"
  | "chat.tool.start"
  | "chat.tool.finish"
  | "chat.tool.error"
  | "chat.file.changed"
  | "chat.event.unknown";

export interface NormalizedEventEnvelope {
  type: NormalizedEventType;
  projectId: string;
  sessionId?: string;
  time: string;
  payload: unknown;
}

export interface SessionStatusPayload {
  status: string;
  cost: number | undefined;
}

export interface MessageDeltaPayload {
  messageId: string;
  role: "assistant" | "user";
  deltaText: string;
}

export interface MessageFinalPayload {
  messageId: string;
}

export interface ToolStartPayload {
  toolCallId: string;
  name: string;
  input: unknown;
}

export interface ToolFinishPayload {
  toolCallId: string;
  output: unknown;
}

export interface ToolErrorPayload {
  toolCallId: string;
  error: unknown;
}

export interface FileChangedPayload {
  path: string;
}

export interface UnknownEventPayload {
  upstreamEventType: string;
  upstreamData: unknown;
}

/**
 * Normalization state maintained per SSE connection.
 */
export interface NormalizationState {
  currentAssistantMessageId: string | null;
  toolCallCounter: number;
  activeToolCalls: Map<string, string>; // upstream id -> our toolCallId
  reasoningContent: Map<string, string>; // reasoningKey -> accumulated text
}

export function createNormalizationState(): NormalizationState {
  return {
    currentAssistantMessageId: null,
    toolCallCounter: 0,
    activeToolCalls: new Map(),
    reasoningContent: new Map(),
  };
}

/**
 * Generate a stable message ID.
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a stable tool call ID and increment counter.
 */
function generateToolCallId(counter: number): string {
  return `tool_${counter}_${Date.now()}`;
}

/**
 * Normalize an upstream opencode event into our stable schema.
 */
export function normalizeEvent(
  projectId: string,
  upstreamEvent: { type: string; properties?: Record<string, unknown> },
  state: NormalizationState
): NormalizedEventEnvelope {
  const time = new Date().toISOString();
  const { type, properties = {} } = upstreamEvent;

  switch (type) {
    case "session.status": {
      // session.status events contain the actual session state (idle, busy, etc)
      const statusObj = properties.status as { type?: string } | undefined;
      return {
        type: "chat.session.status",
        projectId,
        time,
        payload: {
          status: statusObj?.type ?? "unknown",
          cost: undefined,
        } satisfies SessionStatusPayload,
      };
    }

    case "session.updated": {
      // session.updated events contain session metadata, not status
      // We skip these as they don't affect the chat UI status
      break;
    }

    case "message.part.updated": {
      const part = properties.part as { 
        type?: string; 
        text?: string;
        messageID?: string;
        callID?: string;
        tool?: string;
        state?: {
          status?: string;
          input?: unknown;
          output?: unknown;
        };
      } | undefined;
      
      // We need to check if this is part of an assistant message, not a user message
      // The delta field only appears on streaming assistant responses
      const delta = properties.delta as string | undefined;
      
      if (part?.type === "text" && delta) {
        // Only process if there's a delta - this indicates streaming assistant response
        // User messages don't have delta, they come as complete parts
        if (!state.currentAssistantMessageId) {
          state.currentAssistantMessageId = part.messageID || generateMessageId();
        }

        return {
          type: "chat.message.delta",
          projectId,
          time,
          payload: {
            messageId: state.currentAssistantMessageId,
            role: "assistant",
            deltaText: delta,
          } satisfies MessageDeltaPayload,
        };
      }
      
      // Handle reasoning parts - treat as a special "thinking" tool
      // We track reasoning by messageID since callID may not be present
      if (part?.type === "reasoning") {
        const reasoningKey = `reasoning_${part.messageID}`;
        let toolCallId = state.activeToolCalls.get(reasoningKey);
        
        if (!toolCallId) {
          state.toolCallCounter++;
          toolCallId = generateToolCallId(state.toolCallCounter);
          state.activeToolCalls.set(reasoningKey, toolCallId);
          state.reasoningContent.set(reasoningKey, "");
          
          // Emit start event
          return {
            type: "chat.tool.start",
            projectId,
            time,
            payload: {
              toolCallId,
              name: "thinking",
              input: null,
            } satisfies ToolStartPayload,
          };
        }
        
        // Accumulate reasoning text
        if (part.text) {
          const currentText = state.reasoningContent.get(reasoningKey) || "";
          state.reasoningContent.set(reasoningKey, currentText + part.text);
        }
        
        // Reasoning updates don't need to be emitted - just the start/finish
      }
      
      // Handle step-finish to close reasoning
      if (part?.type === "step-finish") {
        const reasoningKey = `reasoning_${part.messageID}`;
        const toolCallId = state.activeToolCalls.get(reasoningKey);
        
        if (toolCallId) {
          state.activeToolCalls.delete(reasoningKey);
          const reasoningText = state.reasoningContent.get(reasoningKey) || "";
          state.reasoningContent.delete(reasoningKey);
          
          return {
            type: "chat.tool.finish",
            projectId,
            time,
            payload: {
              toolCallId,
              output: reasoningText || null,
            } satisfies ToolFinishPayload,
          };
        }
      }
      
      // Handle tool parts from message.part.updated
      if (part?.type === "tool" && part.callID && part.tool) {
        const callId = part.callID;
        const status = part.state?.status;
        let toolCallId = state.activeToolCalls.get(callId);
        
        if (status === "running" || status === "pending") {
          // Tool starting
          if (!toolCallId) {
            state.toolCallCounter++;
            toolCallId = generateToolCallId(state.toolCallCounter);
            state.activeToolCalls.set(callId, toolCallId);
          }
          
          return {
            type: "chat.tool.start",
            projectId,
            time,
            payload: {
              toolCallId,
              name: part.tool,
              input: part.state?.input,
            } satisfies ToolStartPayload,
          };
        } else if (status === "completed") {
          // Tool finished
          if (!toolCallId) {
            toolCallId = `unknown_${state.toolCallCounter}`;
          }
          state.activeToolCalls.delete(callId);
          
          return {
            type: "chat.tool.finish",
            projectId,
            time,
            payload: {
              toolCallId,
              output: part.state?.output,
            } satisfies ToolFinishPayload,
          };
        }
      }
      break;
    }

    case "message.updated": {
      // Message is complete
      if (state.currentAssistantMessageId) {
        const messageId = state.currentAssistantMessageId;
        state.currentAssistantMessageId = null;

        return {
          type: "chat.message.final",
          projectId,
          time,
          payload: {
            messageId,
          } satisfies MessageFinalPayload,
        };
      }
      break;
    }

    case "tool.execute": {
      const name = properties.name as string | undefined;
      const input = properties.input;

      // Generate or find tool call ID
      const upstreamId = (properties.id as string) ?? `auto_${state.toolCallCounter}`;
      let toolCallId = state.activeToolCalls.get(upstreamId);
      if (!toolCallId) {
        state.toolCallCounter++;
        toolCallId = generateToolCallId(state.toolCallCounter);
        state.activeToolCalls.set(upstreamId, toolCallId);
      }

      return {
        type: "chat.tool.start",
        projectId,
        time,
        payload: {
          toolCallId,
          name: name ?? "unknown",
          input,
        } satisfies ToolStartPayload,
      };
    }

    case "tool.result": {
      const output = properties.output;
      const upstreamId = (properties.id as string) ?? "";
      const toolCallId = state.activeToolCalls.get(upstreamId) ?? `unknown_${state.toolCallCounter}`;

      // Clean up
      state.activeToolCalls.delete(upstreamId);

      // Check if it's an error
      const isError =
        typeof output === "object" &&
        output !== null &&
        "error" in output;

      if (isError) {
        return {
          type: "chat.tool.error",
          projectId,
          time,
          payload: {
            toolCallId,
            error: output,
          } satisfies ToolErrorPayload,
        };
      }

      return {
        type: "chat.tool.finish",
        projectId,
        time,
        payload: {
          toolCallId,
          output,
        } satisfies ToolFinishPayload,
      };
    }

    case "file.edited": {
      const file = properties.file as string | undefined;
      if (file) {
        return {
          type: "chat.file.changed",
          projectId,
          time,
          payload: {
            path: file,
          } satisfies FileChangedPayload,
        };
      }
      break;
    }
  }

  // Unknown or unhandled event
  return {
    type: "chat.event.unknown",
    projectId,
    time,
    payload: {
      upstreamEventType: type,
      upstreamData: properties,
    } satisfies UnknownEventPayload,
  };
}

/**
 * Parse SSE data line into an event object.
 */
export function parseSSEData(data: string): { type: string; properties?: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(data);
    if (typeof parsed === "object" && parsed !== null && "type" in parsed) {
      return parsed as { type: string; properties?: Record<string, unknown> };
    }
    return null;
  } catch {
    return null;
  }
}
