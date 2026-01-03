import { useCallback, useRef, useState } from "react";
import {
	createTextPart,
	createImagePart,
	type MessagePart,
	type ChatItem,
	type ToolCall,
} from "@/types/message";

interface UseChatHistoryOptions {
	projectId: string;
	userPromptMessageId: string | null;
	scrollToBottom: () => void;
}

export function useChatHistory({
	projectId,
	userPromptMessageId,
	scrollToBottom,
}: UseChatHistoryOptions) {
	const [historyLoaded, setHistoryLoaded] = useState(false);
	const loadingHistoryRef = useRef(false);

	const loadHistory = useCallback(async (): Promise<ChatItem[]> => {
		if (loadingHistoryRef.current) {
			return [];
		}

		loadingHistoryRef.current = true;

		try {
			const sessionsRes = await fetch(
				`/api/projects/${projectId}/opencode/session`,
			);
			if (!sessionsRes.ok) {
				setHistoryLoaded(true);
				return [];
			}

			const sessionsData = await sessionsRes.json();
			const sessions = sessionsData.sessions || sessionsData || [];

			if (sessions.length === 0) {
				setHistoryLoaded(true);
				return [];
			}

			const latestSession = sessions[sessions.length - 1];
			const latestSessionId = latestSession.id || latestSession;

			const messagesRes = await fetch(
				`/api/projects/${projectId}/opencode/session/${latestSessionId}/message`,
			);
			if (!messagesRes.ok) {
				setHistoryLoaded(true);
				return [];
			}

			const messagesData = await messagesRes.json();
			const messages = Array.isArray(messagesData)
				? messagesData
				: messagesData.messages || [];

			const historyItems: ChatItem[] = [];
			let foundUserPrompt = false;

			for (const msg of messages) {
				const info = msg.info || {};
				const msgParts = msg.parts || [];
				const role = info.role;
				const messageId =
					info.id ||
					`hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

				if (userPromptMessageId && !foundUserPrompt) {
					if (messageId === userPromptMessageId) {
						foundUserPrompt = true;
					} else {
						continue;
					}
				}

				if (role === "user" || role === "assistant") {
					const messageParts: MessagePart[] = [];

					for (const part of msgParts) {
						if (part.type === "text" && part.text) {
							messageParts.push(createTextPart(part.text, part.id));
						}
						if (part.type === "tool" && part.tool && part.callID) {
							historyItems.push({
								type: "tool",
								id: part.callID,
								data: {
									id: part.callID,
									name: part.tool,
									input: part.state?.input,
									output: part.state?.output,
									status:
										part.state?.status === "completed"
											? "success"
											: part.state?.status === "error"
												? "error"
												: "success",
								},
							});
						}
					}

					if (messageParts.length > 0) {
						historyItems.push({
							type: "message",
							id: messageId,
							data: {
								id: messageId,
								role: role as "user" | "assistant",
								parts: messageParts,
								isStreaming: false,
							},
						});
					}
				}
			}

			setHistoryLoaded(true);
			return historyItems;
		} catch (error) {
			console.error("Failed to load chat history:", error);
			setHistoryLoaded(true);
			return [];
		}
	}, [projectId, userPromptMessageId]);

	return {
		historyLoaded,
		loadHistory,
	};
}
