/**
 * Message and Part types for structured message handling.
 *
 * Re-exports SDK types and adds doce.dev-specific extensions (like ImagePart for UI).
 */

// Re-export SDK types directly - these are the canonical types from OpenCode
export type {
	AssistantMessage as SDKAssistantMessage,
	// Event types
	Event,
	EventFileEdited,
	EventMessagePartUpdated,
	EventMessageUpdated,
	EventSessionIdle,
	EventSessionStatus,
	FilePart as SDKFilePart,
	Message as SDKMessage,
	Part as SDKPart,
	ReasoningPart as SDKReasoningPart,
	TextPart as SDKTextPart,
	ToolPart as SDKToolPart,
	ToolState,
	ToolStateCompleted,
	ToolStateError,
	ToolStatePending,
	ToolStateRunning,
	UserMessage as SDKUserMessage,
} from "@opencode-ai/sdk";

/**
 * Simplified message part types for UI rendering.
 * These are doce.dev-specific types that are easier to work with in React components.
 */
export type MessagePartType =
	| "text"
	| "tool"
	| "reasoning"
	| "error"
	| "file"
	| "image";

/**
 * Image attachment part for user messages (doce.dev specific).
 * OpenCode uses FilePart with data URLs for images, but we need a separate
 * type for UI rendering that includes the base64 data URL.
 */
export interface ImagePart {
	type: "image";
	id: string;
	filename: string;
	mime: string;
	dataUrl: string;
	size?: number;
}

/**
 * Simplified text part for UI (minimal fields needed for rendering).
 */
export interface TextPart {
	type: "text";
	id: string;
	text: string;
	isStreaming?: boolean;
}

/**
 * Simplified tool part for UI rendering.
 */
export interface ToolPart {
	type: "tool";
	id: string;
	name: string;
	input?: unknown;
	output?: unknown;
	status: "pending" | "running" | "completed" | "error";
	error?: string;
}

/**
 * Reasoning part for AI thinking display.
 */
export interface ReasoningPart {
	type: "reasoning";
	id: string;
	text: string;
}

/**
 * Error part for displaying errors in messages.
 */
export interface ErrorPart {
	type: "error";
	id: string;
	message: string;
	stack?: string;
}

/**
 * File part for displaying file references.
 */
export interface FilePart {
	type: "file";
	id: string;
	path: string;
	size?: number;
}

/**
 * Union of all UI message part types.
 */
export type MessagePart =
	| TextPart
	| ToolPart
	| ReasoningPart
	| ErrorPart
	| FilePart
	| ImagePart;

/**
 * Simplified message type for UI rendering.
 */
export interface Message {
	id: string;
	role: "user" | "assistant";
	parts: MessagePart[];
	isStreaming?: boolean;
}

// ============================================================================
// Helper functions for creating parts
// ============================================================================

function generateId(prefix: string): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Helper to create a text part
 */
export function createTextPart(text: string, id?: string): TextPart {
	return {
		type: "text",
		id: id || generateId("text"),
		text,
	};
}

/**
 * Helper to create a tool part
 */
export function createToolPart(
	name: string,
	input?: unknown,
	id?: string,
): ToolPart {
	return {
		type: "tool",
		id: id || generateId("tool"),
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
		id: id || generateId("reasoning"),
		text,
	};
}

/**
 * Helper to create an error part
 */
export function createErrorPart(
	message: string,
	stack?: string,
	id?: string,
): ErrorPart {
	return {
		type: "error",
		id: id || generateId("error"),
		message,
		...(stack !== undefined && { stack }),
	};
}

/**
 * Helper to create a file part
 */
export function createFilePart(
	path: string,
	size?: number,
	id?: string,
): FilePart {
	return {
		type: "file",
		id: id || generateId("file"),
		path,
		...(size !== undefined && { size }),
	};
}

/**
 * Helper to create an image part
 */
export function createImagePart(
	dataUrl: string,
	filename: string,
	mime: string,
	size?: number,
	id?: string,
): ImagePart {
	return {
		type: "image",
		id: id || generateId("img"),
		dataUrl,
		filename,
		mime,
		...(size !== undefined && { size }),
	};
}

// ============================================================================
// Image handling utilities
// ============================================================================

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
 * Validate an image file
 */
export function validateImageFile(file: File): {
	valid: boolean;
	error?: string;
} {
	if (
		!VALID_IMAGE_MIME_TYPES.includes(
			file.type as (typeof VALID_IMAGE_MIME_TYPES)[number],
		)
	) {
		return {
			valid: false,
			error: `Invalid format. Accepted: PNG, JPEG, GIF, WebP`,
		};
	}
	if (file.size > MAX_IMAGE_FILE_SIZE) {
		return {
			valid: false,
			error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`,
		};
	}
	return { valid: true };
}

// ============================================================================
// Message utilities
// ============================================================================

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
export function getMessageText(
	message: Message | { content?: string; parts?: MessagePart[] },
): string {
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
