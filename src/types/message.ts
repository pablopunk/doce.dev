/**
 * Message part types for structured message handling.
 * Based on OpenCode's message parts architecture.
 */

export type MessagePartType = "text" | "tool" | "reasoning" | "error" | "file";

export interface TextPart {
  type: "text";
  id: string;
  text: string;
  isStreaming?: boolean;
}

export interface ToolPart {
  type: "tool";
  id: string;
  name: string;
  input?: unknown;
  output?: unknown;
  status: "pending" | "running" | "completed" | "error";
  error?: string;
}

export interface ReasoningPart {
  type: "reasoning";
  id: string;
  text: string;
}

export interface ErrorPart {
  type: "error";
  id: string;
  message: string;
  stack?: string;
}

export interface FilePart {
  type: "file";
  id: string;
  path: string;
  size?: number;
}

export type MessagePart = TextPart | ToolPart | ReasoningPart | ErrorPart | FilePart;

export interface Message {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  isStreaming?: boolean;
}

/**
 * Helper to create a text part
 */
export function createTextPart(text: string, id?: string): TextPart {
  return {
    type: "text",
    id: id || `text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
  };
}

/**
 * Helper to create a tool part
 */
export function createToolPart(
  name: string,
  input?: unknown,
  id?: string
): ToolPart {
  return {
    type: "tool",
    id: id || `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    input,
    status: "pending",
  };
}

/**
 * Helper to create a reasoning part
 */
export function createReasoningPart(text: string, id?: string): ReasoningPart {
  return {
    type: "reasoning",
    id: id || `reasoning_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
  };
}

/**
 * Helper to create an error part
 */
export function createErrorPart(message: string, stack?: string, id?: string): ErrorPart {
  const result: ErrorPart = {
    type: "error",
    id: id || `error_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    message,
  };
  if (stack !== undefined) {
    result.stack = stack;
  }
  return result;
}

/**
 * Helper to create a file part
 */
export function createFilePart(path: string, size?: number, id?: string): FilePart {
  const result: FilePart = {
    type: "file",
    id: id || `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    path,
  };
  if (size !== undefined) {
    result.size = size;
  }
  return result;
}

/**
 * Merge consecutive text parts into a single string
 * Useful for extracting all text content from a message
 */
export function combineTextParts(parts: MessagePart[]): string {
  return parts
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Extract all text from a message as fallback
 * Handles both new (parts) and old (content) formats
 */
export function getMessageText(message: Message | any): string {
  if ("parts" in message && Array.isArray(message.parts)) {
    return combineTextParts(message.parts);
  }
  // Fallback for legacy content field
  if ("content" in message && typeof message.content === "string") {
    return message.content;
  }
  return "";
}

/**
 * Determine if a message is currently streaming
 */
export function isMessageStreaming(message: Message): boolean {
  if (message.isStreaming) return true;
  // Check if last part is streaming
  const lastPart = message.parts[message.parts.length - 1];
  return lastPart?.type === "text" && lastPart.isStreaming === true;
}
