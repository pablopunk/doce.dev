/**
 * Message part types for structured message handling.
 * Based on OpenCode's message parts architecture.
 */

export type MessagePartType = "text" | "tool" | "reasoning" | "error" | "file" | "image";

/**
 * Image attachment part for user messages.
 * Following OpenCode's pattern for image handling.
 */
export interface ImagePart {
  type: "image";
  id: string;
  filename: string;
  mime: string;
  dataUrl: string;
  size?: number;
}

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

export type MessagePart = TextPart | ToolPart | ReasoningPart | ErrorPart | FilePart | ImagePart;

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
 * Helper to create an image part
 */
export function createImagePart(
  dataUrl: string,
  filename: string,
  mime: string,
  size?: number,
  id?: string
): ImagePart {
  const result: ImagePart = {
    type: "image",
    id: id || `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    dataUrl,
    filename,
    mime,
  };
  if (size !== undefined) {
    result.size = size;
  }
  return result;
}

/**
 * Read a File as base64 data URL
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Create an image part from a File object
 */
export async function createImagePartFromFile(file: File): Promise<ImagePart> {
  const dataUrl = await readFileAsBase64(file);
  return createImagePart(dataUrl, file.name, file.type, file.size);
}

/**
 * Valid image MIME types
 */
export const VALID_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/**
 * Max image file size (5MB)
 */
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Max number of images per message
 */
export const MAX_IMAGES_PER_MESSAGE = 5;

/**
 * Validate an image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!VALID_IMAGE_MIME_TYPES.includes(file.type as typeof VALID_IMAGE_MIME_TYPES[number])) {
    return { valid: false, error: `Invalid format. Accepted: PNG, JPEG, GIF, WebP` };
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return { valid: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.` };
  }
  return { valid: true };
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
