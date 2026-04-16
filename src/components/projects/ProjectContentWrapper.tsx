import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { FloatingChatPanel } from "@/components/chat/FloatingChatPanel";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { ResizableSeparator } from "@/components/preview/ResizableSeparator";
import { ContainerStartupDisplay } from "@/components/setup/ContainerStartupDisplay";
import { useLiveState } from "@/hooks/useLiveState";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { useChatLayout } from "@/stores/useChatLayout";

interface ProjectContentWrapperProps {
	projectId: string;
	projectSlug?: string;
	models?: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
	}>;
}

export function ProjectContentWrapper({
	projectId,
	projectSlug,
	models = [],
}: ProjectContentWrapperProps) {
	const [showStartupDisplay, setShowStartupDisplay] = useState(true);
	const [fileToOpen, setFileToOpen] = useState<string | null>(null);
	const [userMessageCount, setUserMessageCount] = useState(0);
	const [isStreaming, setIsStreaming] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const { isDetached } = useChatLayout();

	const {
		leftPercent,
		rightPercent,
		isDragging,
		isMobile,
		isResizable,
		onSeparatorMouseDown,
	} = useResizablePanel({
		projectId,
		minSize: 25,
		maxSize: 75,
		defaultSize: 33.33,
		containerRef,
	});

	const { data: liveData } = useLiveState(`/api/projects/${projectId}/live`);

	useEffect(() => {
		if (!showStartupDisplay) return;
		if (
			liveData?.previewReady &&
			liveData?.opencodeReady &&
			liveData?.status === "running"
		) {
			setShowStartupDisplay(false);
		}
	}, [
		showStartupDisplay,
		liveData?.previewReady,
		liveData?.opencodeReady,
		liveData?.status,
	]);

	return (
		<div className="flex-1 flex flex-col overflow-hidden relative">
			{showStartupDisplay && (
				<ErrorBoundary componentName="ContainerStartupDisplay">
					<ContainerStartupDisplay
						projectId={projectId}
						reason="restart"
						onComplete={() => setShowStartupDisplay(false)}
					/>
				</ErrorBoundary>
			)}

			{!showStartupDisplay && (
				<div
					className="flex-1 flex w-full min-w-0 overflow-hidden relative"
					data-resizable-group
					ref={containerRef}
				>
					{isMobile ? (
						<div className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden">
							<PreviewPanel
								projectId={projectId}
								projectSlug={projectSlug || ""}
								fileToOpen={fileToOpen}
								onFileOpened={() => setFileToOpen(null)}
								userMessageCount={userMessageCount}
								isStreaming={isStreaming}
								models={models}
								onOpenFile={setFileToOpen}
								onStreamingStateChange={(count, streaming) => {
									setUserMessageCount(count);
									setIsStreaming(streaming);
								}}
							/>
						</div>
					) : (
						<>
							<AnimatePresence initial={false}>
								{!isDetached && (
									<motion.div
										key="docked-chat"
										className="flex flex-col h-full border-r overflow-hidden"
										initial={{ width: 0, opacity: 0 }}
										animate={{
											width: `${leftPercent}%`,
											opacity: 1,
											transition: {
												width: { type: "spring", stiffness: 300, damping: 30 },
												opacity: { duration: 0.2 },
											},
										}}
										exit={{
											width: 0,
											opacity: 0,
											transition: {
												width: { type: "spring", stiffness: 300, damping: 30 },
												opacity: { duration: 0.15 },
											},
										}}
									>
										<ErrorBoundary componentName="ChatPanel">
											<ChatPanel
												projectId={projectId}
												models={models}
												onOpenFile={setFileToOpen}
												onStreamingStateChange={(count, streaming) => {
													setUserMessageCount(count);
													setIsStreaming(streaming);
												}}
											/>
										</ErrorBoundary>
									</motion.div>
								)}
							</AnimatePresence>

							<AnimatePresence initial={false}>
								{!isDetached && isResizable && (
									<motion.div
										key="separator"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										transition={{ duration: 0.15 }}
									>
										<ResizableSeparator onMouseDown={onSeparatorMouseDown} />
									</motion.div>
								)}
							</AnimatePresence>

							<motion.div
								className="flex flex-col h-full overflow-hidden"
								animate={{
									width: isDetached ? "100%" : `${rightPercent}%`,
								}}
								transition={{
									type: "spring",
									stiffness: 300,
									damping: 30,
								}}
							>
								<ErrorBoundary componentName="PreviewPanel">
									<PreviewPanel
										projectId={projectId}
										projectSlug={projectSlug || ""}
										fileToOpen={fileToOpen}
										onFileOpened={() => setFileToOpen(null)}
										userMessageCount={userMessageCount}
										isStreaming={isStreaming}
									/>
								</ErrorBoundary>
							</motion.div>

							{/* Floating chat overlay when detached */}
							<FloatingChatPanel
								projectId={projectId}
								models={models}
								onOpenFile={setFileToOpen}
								onStreamingStateChange={(count, streaming) => {
									setUserMessageCount(count);
									setIsStreaming(streaming);
								}}
							/>
						</>
					)}

					{isDragging && (
						<div
							style={{
								position: "fixed",
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								zIndex: 50,
								cursor: "col-resize",
								backgroundColor: "transparent",
							}}
						/>
					)}
				</div>
			)}
		</div>
	);
}
