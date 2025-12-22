/**
 * Normalized event types for the chat UI.
 * These provide a stable interface regardless of opencode internal event shapes.
 * Enhanced with message parts support for structured message handling.
 */

export type NormalizedEventType =
  | "chat.session.status"
  | "chat.message.delta"
  | "chat.message.part.added"
  | "chat.message.final"
  | "chat.tool.start"
  | "chat.tool.finish"
  | "chat.tool.error"
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

export interface SessionStatusPayload {
  status: string;
  cost: number | undefined;
}

export interface MessageDeltaPayload {
  messageId: string;
  role: "assistant" | "user";
  deltaText: string;
}

export interface MessagePartPayload {
  messageId: string;
  partId: string;
  partType: "text" | "tool" | "reasoning" | "error" | "file";
  deltaText?: string; // For streaming text
  text?: string; // For reasoning
  toolName?: string; // For tools
  toolInput?: unknown;
  toolOutput?: unknown;
  toolStatus?: "pending" | "running" | "completed" | "error";
  toolError?: string;
  errorMessage?: string; // For error parts
  errorStack?: string;
  filePath?: string; // For file parts
  fileSize?: number;
}

export interface MessageFinalPayload {
  messageId: string;
}

export interface ReasoningPartPayload {
  messageId: string;
  partId: string;
  text: string;
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
  currentTextPartId: string | null; // Track current text part for streaming
  toolCallCounter: number;
  activeToolCalls: Map<string, string>; // upstream id -> our toolCallId
  reasoningContent: Map<string, string>; // reasoningKey -> accumulated text
  partIdMap: Map<string, string>; // Maps upstream part IDs to our generated part IDs
}

export function createNormalizationState(): NormalizationState {
  return {
    currentAssistantMessageId: null,
    currentTextPartId: null,
    toolCallCounter: 0,
    activeToolCalls: new Map(),
    reasoningContent: new Map(),
    partIdMap: new Map(),
  };
}

/**
 * Generate a stable part ID.
 */
function generatePartId(type: string): string {
  return `part_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
        id?: string;
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
        const msgId = state.currentAssistantMessageId || part.messageID || generateMessageId();
        state.currentAssistantMessageId = msgId;
        
        // Create or reuse text part ID
        const textPartKey = `text_${msgId}`;
        let textPartId: string;
        const existingPartId = state.partIdMap.get(textPartKey);
        if (existingPartId) {
          textPartId = existingPartId;
        } else {
          textPartId = generatePartId("text");
          state.partIdMap.set(textPartKey, textPartId);
          state.currentTextPartId = textPartId;
        }

        // Emit new part-based event with delta
        return {
          type: "chat.message.part.added",
          projectId,
          time,
          payload: {
            messageId: msgId,
            partId: textPartId,
            partType: "text",
            deltaText: delta,
          } satisfies MessagePartPayload,
        };
      }
      
      // Handle reasoning parts - emit as part event
      if (part?.type === "reasoning") {
        const reasoningKey = `reasoning_${part.messageID}`;
        let partId: string;
        const existingReasoningPartId = state.partIdMap.get(reasoningKey);
        if (existingReasoningPartId) {
          partId = existingReasoningPartId;
        } else {
          partId = generatePartId("reasoning");
          state.partIdMap.set(reasoningKey, partId);
        }
        
        // Accumulate reasoning text for finish event
        if (part.text) {
          const currentText = state.reasoningContent.get(reasoningKey) || "";
          state.reasoningContent.set(reasoningKey, currentText + part.text);
        }
        
        const msgId = part.messageID || state.currentAssistantMessageId || generateMessageId();
        
        // Return a reasoning part event
        return {
          type: "chat.reasoning.part",
          projectId,
          time,
          payload: {
            messageId: msgId,
            partId,
            text: part.text || "",
          } satisfies ReasoningPartPayload,
        };
      }
      
      // Handle step-finish to close reasoning (emit as tool finish for backward compat)
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
