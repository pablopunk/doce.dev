import { useEffect, useRef, useCallback, useState } from "react";
import {
	createTextPart,
	type Message,
	type MessagePart,
	type ChatItem,
	type ToolCall,
} from "@/types/message";

interface ChatEvent {
	type: string;
	projectId: string;
	sessionId?: string;
	payload: Record<string, unknown>;
}

interface UseChatEventsOptions {
	projectId: string;
	opencodeReady: boolean;
	sessionId: string | null;
	onEvent?: (event: ChatEvent) => void;
}

export function useChatEvents({
	projectId,
	opencodeReady,
	sessionId,
	onEvent,
}: UseChatEventsOptions) {
	const eventSourceRef = useRef<EventSource | null>(null);
	const [isStreaming, setIsStreaming] = useState(false);

	const handleEvent = useCallback(
		(event: ChatEvent) => {
			onEvent?.(event);

			switch (event.type) {
				case "chat.message.part.added":
				case "chat.message.delta":
				case "chat.message.final":
				case "chat.tool.update":
				case "chat.session.status":
					if (event.type === "chat.session.status") {
						const { status } = event.payload as { status: string };
						if (status === "completed" || status === "idle") {
							setIsStreaming(false);
						}
					}
					break;
			}
		},
		[onEvent],
	);

	useEffect(() => {
		if (!opencodeReady) return;

		const controller = new AbortController();
		const eventSource = new EventSource(
			`/api/projects/${projectId}/opencode/event`,
		);
		eventSourceRef.current = eventSource;

		const handleChatEvent = (e: Event) => {
			if (controller.signal.aborted) return;

			try {
				const messageEvent = e as MessageEvent<string>;
				const event = JSON.parse(messageEvent.data);
				handleEvent(event);
			} catch {
				// Ignore parse errors
			}
		};

		eventSource.addEventListener("chat.event", handleChatEvent);

		eventSource.onerror = () => {
			if (controller.signal.aborted) {
				eventSource.close();
				return;
			}

			eventSource.close();
			eventSourceRef.current = null;

			const timeoutId = setTimeout(() => {
				if (!controller.signal.aborted && eventSourceRef.current === null) {
					// Will be handled by the useEffect cleanup/re-run
				}
			}, 2000);

			controller.signal.addEventListener("abort", () => {
				clearTimeout(timeoutId);
			});
		};

		return () => {
			controller.abort();
			eventSource.removeEventListener("chat.event", handleChatEvent);
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [projectId, opencodeReady, handleEvent]);

	const setStreaming = useCallback((streaming: boolean) => {
		setIsStreaming(streaming);
	}, []);

	return {
		isStreaming,
		setStreaming,
	};
}

export function createMessageFromEvent(
	event: ChatEvent,
	currentItems: ChatItem[],
	setItems: React.Dispatch<React.SetStateAction<ChatItem[]>>,
	scrollToBottom: () => void,
): ChatItem[] {
	const { type, payload } = event;

	switch (type) {
		case "chat.message.part.added": {
			const { messageId, partId, partType, deltaText } = payload as {
				messageId: string;
				partId: string;
				partType: string;
				deltaText?: string;
			};

			const existing = currentItems.find(
				(item) => item.type === "message" && item.id === messageId,
			);

			if (existing && existing.type === "message") {
				const msg = existing.data as Message;
				const textPart = msg.parts.find(
					(p) => p.type === "text",
				) as MessagePart & {
					text: string;
				};

				let updatedParts: MessagePart[];
				if (textPart && deltaText) {
					updatedParts = msg.parts.map((part) =>
						part === textPart && part.type === "text"
							? { ...part, text: part.text + deltaText }
							: part,
					);
				} else if (deltaText) {
					updatedParts = [...msg.parts, createTextPart(deltaText, partId)];
				} else {
					updatedParts = msg.parts;
				}

				return currentItems.map((item) =>
					item.id === messageId
						? {
								...item,
								data: { ...msg, parts: updatedParts, isStreaming: true },
							}
						: item,
				);
			}

			if (partType === "text" && deltaText) {
				return [
					...currentItems,
					{
						type: "message",
						id: messageId,
						data: {
							id: messageId,
							role: "assistant",
							parts: [createTextPart(deltaText, partId)],
							isStreaming: true,
						},
					},
				];
			}
			break;
		}

		case "chat.message.delta": {
			const { messageId, deltaText } = payload as {
				messageId: string;
				deltaText: string;
			};

			const existing = currentItems.find(
				(item) => item.type === "message" && item.id === messageId,
			);

			if (existing && existing.type === "message") {
				const msg = existing.data as Message;
				const textPart = msg.parts[msg.parts.length - 1];

				let updatedParts: MessagePart[];
				if (textPart && textPart.type === "text") {
					updatedParts = msg.parts.map((part, index) =>
						index === msg.parts.length - 1 && part.type === "text"
							? { ...part, text: part.text + deltaText }
							: part,
					);
				} else {
					updatedParts = [...msg.parts, createTextPart(deltaText)];
				}

				return currentItems.map((item) =>
					item.id === messageId
						? {
								...item,
								data: { ...msg, parts: updatedParts, isStreaming: true },
							}
						: item,
				);
			}

			return [
				...currentItems,
				{
					type: "message",
					id: messageId,
					data: {
						id: messageId,
						role: "assistant",
						parts: [createTextPart(deltaText)],
						isStreaming: true,
					},
				},
			];
		}

		case "chat.message.final": {
			const { messageId } = payload as { messageId: string };
			return currentItems.map((item) =>
				item.id === messageId && item.type === "message"
					? { ...item, data: { ...(item.data as Message), isStreaming: false } }
					: item,
			);
		}

		case "chat.tool.update": {
			const { toolCallId, name, input, status, output, error } = payload as {
				toolCallId: string;
				name: string;
				input?: unknown;
				status: "running" | "success" | "error";
				output?: unknown;
				error?: unknown;
			};

			const existingIdx = currentItems.findIndex(
				(item) => item.type === "tool" && item.id === toolCallId,
			);

			if (existingIdx !== -1) {
				return currentItems.map((item, idx) =>
					idx === existingIdx && item.type === "tool"
						? {
								...item,
								data: {
									...(item.data as ToolCall),
									input,
									output,
									error,
									status,
								},
							}
						: item,
				);
			}

			return [
				...currentItems,
				{
					type: "tool",
					id: toolCallId,
					data: {
						id: toolCallId,
						name,
						input,
						output,
						error,
						status,
					},
				},
			];
		}
	}

	return currentItems;
}
