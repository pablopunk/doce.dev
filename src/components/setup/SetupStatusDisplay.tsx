import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface SetupStatusDisplayProps {
	projectId: string;
}

interface CurrentEvent {
	type: "message" | "tool";
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

const TOTAL_STEPS = 5;

// All steps in order for the timeline
const STEPS: Array<{ step: number; label: string }> = [
	{ step: 1, label: "Files" },
	{ step: 2, label: "Docker" },
	{ step: 3, label: "Agent" },
	{ step: 4, label: "Build" },
	{ step: 5, label: "Done" },
];

// Descriptions for each step when no events are streaming
const STEP_DESCRIPTIONS: Record<number, string> = {
	1: "Creating project files...",
	2: "Setting up Docker containers...",
	3: "Initializing AI agent...",
	4: "Building your website...",
	5: "Completing setup...",
};

/**
 * Extract friendly description from a tool call
 * Examples: "Creating index.tsx..." "Editing Layout.tsx..." "Reading package.json..."
 */
function getFriendlyToolDescription(toolName: string, input: unknown): string {
	const inputObj = (input as Record<string, unknown>) || {};

	// Extract file path from input
	const filePath =
		typeof inputObj.filePath === "string"
			? inputObj.filePath
			: typeof inputObj.path === "string"
				? inputObj.path
				: null;

	const fileName = filePath ? filePath.split("/").pop() : null;

	// Map tool names to friendly descriptions
	const toolDescriptions: Record<string, string> = {
		read: "Reading",
		write: "Creating",
		edit: "Editing",
		delete: "Deleting",
		list: "Listing",
		bash: "Running",
		glob: "Finding files",
	};

	const action =
		toolDescriptions[toolName] ||
		toolName.charAt(0).toUpperCase() + toolName.slice(1);

	if (fileName) {
		return `${action} ${fileName}...`;
	}

	return `${action}...`;
}

export function SetupStatusDisplay({ projectId }: SetupStatusDisplayProps) {
	const [isComplete, setIsComplete] = useState(false);
	const [currentEvent, setCurrentEvent] = useState<CurrentEvent | null>(null);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [currentStep, setCurrentStep] = useState(1);
	const [setupError, setSetupError] = useState<string | null>(null);
	const [agentTimeoutWarning, setAgentTimeoutWarning] = useState<string | null>(
		null,
	);
	const [jobTimeoutWarning, setJobTimeoutWarning] = useState<string | null>(
		null,
	);
	const eventSourceRef = useRef<EventSource | null>(null);
	const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const promptSentTimeRef = useRef<number | null>(null);

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
	}, [projectId, isComplete]);

	const handleOpencodeEvent = (event: {
		type: string;
		payload: Record<string, unknown>;
	}) => {
		const { type, payload } = event;

		switch (type) {
			case "chat.message.part.added": {
				// New event type for streaming text parts
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
					// Advance to build step when we start streaming agent messages
					setCurrentStep(4);
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
				// Advance to build step when we start streaming agent messages
				setCurrentStep(4);
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
				const { name, input } = payload as {
					name: string;
					input: unknown;
				};

				const friendlyText = getFriendlyToolDescription(name, input);

				// Fade transition to new tool
				setIsTransitioning(true);
				if (transitionTimeoutRef.current) {
					clearTimeout(transitionTimeoutRef.current);
				}
				transitionTimeoutRef.current = setTimeout(() => {
					setCurrentEvent({
						type: "tool",
						text: friendlyText,
						isStreaming: true,
					});
					setIsTransitioning(false);
				}, 300);
				break;
			}

			case "chat.tool.finish": {
				setCurrentEvent((prev) => {
					if (prev?.type === "tool") {
						return { ...prev, isStreaming: false };
					}
					return prev;
				});
				break;
			}

			case "chat.tool.error": {
				setCurrentEvent((prev) => {
					if (prev?.type === "tool") {
						return { ...prev, isStreaming: false };
					}
					return prev;
				});
				break;
			}

			case "setup.complete": {
				// Event stream signals that initial prompt was completed
				setIsComplete(true);
				setCurrentStep(5);
				break;
			}
		}
	};

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

				// When we reach step 5, the backend has marked initial_prompt_completed
				// Reload the page so it shows the chat/preview instead of setup
				if (data.currentStep >= 5 && data.isSetupComplete) {
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
		if (currentStep !== 4 || isComplete) {
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
		currentEvent?.type === "tool"
			? currentEvent?.text
			: currentEvent?.type === "message"
				? currentEvent?.text
				: jobTimeoutWarning
					? jobTimeoutWarning
					: agentTimeoutWarning && currentStep === 4
						? agentTimeoutWarning
						: (STEP_DESCRIPTIONS[currentStep] ?? "Building your website...");
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
							<div
								className={`flex items-center justify-center gap-2 min-h-6 transition-opacity duration-300 ${
									isTransitioning ? "opacity-0" : "opacity-100"
								}`}
							>
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
								<AlertTriangle className="h-12 w-12 text-red-500" />
							</div>
							<div className="p-4 bg-red-50 border border-red-200 rounded-lg text-left">
								<p className="text-sm text-red-800 break-words">
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
