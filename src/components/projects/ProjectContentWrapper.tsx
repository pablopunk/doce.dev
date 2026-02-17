import { actions } from "astro:actions";
import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { ResizableSeparator } from "@/components/preview/ResizableSeparator";
import { ContainerStartupDisplay } from "@/components/setup/ContainerStartupDisplay";
import { useResizablePanel } from "@/hooks/useResizablePanel";

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

	// Check if containers are already ready on mount
	useEffect(() => {
		const checkContainerStatus = async () => {
			try {
				const { data, error } = await actions.projects.presence({
					projectId,
					viewerId: `check_${Date.now()}`,
				});

				if (error) return;

				// If both preview and opencode are ready, hide startup display
				if (
					data.previewReady &&
					data.opencodeReady &&
					data.status === "running"
				) {
					setShowStartupDisplay(false);
				}
			} catch {
				// If we can't check, assume containers might be starting
			}
		};

		checkContainerStatus();
	}, [projectId]);

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
							<div
								className="flex flex-col h-full border-r overflow-hidden"
								style={{ width: `${leftPercent}%` }}
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
							</div>

							{isResizable && (
								<ResizableSeparator onMouseDown={onSeparatorMouseDown} />
							)}

							<div
								className="flex flex-col h-full overflow-hidden"
								style={{ width: `${rightPercent}%` }}
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
							</div>
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
