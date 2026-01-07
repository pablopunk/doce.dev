import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface SetupStatusDisplayProps {
	projectId: string;
}

interface CurrentEvent {
	type: "message";
	text: string;
	isStreaming?: boolean;
}

interface QueueStatusResponse {
	projectId: string;
	currentStep: number;
	setupJobs: Record<string, unknown>;
	hasError: boolean;
	errorMessage: string | undefined;
	isSetupComplete: boolean;
	promptSentAt: number | undefined;
	jobTimeoutWarning: string | undefined;
}

const TOTAL_STEPS = 4;

// All steps in order for the timeline
const STEPS: Array<{ step: number; label: string }> = [
	{ step: 1, label: "Files" },
	{ step: 2, label: "Docker" },
	{ step: 3, label: "Agent" },
	{ step: 4, label: "Done" },
];

// Descriptions for each step when no events are streaming
const STEP_DESCRIPTIONS: Record<number, string> = {
	1: "Creating project files...",
	2: "Setting up Docker containers...",
	3: "Leveraging agent...",
	4: "Completing setup...",
};

export function SetupStatusDisplay({ projectId }: SetupStatusDisplayProps) {
	const [isComplete, setIsComplete] = useState(false);
	const [currentEvent, setCurrentEvent] = useState<CurrentEvent | null>(null);
	const [currentStep, setCurrentStep] = useState(1);
	const [setupError, setSetupError] = useState<string | null>(null);
	const [agentTimeoutWarning, setAgentTimeoutWarning] = useState<string | null>(
		null,
	);
	const [jobTimeoutWarning, setJobTimeoutWarning] = useState<string | null>(
		null,
	);
	const eventSourceRef = useRef<EventSource | null>(null);
	const promptSentTimeRef = useRef<number | null>(null);

	const handleOpencodeEvent = useCallback(
		(event: { type: string; payload: Record<string, unknown> }) => {
			const { type, payload } = event;

			switch (type) {
				case "chat.message.part.added": {
					// New event type for streaming text parts - show agent messages
					const { deltaText } = payload as {
						messageId: string;
						partId: string;
						partType: string;
						deltaText?: string;
					};

					if (deltaText) {
						setCurrentEvent((prev) => {
							if (prev?.type === "message") {
								return {
									...prev,
									text: prev.text + deltaText,
									isStreaming: true,
								};
							}

							return {
								type: "message",
								text: deltaText,
								isStreaming: true,
							};
						});
					}
					break;
				}

				case "chat.message.delta": {
					// Backward compatibility for old event type
					const { deltaText } = payload as {
						messageId: string;
						deltaText: string;
					};

					setCurrentEvent((prev) => {
						if (prev?.type === "message") {
							return {
								...prev,
								text: prev.text + deltaText,
								isStreaming: true,
							};
						}

						return {
							type: "message",
							text: deltaText,
							isStreaming: true,
						};
					});
					break;
				}

				case "chat.message.final": {
					setCurrentEvent((prev) => {
						if (prev?.type === "message") {
							return { ...prev, isStreaming: false };
						}
						return prev;
					});
					break;
				}

				case "chat.tool.start": {
					// Tool calls are happening but we don't show them to the user
					break;
				}

				case "chat.tool.finish": {
					// Tool completed, nothing to display
					break;
				}

				case "chat.tool.error": {
					// Tool error occurred, nothing to display
					break;
				}

				case "setup.complete": {
					// Event stream signals that initial prompt was completed
					setIsComplete(true);
					setCurrentStep(4);
					break;
				}
			}
		},
		[],
	);

	// Connect to opencode event stream to show progress
	useEffect(() => {
		if (isComplete) return;

		// Open SSE connection to opencode events
		const eventSource = new EventSource(
			`/api/projects/${projectId}/opencode/event`,
		);
		eventSourceRef.current = eventSource;

		eventSource.addEventListener("chat.event", (e) => {
			try {
				const event = JSON.parse(e.data);
				handleOpencodeEvent(event);
			} catch {
				// Ignore parse errors
			}
		});

		eventSource.onerror = () => {
			eventSource.close();
		};

		return () => {
			if (eventSourceRef.current === eventSource) {
				eventSource.close();
				eventSourceRef.current = null;
			}
		};
	}, [projectId, isComplete, handleOpencodeEvent]);

	// Poll queue status for steps 1-4
	useEffect(() => {
		if (isComplete) return;

		let intervalId: ReturnType<typeof setInterval> | null = null;

		const poll = async () => {
			try {
				const response = await fetch(`/api/projects/${projectId}/queue-status`);

				if (!response.ok) {
					setSetupError("Failed to check setup status");
					return;
				}

				const data = (await response.json()) as QueueStatusResponse;

				// Update current step based on queue jobs
				setCurrentStep(data.currentStep);

				// Track when prompt was sent (for agent timeout detection)
				if (data.promptSentAt && !promptSentTimeRef.current) {
					promptSentTimeRef.current = data.promptSentAt;
				}

				// Check for queue job failures
				if (data.hasError) {
					setSetupError(data.errorMessage || "Setup failed");
					return;
				}

				// Show queue job timeout warning
				if (data.jobTimeoutWarning) {
					setJobTimeoutWarning(data.jobTimeoutWarning);
				}

				// When we reach step 4, the backend has marked initial_prompt_completed
				// Reload the page so it shows the chat/preview instead of setup
				if (data.currentStep >= 4 && data.isSetupComplete) {
					// Wait a moment for the UI to show final state, then reload
					setTimeout(() => {
						window.location.reload();
					}, 1000);
				}
			} catch (error) {
				console.error("Failed to poll queue status:", error);
			}
		};

		// Poll every 2-3 seconds
		intervalId = setInterval(poll, 2500);
		// Run first poll immediately
		poll();

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	}, [projectId, isComplete]);

	// Monitor agent timeout (if prompt sent but no completion after 5 minutes)
	useEffect(() => {
		if (currentStep !== 3 || isComplete) {
			setAgentTimeoutWarning(null);
			return;
		}

		const checkAgentTimeout = () => {
			if (promptSentTimeRef.current) {
				const elapsed = Date.now() - promptSentTimeRef.current;
				const AGENT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

				if (elapsed > AGENT_TIMEOUT_MS) {
					setAgentTimeoutWarning(
						"Agent is taking longer than expected. This can happen with complex prompts. Still waiting...",
					);
				}
			}
		};

		// Check after 5 minutes
		const timeoutId = setTimeout(checkAgentTimeout, 5 * 60 * 1000);

		return () => {
			clearTimeout(timeoutId);
		};
	}, [currentStep, isComplete]);

	const displayMessage =
		currentEvent?.type === "message"
			? currentEvent?.text
			: jobTimeoutWarning
				? jobTimeoutWarning
				: agentTimeoutWarning && currentStep === 3
					? agentTimeoutWarning
					: (STEP_DESCRIPTIONS[currentStep] ?? "Leveraging agent...");
	const hasError = setupError !== null;

	return (
		<div className="flex-1 flex items-center justify-center px-4">
			<div className="flex flex-col items-center gap-8 w-full max-w-2xl">
				<div className="text-center space-y-6 w-full">
					<h2 className="text-2xl font-semibold">
						{hasError ? "Setup Failed" : "Setting up your project..."}
					</h2>

					{!hasError ? (
						<div className="space-y-4">
							{/* Timeline of all steps */}
							<div className="flex items-center justify-between gap-1 w-full">
								{STEPS.map((step) => {
									const isCompleted = currentStep > step.step;
									const isCurrent = currentStep === step.step;

									return (
										<div
											key={step.step}
											className="flex flex-col items-center gap-2 flex-1"
										>
											<div
												className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
													isCurrent
														? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
														: isCompleted
															? "bg-primary/20 text-primary"
															: "bg-secondary text-muted-foreground"
												}`}
											>
												{isCompleted ? "✓" : step.step}
											</div>
											<span
												className={`text-xs font-medium line-clamp-1 ${
													isCurrent ? "text-primary" : "text-muted-foreground"
												}`}
											>
												{step.label}
											</span>
										</div>
									);
								})}
							</div>

							{/* Progress bar */}
							<div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
								<div
									className="h-full bg-primary transition-all duration-300 ease-out"
									style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
								/>
							</div>

							{/* Status message */}
							<div className="flex items-center justify-center gap-2 min-h-6">
								<Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
								<p className="text-sm text-muted-foreground line-clamp-1">
									{displayMessage}
								</p>
							</div>
						</div>
					) : (
						// Error state
						<div className="space-y-4">
							<div className="flex justify-center">
								<AlertTriangle className="h-12 w-12 text-status-error" />
							</div>
							<div className="p-4 bg-status-error-light border border-status-error rounded-lg text-left">
								<p className="text-sm text-status-error break-words">
									<span className="font-semibold">Error: </span>
									{setupError}
								</p>
							</div>
							<Button
								onClick={() => window.location.reload()}
								variant="outline"
							>
								Retry Setup
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
