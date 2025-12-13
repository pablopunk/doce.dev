"use client";

import { AnimatePresence, motion } from "motion/react";
import { CodePreview } from "@/components/code-preview";
import { ChatInterface } from "@/domain/conversations/components/chat-interface";
import {
	ProjectStateProvider,
	useProjectState,
} from "@/domain/projects/hooks/use-project-state";

interface ProjectPageProps {
	projectId: string;
	initialPrompt?: string | null;
}

function ProjectPageContent({ projectId, initialPrompt }: ProjectPageProps) {
	const { phase, containerStatus, error } = useProjectState();

	const isReady = phase === "ready";
	const showError = containerStatus === "failed" && error;

	return (
		<main className="flex h-full flex-col max-h-[calc(100vh-3.5rem)] min-h-[calc(100vh-3.5rem)]">
			<div className="flex flex-1 overflow-hidden relative">
				{/* Error state */}
				<AnimatePresence>
					{showError && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className="absolute inset-0 flex items-center justify-center z-10"
						>
							<div className="bg-surface border border-danger/30 rounded-[2rem] p-12 text-center space-y-6 shadow-lg max-w-md">
								<div className="w-20 h-20 mx-auto rounded-full bg-danger/10 flex items-center justify-center">
									<span className="text-3xl">!</span>
								</div>
								<div>
									<p className="text-lg font-medium text-strong">
										Failed to start preview
									</p>
									<p className="text-sm text-muted mt-2">{error}</p>
								</div>
								<button
									type="button"
									onClick={() => window.location.reload()}
									className="px-4 py-2 bg-cta border border-border rounded-lg text-strong hover:brightness-110 transition-all"
								>
									Retry
								</button>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Main content - animated layout */}
				<motion.div
					layout
					transition={{
						layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
					}}
					className={`flex h-full ${isReady ? "w-full" : "w-full items-center justify-center p-4"}`}
				>
					{/* Chat container */}
					<motion.div
						layout
						transition={{
							layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
						}}
						className={
							isReady ? "w-1/3 flex h-full" : "w-full max-w-2xl h-[75vh]"
						}
					>
						<motion.div
							layout
							transition={{
								layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
							}}
							className={
								isReady
									? "flex-1 flex h-full"
									: "w-full h-full flex flex-col bg-surface border border-border rounded-[2rem] shadow-lg overflow-hidden"
							}
						>
							<ChatInterface
								projectId={projectId}
								initialPrompt={initialPrompt}
								isSquircleMode={!isReady}
							/>
						</motion.div>
					</motion.div>

					{/* Preview container - only visible when ready */}
					<AnimatePresence>
						{isReady && (
							<motion.div
								initial={{ opacity: 0, x: 100 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 100 }}
								transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
								className="w-2/3 flex overflow-hidden"
							>
								<CodePreview projectId={projectId} />
							</motion.div>
						)}
					</AnimatePresence>
				</motion.div>
			</div>
		</main>
	);
}

export function ProjectPage({ projectId, initialPrompt }: ProjectPageProps) {
	return (
		<ProjectStateProvider initialPhase="loading">
			<ProjectPageContent projectId={projectId} initialPrompt={initialPrompt} />
		</ProjectStateProvider>
	);
}
