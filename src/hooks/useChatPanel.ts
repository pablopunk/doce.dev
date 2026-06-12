import { useEffect } from "react";
import { useChatActions } from "@/hooks/useChatActions";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useChatRestore } from "@/hooks/useChatRestore";
import { useChatScroll } from "@/hooks/useChatScroll";
import { useChatSend } from "@/hooks/useChatSend";
import { useChatSse } from "@/hooks/useChatSse";
import { useLiveState } from "@/hooks/useLiveState";
import type { InitialChatState } from "@/server/opencode/initialChat";
import { useChatStore } from "@/stores/useChatStore";
import { createTextPart, type Message } from "@/types/message";

interface UseChatPanelOptions {
	projectId: string;
	models: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
		supportsAttachments?: boolean;
		contextLimit?: number;
	}>;
	onStreamingStateChange?:
		| ((userMessageCount: number, isStreaming: boolean) => void)
		| undefined;
	/**
	 * SSR-fetched initial state. When present we hydrate the store synchronously
	 * on mount so the panel paints with history already populated, skipping the
	 * client-side history fetch entirely.
	 */
	initialChat?: InitialChatState | null;
}

export function useChatPanel({
	projectId,
	models,
	onStreamingStateChange,
	initialChat = null,
}: UseChatPanelOptions) {
	const store = useChatStore(projectId);
	const {
		items,
		sessionId,
		revertMessageId,
		opencodeReady,
		initialPromptSent,
		userPromptMessageId,
		projectPrompt,
		sessionTitle,
		sessionContextUsage,
		currentModel,
		historyLoaded,
		presenceLoaded,
		isStreaming,
		pendingAttachments,
		pendingAttachmentError,
		latestDiagnostic,
		pendingPermission,
		pendingQuestion,
		todos,
		setSessionId,
		setRevertMessageId,
		setOpenCodeReady,
		setInitialPromptSent,
		setUserPromptMessageId,
		setProjectPrompt,
		setSessionTitle,
		setSessionContextUsage,
		setCurrentModel,
		setHistoryLoaded,
		setPresenceLoaded,
		setIsStreaming,
		setPendingAttachments,
		setPendingAttachmentError,
		setItems,
		addItem,
		updateItem,
		handleChatEvent,
		setLatestDiagnostic,
		setPendingPermission,
		setPendingQuestion,
		setTodos,
	} = store;

	// Live state from SSE — replaces presence heartbeat polling
	const { data: liveData } = useLiveState(`/api/projects/${projectId}/live`);
	// initialChat is consumed by ProjectContentWrapper via useChatStoreSeed —
	// it lands in the store before this hook's first read. Reference it here
	// only to silence the unused-prop lint when callers pass it through.
	void initialChat;

	const { scrollRef, scrollToBottom, handleScroll } = useChatScroll(items);

	const {
		fetchJson,
		toErrorMessage,
		showRequestError,
		refreshBlockingState,
		sessionTitleLoaded,
		sessionContextLoaded,
		setSessionContextLoaded,
	} = useChatHistory({
		projectId,
		models,
		sessionId,
		opencodeReady,
		historyLoaded,
		presenceLoaded,
		userPromptMessageId,
		sessionTitle,
		currentModel,
		liveData,
		setSessionId,
		setRevertMessageId,
		setCurrentModel,
		setHistoryLoaded,
		setSessionTitle,
		setSessionContextUsage,
		setPendingPermission,
		setPendingQuestion,
		setTodos,
		setLatestDiagnostic,
		setOpenCodeReady,
		setInitialPromptSent,
		setUserPromptMessageId,
		setProjectPrompt,
		setPresenceLoaded,
		setItems,
		scrollToBottom,
	});

	// Load initial prompt
	useEffect(() => {
		if (!opencodeReady || initialPromptSent || !projectPrompt || !sessionId)
			return;
		const userMessageId = `user_initial_${Date.now()}`;
		addItem({
			type: "message",
			id: userMessageId,
			data: {
				id: userMessageId,
				role: "user",
				parts: [createTextPart(projectPrompt)],
			},
		});
		scrollToBottom();
		setInitialPromptSent(true);
	}, [
		opencodeReady,
		initialPromptSent,
		projectPrompt,
		sessionId,
		addItem,
		scrollToBottom,
		setInitialPromptSent,
	]);

	useChatSse({
		projectId,
		opencodeReady,
		handleChatEvent,
		setIsStreaming,
		showRequestError,
	});

	// Streaming state change
	useEffect(() => {
		const userMessageCount = items.filter(
			(item) =>
				item.type === "message" && (item.data as Message).role === "user",
		).length;
		onStreamingStateChange?.(userMessageCount, isStreaming);
	}, [items, isStreaming, onStreamingStateChange]);

	const { handleSend } = useChatSend({
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
	});

	const {
		expandedTools,
		handleStop,
		handleCompact,
		handleModelChange,
		handlePermissionDecision,
		handleQuestionSubmit,
		handleQuestionReject,
		toggleToolExpanded,
	} = useChatActions({
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
	});

	const {
		restoreEnabled,
		restoreGuardLoaded,
		draftSeed,
		handleRestore,
		handleUnrevert,
		clearDraftSeed,
		visibleItems,
	} = useChatRestore({
		projectId,
		sessionId,
		items,
		revertMessageId,
		setRevertMessageId,
		showRequestError,
	});

	return {
		items: visibleItems,
		rawItems: items,
		sessionId,
		revertMessageId,
		handleRestore,
		handleUnrevert,
		restoreEnabled,
		restoreGuardLoaded,
		draftSeed,
		clearDraftSeed,
		opencodeReady,
		isStreaming,
		pendingPermission,
		pendingQuestion,
		todos,
		pendingAttachments,
		pendingAttachmentError,
		currentModel,
		expandedTools,
		scrollRef,
		latestDiagnostic,
		setPendingAttachments,
		setPendingAttachmentError,
		handleSend,
		handleStop,
		handleCompact,
		handleModelChange,
		handlePermissionDecision,
		handleQuestionSubmit,
		handleQuestionReject,
		toggleToolExpanded,
		handleScroll,
		clearDiagnostic: () => setLatestDiagnostic(null),
		sessionTitle,
		sessionTitleLoaded,
		sessionContextUsage,
		sessionContextLoaded,
	};
}
