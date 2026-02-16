import { Loader2 } from "lucide-react";
import { useChatPanel } from "@/hooks/useChatPanel";
import { ChatDiagnostic } from "./ChatDiagnostic";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";

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
		toggleToolExpanded,
		handleScroll,
		clearDiagnostic,
	} = useChatPanel({ projectId, models, onStreamingStateChange });

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
				);
			})()}
		</div>
	);
}
