import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useChatPanel } from "@/hooks/useChatPanel";
import type { Message } from "@/types/message";
import { AgentThinkingIndicator } from "./AgentThinkingIndicator";
import { AgentUnreachableBanner } from "./AgentUnreachableBanner";
import { ChatContextUsage } from "./ChatContextUsage";
import { ChatDetachToggle } from "./ChatDetachToggle";
import { ChatDiagnostic } from "./ChatDiagnostic";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import { ChatSessionTitle } from "./ChatSessionTitle";
import { PermissionDock } from "./composer/PermissionDock";
import { QuestionDock } from "./composer/QuestionDock";
import { buildRolledMessages, RevertDock } from "./composer/RevertDock";
import { TodoDock } from "./composer/TodoDock";

interface ChatPanelProps {
	projectId: string;
	models?: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
		supportsAttachments?: boolean;
	}>;
	onOpenFile?: ((filePath: string) => void) | undefined;
	onStreamingStateChange?:
		| ((userMessageCount: number, isStreaming: boolean) => void)
		| undefined;
	/** Hide the detach toggle (e.g. when already floating) */
	hideDetachToggle?: boolean;
}

export function ChatPanel({
	projectId,
	models = [],
	onOpenFile,
	onStreamingStateChange,
	hideDetachToggle = false,
}: ChatPanelProps) {
	const {
		items,
		sessionId,
		opencodeReady,
		isStreaming,
		pendingPermission,
		pendingQuestion,
		todos,
		pendingAttachments,
		pendingAttachmentError,
		currentModel,
		sessionTitle,
		sessionTitleLoaded,
		sessionContextUsage,
		sessionContextLoaded,
		expandedTools,
		scrollRef,
		latestDiagnostic,
		setPendingAttachments,
		setPendingAttachmentError,
		handleSend,
		handleStop,
		handleModelChange,
		handlePermissionDecision,
		handleQuestionSubmit,
		handleQuestionReject,
		toggleToolExpanded,
		handleScroll,
		handleRestore,
		handleUnrevert,
		draftSeed,
		clearDraftSeed,
		clearDiagnostic,
		rawItems,
		revertMessageId,
	} = useChatPanel({ projectId, models, onStreamingStateChange });

	const rolledMessages = useMemo(
		() => buildRolledMessages(rawItems, revertMessageId),
		[rawItems, revertMessageId],
	);

	const handleRestoreUpTo = async (messageId: string) => {
		// Step the revert pointer forward to the user message AFTER the clicked one.
		// If there's nothing further, unrevert entirely (matches opencode redo).
		const idx = rolledMessages.findIndex((m) => m.id === messageId);
		const next = idx >= 0 ? rolledMessages[idx + 1] : undefined;
		if (!next) {
			await handleUnrevert();
			return;
		}
		const item = rawItems.find(
			(it) => it.type === "message" && it.id === next.id,
		);
		const data = item?.data as Message | undefined;
		if (!data) return;
		const text = next.text;
		const attachments = data.parts.filter(
			(p): p is import("@/types/message").PromptAttachmentPart =>
				p.type === "attachment",
		);
		await handleRestore({
			messageId: next.id,
			role: "user",
			text,
			attachments,
		});
	};

	const isBlocked = Boolean(pendingPermission || pendingQuestion);

	// Determine if we're waiting for an agent response:
	// Last item is a user message and we have no assistant response following it
	const isWaitingForAgent = useMemo(() => {
		if (items.length === 0) return false;
		const lastItem = items[items.length - 1];
		if (!lastItem) return false;

		if (lastItem.type === "message") {
			const msg = lastItem.data as Message;
			if (msg.role === "user" && msg.localStatus !== "failed") {
				return true;
			}
		}

		return false;
	}, [items]);

	// Show unreachable banner when opencode went down after chat was active
	const showUnreachableBanner = !opencodeReady && items.length > 0;

	return (
		<div className="flex flex-col h-full">
			{!hideDetachToggle && (
				<div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b bg-muted/30 shrink-0">
					<div className="min-w-0 flex-1">
						<ChatSessionTitle
							title={sessionTitle}
							isLoading={Boolean(sessionId) && !sessionTitleLoaded}
						/>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<ChatContextUsage
							usage={sessionContextUsage}
							isLoading={Boolean(sessionId) && !sessionContextLoaded}
						/>
						<ChatDetachToggle />
					</div>
				</div>
			)}
			<div
				className="flex-1 overflow-y-auto"
				ref={scrollRef}
				onScroll={handleScroll}
			>
				{items.length === 0 ? (
					<div className="flex items-center justify-center h-full text-muted-foreground">
						{opencodeReady ? (
							<p>Send a message to start chatting</p>
						) : (
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								<p>Waiting for opencode...</p>
							</div>
						)}
					</div>
				) : (
					<>
						<ChatMessages
							items={items}
							expandedTools={expandedTools}
							onToggleTool={toggleToolExpanded}
							onOpenFile={onOpenFile}
							onRestore={handleRestore}
						/>
						<AgentThinkingIndicator
							projectId={projectId}
							isWaiting={isWaitingForAgent}
							opencodeReady={opencodeReady}
						/>
					</>
				)}
				{showUnreachableBanner && !isWaitingForAgent && (
					<AgentUnreachableBanner projectId={projectId} />
				)}
				{latestDiagnostic && (
					<ChatDiagnostic
						diagnostic={latestDiagnostic}
						onDismiss={clearDiagnostic}
					/>
				)}
			</div>

			{(() => {
				const compositeModelKey = currentModel
					? `${currentModel.providerID}:${currentModel.modelID}`
					: null;
				const modelSupport =
					models.find(
						(m) =>
							currentModel &&
							m.id === currentModel.modelID &&
							m.provider === currentModel.providerID,
					)?.supportsAttachments ?? true;

				return (
					<>
						{rolledMessages.length > 0 && !isBlocked && (
							<RevertDock
								items={rolledMessages}
								disabled={isStreaming}
								onRestoreUpTo={handleRestoreUpTo}
								onCancel={handleUnrevert}
							/>
						)}
						{todos.length > 0 && !isBlocked && <TodoDock todos={todos} />}
						{pendingQuestion && (
							<QuestionDock
								request={pendingQuestion}
								onSubmit={handleQuestionSubmit}
								onReject={handleQuestionReject}
							/>
						)}
						{pendingPermission && (
							<PermissionDock
								request={pendingPermission}
								onDecide={handlePermissionDecision}
							/>
						)}
						{!isBlocked && (
							<ChatInput
								seedDraft={draftSeed}
								onSeedConsumed={clearDraftSeed}
								onSend={handleSend}
								onStop={handleStop}
								isStreaming={isStreaming}
								disabled={!opencodeReady || isStreaming}
								placeholder={
									!opencodeReady
										? "Waiting for opencode..."
										: isStreaming
											? "Processing..."
											: "Type a message..."
								}
								model={compositeModelKey}
								models={models}
								onModelChange={handleModelChange}
								attachments={pendingAttachments}
								onAttachmentsChange={setPendingAttachments}
								attachmentError={pendingAttachmentError}
								onAttachmentError={setPendingAttachmentError}
								supportsAttachments={modelSupport}
							/>
						)}
					</>
				);
			})()}
		</div>
	);
}
