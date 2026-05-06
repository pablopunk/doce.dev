/**
 * Message and Part types for structured message handling.
 *
 * Re-exports SDK types and adds doce.dev-specific extensions for UI rendering.
 */

export type {
	AssistantMessage as SDKAssistantMessage,
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

export type MessagePartType =
	| "text"
	| "tool"
	| "reasoning"
	| "error"
	| "file"
	| "image"
	| "attachment";

export type PromptAttachmentKind = "image" | "text";

export interface PromptAttachmentPart {
	type: "attachment";
	id: string;
	filename: string;
	mime: string;
	dataUrl?: string;
	size?: number;
	kind: PromptAttachmentKind;
	textPreview?: string;
}

/**
 * Image attachment part for backwards-compatible UI rendering.
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

export type MessagePart =
	| TextPart
	| ToolPart
	| ReasoningPart
	| ErrorPart
	| FilePart
	| ImagePart
	| PromptAttachmentPart;

export interface Message {
	id: string;
	role: "user" | "assistant";
	parts: MessagePart[];
	isStreaming?: boolean;
	localStatus?: "pending" | "sent" | "failed";
	localError?: string;
}

function generateId(prefix: string): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createTextPart(text: string, id?: string): TextPart {
	return {
		type: "text",
		id: id || generateId("text"),
		text,
	};
}

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

export function createReasoningPart(text: string, id?: string): ReasoningPart {
	return {
		type: "reasoning",
		id: id || generateId("reasoning"),
		text,
	};
}

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

export function createPromptAttachmentPart(input: {
	filename: string;
	mime: string;
	kind: PromptAttachmentKind;
	dataUrl?: string;
	size?: number;
	textPreview?: string;
	id?: string;
}): PromptAttachmentPart {
	return {
		type: "attachment",
		id: input.id || generateId("attachment"),
		filename: input.filename,
		mime: input.mime,
		kind: input.kind,
		...(input.dataUrl ? { dataUrl: input.dataUrl } : {}),
		...(input.size !== undefined ? { size: input.size } : {}),
		...(input.textPreview ? { textPreview: input.textPreview } : {}),
	};
}

export const VALID_IMAGE_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
] as const;

export const TEXT_ATTACHMENT_MIME_TYPES = [
	"text/plain",
	"text/markdown",
	"text/csv",
	"text/tab-separated-values",
	"text/x-log",
	"application/json",
	"application/ld+json",
	"application/x-ndjson",
	"application/xml",
	"text/xml",
	"application/yaml",
	"application/x-yaml",
	"text/yaml",
	"text/x-yaml",
	"application/javascript",
	"text/javascript",
	"application/x-javascript",
] as const;

export const TEXT_ATTACHMENT_EXTENSIONS = [
	"txt",
	"md",
	"mdx",
	"csv",
	"tsv",
	"json",
	"jsonl",
	"ndjson",
	"yaml",
	"yml",
	"xml",
	"log",
	"ts",
	"tsx",
	"js",
	"jsx",
	"mjs",
	"cjs",
	"css",
	"html",
	"htm",
	"py",
	"rb",
	"go",
	"rs",
	"sh",
	"bash",
	"zsh",
	"env",
	"toml",
	"ini",
	"conf",
] as const;

export const CHAT_ATTACHMENT_ACCEPT = [
	...VALID_IMAGE_MIME_TYPES,
	...TEXT_ATTACHMENT_MIME_TYPES,
	...TEXT_ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`),
].join(",");

export const MAX_ATTACHMENT_FILE_SIZE = 1024 * 1024;
export const MAX_TEXT_ATTACHMENT_FILE_SIZE = 512 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_IMAGES_PER_MESSAGE = MAX_ATTACHMENTS_PER_MESSAGE;
export const MAX_TEXT_PREVIEW_LENGTH = 500;

export function readFileAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = reject;
		reader.readAsText(file);
	});
}

export async function createImagePartFromFile(file: File): Promise<ImagePart> {
	const dataUrl = await readFileAsBase64(file);
	return createImagePart(dataUrl, file.name, file.type, file.size);
}

function getFileExtension(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase();
	return ext ?? "";
}

export function isTextAttachmentFile(file: File): boolean {
	const extension = getFileExtension(file.name);
	return (
		file.type.startsWith("text/") ||
		TEXT_ATTACHMENT_MIME_TYPES.includes(
			file.type as (typeof TEXT_ATTACHMENT_MIME_TYPES)[number],
		) ||
		TEXT_ATTACHMENT_EXTENSIONS.includes(
			extension as (typeof TEXT_ATTACHMENT_EXTENSIONS)[number],
		)
	);
}

export function isImageAttachmentFile(file: File): boolean {
	return VALID_IMAGE_MIME_TYPES.includes(
		file.type as (typeof VALID_IMAGE_MIME_TYPES)[number],
	);
}

export function validateImageFile(file: File): {
	valid: boolean;
	error?: string;
} {
	if (!isImageAttachmentFile(file)) {
		return {
			valid: false,
			error: "Invalid format. Accepted: PNG, JPEG, GIF, WebP",
		};
	}
	if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
		return {
			valid: false,
			error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 1MB.`,
		};
	}
	return { valid: true };
}

export function validateTextAttachmentFile(file: File): {
	valid: boolean;
	error?: string;
} {
	if (!isTextAttachmentFile(file)) {
		return {
			valid: false,
			error:
				"Unsupported file type. Accepted: text, markdown, CSV, JSON, YAML, XML, logs, and source files.",
		};
	}
	if (file.size > MAX_TEXT_ATTACHMENT_FILE_SIZE) {
		return {
			valid: false,
			error: `File too large (${(file.size / 1024).toFixed(1)}KB). Max 512KB for text files.`,
		};
	}
	return { valid: true };
}

export async function createPromptAttachmentFromFile(
	file: File,
): Promise<PromptAttachmentPart> {
	if (isImageAttachmentFile(file)) {
		const dataUrl = await readFileAsBase64(file);
		return createPromptAttachmentPart({
			filename: file.name,
			mime: file.type,
			kind: "image",
			dataUrl,
			size: file.size,
		});
	}

	const [dataUrl, text] = await Promise.all([
		readFileAsBase64(file),
		readFileAsText(file),
	]);
	return createPromptAttachmentPart({
		filename: file.name,
		mime: file.type || "text/plain",
		kind: "text",
		dataUrl,
		size: file.size,
		textPreview: text.slice(0, MAX_TEXT_PREVIEW_LENGTH),
	});
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function combineTextParts(parts: MessagePart[]): string {
	return parts
		.filter((p): p is TextPart => p.type === "text")
		.map((p) => p.text)
		.join("");
}

export function getMessageText(
	message: Message | { content?: string; parts?: MessagePart[] },
): string {
	if ("parts" in message && Array.isArray(message.parts)) {
		return combineTextParts(message.parts);
	}
	if ("content" in message && typeof message.content === "string") {
		return message.content;
	}
	return "";
}

export function isMessageStreaming(message: Message): boolean {
	if (message.isStreaming) return true;
	const lastPart = message.parts[message.parts.length - 1];
	return lastPart?.type === "text" && lastPart.isStreaming === true;
}
