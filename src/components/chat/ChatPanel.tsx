import { Loader2 } from "lucide-react";
import { useChatPanel } from "@/hooks/useChatPanel";
import { ChatDiagnostic } from "./ChatDiagnostic";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import { PermissionDock } from "./composer/PermissionDock";
import { QuestionDock } from "./composer/QuestionDock";
import { TodoDock } from "./composer/TodoDock";

interface ChatPanelProps {
	projectId: string;
	models?: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
	}>;
	onOpenFile?: ((filePath: string) => void) | undefined;
	onStreamingStateChange?:
		| ((userMessageCount: number, isStreaming: boolean) => void)
		| undefined;
}

export function ChatPanel({
	projectId,
	models = [],
	onOpenFile,
	onStreamingStateChange,
}: ChatPanelProps) {
	const {
		items,
		opencodeReady,
		isStreaming,
		pendingPermission,
		pendingQuestion,
		todos,
		pendingImages,
		pendingImageError,
		currentModel,
		expandedTools,
		scrollRef,
		latestDiagnostic,
		setPendingImages,
		setPendingImageError,
		handleSend,
		handleModelChange,
		handlePermissionDecision,
		handleQuestionSubmit,
		handleQuestionReject,
		toggleToolExpanded,
		handleScroll,
		clearDiagnostic,
	} = useChatPanel({ projectId, models, onStreamingStateChange });

	const isBlocked = Boolean(pendingPermission || pendingQuestion);

	return (
		<div className="flex flex-col h-full">
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
					<ChatMessages
						items={items}
						expandedTools={expandedTools}
						onToggleTool={toggleToolExpanded}
						onOpenFile={onOpenFile}
					/>
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
					)?.supportsImages ?? true;

				return (
					<>
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
								onSend={handleSend}
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
								images={pendingImages}
								onImagesChange={setPendingImages}
								imageError={pendingImageError}
								onImageError={setPendingImageError}
								supportsImages={modelSupport}
							/>
						)}
					</>
				);
			})()}
		</div>
	);
}
