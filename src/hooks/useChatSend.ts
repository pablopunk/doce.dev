import { promptAttachmentToPromptParts } from "@/lib/chat/attachmentPromptText";
import type { ChatItem } from "@/stores/useChatStore";
import {
	createErrorPart,
	createPromptAttachmentPart,
	createTextPart,
	type MessagePart,
	type PromptAttachmentPart,
} from "@/types/message";

interface UseChatSendOptions {
	projectId: string;
	sessionId: string | null;
	currentModel: { providerID: string; modelID: string } | null;
	revertMessageId: string | null;
	addItem: (item: {
		type: "message";
		id: string;
		data: {
			id: string;
			role: "user";
			parts: MessagePart[];
			localStatus: "pending";
		};
	}) => void;
	updateItem: (id: string, data: Partial<ChatItem["data"]>) => void;
	scrollToBottom: () => void;
	fetchJson: <T>(url: string, init?: RequestInit) => Promise<T>;
	setSessionId: (sessionId: string | null) => void;
	refreshBlockingState: (activeSessionId: string) => Promise<void>;
	setIsStreaming: (value: boolean) => void;
	setPendingAttachments: (attachments: PromptAttachmentPart[]) => void;
	setPendingAttachmentError: (error: string | null) => void;
	setRevertMessageId: (messageId: string | null) => void;
	toErrorMessage: (error: unknown) => string;
	showRequestError: (title: string, error: unknown) => void;
}

export function useChatSend({
	projectId,
	sessionId,
	currentModel,
	revertMessageId,
	addItem,
	updateItem,
	scrollToBottom,
	fetchJson,
	setSessionId,
	refreshBlockingState,
	setIsStreaming,
	setPendingAttachments,
	setPendingAttachmentError,
	setRevertMessageId,
	toErrorMessage,
	showRequestError,
}: UseChatSendOptions) {
	const handleSend = async (
		content: string,
		attachments?: PromptAttachmentPart[],
	) => {
		// Build local message parts and API payload from a single ordered source
		const messageParts: MessagePart[] = [];
		type ApiPromptPart =
			| { type: "text"; text: string }
			| {
					type: "file";
					mime: string;
					url: string;
					filename: string;
			  };
		const apiParts: ApiPromptPart[] = [];

		if (attachments) {
			for (const attachment of attachments) {
				messageParts.push(
					createPromptAttachmentPart({
						filename: attachment.filename,
						mime: attachment.mime,
						kind: attachment.kind,
						...(attachment.dataUrl ? { dataUrl: attachment.dataUrl } : {}),
						...(attachment.size !== undefined ? { size: attachment.size } : {}),
						...(attachment.textPreview
							? { textPreview: attachment.textPreview }
							: {}),
						...(attachment.textContent
							? { textContent: attachment.textContent }
							: {}),
						id: attachment.id,
					}),
				);
				apiParts.push(...promptAttachmentToPromptParts(attachment));
			}
		}
		if (content) {
			messageParts.push(createTextPart(content));
			apiParts.push({ type: "text", text: content });
		}

		const userMessageId = `user_${Date.now()}`;
		addItem({
			type: "message",
			id: userMessageId,
			data: {
				id: userMessageId,
				role: "user",
				parts: messageParts,
				localStatus: "pending",
			},
		});
		scrollToBottom();

		try {
			let currentSessionId = sessionId;
			if (!currentSessionId) {
				const data = await fetchJson<{ id: string }>(
					`/api/projects/${projectId}/opencode/session`,
					{
						method: "POST",
					},
				);
				currentSessionId = data.id;
				setSessionId(currentSessionId);
				await refreshBlockingState(currentSessionId);
			}
			if (!currentSessionId) {
				throw new Error("Session could not be created");
			}

			await fetchJson(
				`/api/projects/${projectId}/opencode/session/${currentSessionId}/prompt_async`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						parts: apiParts,
						...(currentModel && { model: currentModel }),
					}),
				},
			);
			updateItem(userMessageId, { localStatus: "sent" });
			setIsStreaming(true);
			setPendingAttachments([]);
			setPendingAttachmentError(null);
			// Sending a new prompt branches from the revert point; the visible-items
			// slice should no longer hide the new message + its response.
			if (revertMessageId) setRevertMessageId(null);
		} catch (error) {
			updateItem(userMessageId, {
				localStatus: "failed",
				localError: toErrorMessage(error),
				parts: [
					...messageParts,
					createErrorPart("Message failed to send", toErrorMessage(error)),
				],
			});
			showRequestError("Failed to send message", error);
		}
	};

	return { handleSend };
}
