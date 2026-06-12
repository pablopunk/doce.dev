import { createErrorPart, createTextPart, type Message } from "@/types/message";
import type { ChatItem, ChatStore } from "./useChatStore";

type ChatStoreSet = (
	partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>),
) => void;

export function handleMessageUser(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	const { messageId } = payload as { messageId: string };
	set((state) => ({
		items: state.items.filter(
			(item) =>
				!(
					item.type === "message" &&
					item.id === messageId &&
					(item.data as Message).role === "assistant"
				),
		),
	}));
}

export function handleMessagePartAdded(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	const { messageId, partId, partType, deltaText, text } = payload as {
		messageId: string;
		partId: string;
		partType: string;
		deltaText?: string;
		text?: string;
	};

	set((state) => {
		const existing = state.items.find(
			(item) => item.type === "message" && item.id === messageId,
		);

		if (existing && existing.type === "message") {
			const msg = existing.data as Message;
			const textPartIdx = msg.parts.findIndex((p) => p.type === "text");

			if (textPartIdx !== -1 && (deltaText || text)) {
				// Replace if full text available, otherwise append delta
				const updatedParts = [...msg.parts];
				const part = updatedParts[textPartIdx];
				if (part && part.type === "text") {
					if (typeof text === "string") {
						part.text = text;
					} else if (deltaText) {
						part.text = part.text + deltaText;
					}
				}
				return {
					items: state.items.map((item) =>
						item.id === messageId
							? {
									...item,
									data: {
										...msg,
										parts: updatedParts,
										isStreaming: true,
									},
								}
							: item,
					),
					isStreaming: true,
				};
			} else if (deltaText || text) {
				// Create new text part
				const partText = text ?? deltaText ?? "";
				const updatedParts = [...msg.parts, createTextPart(partText, partId)];
				return {
					items: state.items.map((item) =>
						item.id === messageId
							? {
									...item,
									data: {
										...msg,
										parts: updatedParts,
										isStreaming: true,
									},
								}
							: item,
					),
					isStreaming: true,
				};
			}
		} else if (partType === "text" && (deltaText || text)) {
			// New message
			const partText = text ?? deltaText ?? "";
			const newItem: ChatItem = {
				type: "message",
				id: messageId,
				data: {
					id: messageId,
					role: "assistant",
					parts: [createTextPart(partText, partId)],
					isStreaming: true,
				},
			};
			return {
				items: [...state.items, newItem],
				isStreaming: true,
			};
		}

		return { isStreaming: true };
	});
}

export function handleMessageDelta(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	// Backward compatibility: handle old-style delta events
	const { messageId, deltaText } = payload as {
		messageId: string;
		deltaText: string;
	};

	set((state) => {
		const existing = state.items.find(
			(item) => item.type === "message" && item.id === messageId,
		);

		if (existing && existing.type === "message") {
			const msg = existing.data as Message;
			const textPart = msg.parts[msg.parts.length - 1];

			if (textPart && textPart.type === "text") {
				// Append to existing text part
				const updatedParts = [...msg.parts];
				const lastPart = updatedParts[updatedParts.length - 1];
				if (lastPart && lastPart.type === "text") {
					lastPart.text = textPart.text + deltaText;
				}
				return {
					items: state.items.map((item) =>
						item.id === messageId
							? {
									...item,
									data: {
										...msg,
										parts: updatedParts,
										isStreaming: true,
									},
								}
							: item,
					),
					isStreaming: true,
				};
			} else {
				// Create new text part
				const updatedParts = [...msg.parts, createTextPart(deltaText)];
				return {
					items: state.items.map((item) =>
						item.id === messageId
							? {
									...item,
									data: {
										...msg,
										parts: updatedParts,
										isStreaming: true,
									},
								}
							: item,
					),
					isStreaming: true,
				};
			}
		} else {
			// New message
			const newItem: ChatItem = {
				type: "message",
				id: messageId,
				data: {
					id: messageId,
					role: "assistant",
					parts: [createTextPart(deltaText)],
					isStreaming: true,
				},
			};
			return {
				items: [...state.items, newItem],
				isStreaming: true,
			};
		}
	});
}

export function handleMessageFinal(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	const { messageId, error } = payload as {
		messageId: string;
		error?: { message: string; details?: unknown };
	};

	set((state) => {
		const items = state.items.map((item) => {
			if (item.type === "message" && item.id === messageId) {
				const msg = item.data as Message;
				const hasErrorPart = msg.parts.some(
					(part) =>
						part.type === "error" && error && part.message === error.message,
				);
				const nextParts =
					error && !hasErrorPart
						? [
								...msg.parts,
								createErrorPart(
									error.message,
									typeof error.details === "string" ? error.details : undefined,
								),
							]
						: msg.parts;
				const nextMessage: Message = {
					...msg,
					parts: nextParts,
					isStreaming: false,
					localStatus: "sent",
					...(error ? { localError: error.message } : {}),
				};
				return {
					...item,
					data: nextMessage,
				};
			}
			return item;
		});

		return {
			items,
			isStreaming: false,
		};
	});
}
