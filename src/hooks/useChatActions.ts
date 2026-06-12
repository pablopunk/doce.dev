import { actions } from "astro:actions";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { RawSessionMessage } from "@/lib/chat/buildHistoryItems";
import { getSessionContextUsage } from "@/lib/chat/sessionContextUsage";
import type { PromptAttachmentPart } from "@/types/message";

const CHAT_HISTORY_PAGE_LIMIT = 50;

interface UseChatActionsOptions {
	projectId: string;
	models: ReadonlyArray<{
		id: string;
		provider: string;
		supportsAttachments?: boolean;
		contextLimit?: number;
	}>;
	sessionId: string | null;
	isStreaming: boolean;
	currentModel: { providerID: string; modelID: string } | null;
	pendingAttachments: PromptAttachmentPart[];
	pendingPermission: { requestId: string } | null;
	pendingQuestion: { requestId: string } | null;
	fetchJson: <T>(url: string, init?: RequestInit) => Promise<T>;
	showRequestError: (title: string, error: unknown) => void;
	setIsStreaming: (value: boolean) => void;
	setSessionContextLoaded: (loaded: boolean) => void;
	setSessionContextUsage: (
		usage: ReturnType<typeof getSessionContextUsage>,
	) => void;
	setCurrentModel: (
		model: { providerID: string; modelID: string } | null,
	) => void;
	setPendingAttachments: (attachments: PromptAttachmentPart[]) => void;
	setPendingAttachmentError: (error: string | null) => void;
	setPendingPermission: (permission: null) => void;
	setPendingQuestion: (question: null) => void;
}

export function useChatActions({
	projectId,
	models,
	sessionId,
	isStreaming,
	currentModel,
	pendingAttachments,
	pendingPermission,
	pendingQuestion,
	fetchJson,
	showRequestError,
	setIsStreaming,
	setSessionContextLoaded,
	setSessionContextUsage,
	setCurrentModel,
	setPendingAttachments,
	setPendingAttachmentError,
	setPendingPermission,
	setPendingQuestion,
}: UseChatActionsOptions) {
	const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

	const handleStop = useCallback(async () => {
		if (!sessionId || !isStreaming) return;

		try {
			await fetchJson<boolean>(
				`/api/projects/${projectId}/opencode/session/${sessionId}/abort`,
				{ method: "POST" },
			);
		} catch (error) {
			showRequestError("Failed to stop response", error);
		}
	}, [fetchJson, isStreaming, projectId, sessionId, showRequestError]);

	const handleCompact = useCallback(async () => {
		if (!sessionId) return;
		if (!currentModel) {
			toast.info("Select a model before compacting the conversation");
			return;
		}

		setIsStreaming(true);
		setSessionContextLoaded(false);
		try {
			await fetchJson<boolean>(
				`/api/projects/${projectId}/opencode/session/${sessionId}/summarize`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						providerID: currentModel.providerID,
						modelID: currentModel.modelID,
						auto: false,
					}),
				},
			);

			const messagesData = await fetchJson<
				RawSessionMessage[] | { messages?: RawSessionMessage[] }
			>(
				`/api/projects/${projectId}/opencode/session/${sessionId}/message?limit=${CHAT_HISTORY_PAGE_LIMIT}`,
			);
			const messages = Array.isArray(messagesData)
				? messagesData
				: (messagesData.messages ?? []);
			setSessionContextUsage(
				getSessionContextUsage(messages, currentModel, models),
			);
			toast.success("Conversation compacted");
		} catch (error) {
			showRequestError("Failed to compact conversation", error);
		} finally {
			setIsStreaming(false);
			setSessionContextLoaded(true);
		}
	}, [
		currentModel,
		fetchJson,
		models,
		projectId,
		sessionId,
		setIsStreaming,
		setSessionContextLoaded,
		setSessionContextUsage,
		showRequestError,
	]);

	const handleModelChange = async (compositeKey: string) => {
		const [providerId, ...modelIdParts] = compositeKey.split(":");
		const modelId = modelIdParts.join(":");
		const newModelConfig = models.find(
			(m) => m.id === modelId && m.provider === providerId,
		);
		const newModelSupportsAttachments =
			newModelConfig?.supportsAttachments ?? true;

		if (pendingAttachments.length > 0 && !newModelSupportsAttachments) {
			const textAttachments = pendingAttachments.filter(
				(a) => a.kind !== "image",
			);
			const imageAttachments = pendingAttachments.filter(
				(a) => a.kind === "image",
			);
			if (imageAttachments.length > 0) {
				setPendingAttachments(textAttachments);
				setPendingAttachmentError(null);
				toast.info("Images cleared", {
					description: "The selected model doesn't support image input",
				});
			}
		}

		const newModel = newModelConfig
			? { providerID: newModelConfig.provider, modelID: newModelConfig.id }
			: null;
		const previousModel = currentModel;
		setCurrentModel(newModel);

		try {
			const modelString = newModel
				? `${newModel.providerID}/${newModel.modelID}`
				: null;
			const result = await actions.projects.updateModel({
				projectId,
				model: modelString || "",
			});
			if (!result.data?.success) setCurrentModel(previousModel);
		} catch {
			setCurrentModel(previousModel);
		}
	};

	const handlePermissionDecision = useCallback(
		async (reply: "once" | "always" | "reject") => {
			if (!pendingPermission) return;

			try {
				await fetchJson(
					`/api/projects/${projectId}/opencode/permission/${pendingPermission.requestId}/reply`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ reply }),
					},
				);
				setPendingPermission(null);
			} catch (error) {
				showRequestError("Failed to respond to permission request", error);
			}
		},
		[
			fetchJson,
			pendingPermission,
			projectId,
			setPendingPermission,
			showRequestError,
		],
	);

	const handleQuestionSubmit = useCallback(
		async (answers: string[][]) => {
			if (!pendingQuestion) return;

			try {
				await fetchJson(
					`/api/projects/${projectId}/opencode/question/${pendingQuestion.requestId}/reply`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ answers }),
					},
				);
				setPendingQuestion(null);
			} catch (error) {
				showRequestError("Failed to submit question response", error);
			}
		},
		[
			fetchJson,
			pendingQuestion,
			projectId,
			setPendingQuestion,
			showRequestError,
		],
	);

	const handleQuestionReject = useCallback(async () => {
		if (!pendingQuestion) return;

		try {
			await fetchJson(
				`/api/projects/${projectId}/opencode/question/${pendingQuestion.requestId}/reject`,
				{
					method: "POST",
				},
			);
			setPendingQuestion(null);
		} catch (error) {
			showRequestError("Failed to reject question", error);
		}
	}, [
		fetchJson,
		pendingQuestion,
		projectId,
		setPendingQuestion,
		showRequestError,
	]);

	const toggleToolExpanded = (id: string) => {
		setExpandedTools((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return {
		expandedTools,
		handleStop,
		handleCompact,
		handleModelChange,
		handlePermissionDecision,
		handleQuestionSubmit,
		handleQuestionReject,
		toggleToolExpanded,
	};
}
