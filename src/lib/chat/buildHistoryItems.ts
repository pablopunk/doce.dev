import type { ChatItem } from "@/stores/useChatStore";
import {
	createErrorPart,
	createPromptAttachmentPart,
	createTextPart,
	type MessagePart,
} from "@/types/message";

export interface RawSessionMessage {
	info?: {
		id?: string;
		role?: "user" | "assistant";
		model?: { providerID: string; modelID: string };
		tokens?: {
			input: number;
			output: number;
			reasoning: number;
			cache: { read: number; write: number };
		};
		error?: { name?: string; data?: { message?: string } };
	};
	parts?: Array<{
		type?: string;
		id?: string;
		text?: string;
		tool?: string;
		callID?: string;
		mime?: string;
		filename?: string;
		url?: string;
		size?: number;
		state?: {
			input?: unknown;
			output?: unknown;
			status?: string;
			error?: unknown;
		};
	}>;
}

/**
 * Convert opencode's session message payload into the ChatItem[] our store renders.
 *
 * If `userPromptMessageId` is provided, drops everything before that message
 * (matches the existing behaviour where the bootstrap setup messages are hidden).
 */
export function buildHistoryItems(
	messages: RawSessionMessage[],
	userPromptMessageId: string | null,
): ChatItem[] {
	// If a cutoff is provided but the message no longer exists in the session
	// (e.g. the bootstrap session was reset), drop the cutoff entirely instead
	// of silently rendering nothing.
	const effectiveCutoff =
		userPromptMessageId &&
		messages.some((m) => m.info?.id === userPromptMessageId)
			? userPromptMessageId
			: null;

	const out: ChatItem[] = [];
	let foundUserPrompt = !effectiveCutoff;

	for (const msg of messages) {
		const info = msg.info ?? {};
		const role = info.role;
		const messageId = info.id ?? `hist_${Date.now()}_${Math.random()}`;

		if (!foundUserPrompt) {
			if (messageId === effectiveCutoff) foundUserPrompt = true;
			else continue;
		}

		if (role !== "user" && role !== "assistant") continue;

		const messageParts: MessagePart[] = [];
		const assistantError = info.error?.data?.message;

		for (const part of msg.parts ?? []) {
			if (part.type === "text" && part.text) {
				messageParts.push(createTextPart(part.text, part.id));
			}
			if (part.type === "file" && part.filename && part.mime) {
				messageParts.push(
					createPromptAttachmentPart({
						filename: part.filename,
						mime: part.mime,
						kind: part.mime.startsWith("image/") ? "image" : "text",
						...(part.url ? { dataUrl: part.url } : {}),
						...(part.size !== undefined ? { size: part.size } : {}),
						...(part.id ? { id: part.id } : {}),
					}),
				);
			}
			if (part.type === "tool" && part.tool && part.callID) {
				out.push({
					type: "tool",
					id: part.callID,
					data: {
						id: part.callID,
						name: part.tool,
						input: part.state?.input,
						output: part.state?.output,
						status: part.state?.status === "error" ? "error" : "success",
					},
				});
			}
		}

		if (role === "assistant" && assistantError) {
			messageParts.push(createErrorPart(assistantError));
		}

		if (messageParts.length > 0) {
			out.push({
				type: "message",
				id: messageId,
				data: {
					id: messageId,
					role,
					parts: messageParts,
					isStreaming: false,
					localStatus: "sent",
				},
			});
		}
	}

	return out;
}

/**
 * Find the most recent assistant/user message that carries an opencode model id,
 * so we can restore the model picker selection after a hard reload.
 */
export function pickLastModel(
	messages: RawSessionMessage[],
): { providerID: string; modelID: string } | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i]?.info?.model;
		if (m) return m;
	}
	return null;
}
