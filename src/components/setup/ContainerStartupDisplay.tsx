import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ContainerStartupDisplayProps {
	projectId: string;
	reason?: "initial" | "restart"; // "initial" for first startup, "restart" for comeback
	onComplete?: () => void; // Called when startup/restart is complete
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

const TOTAL_STEPS = 2;

// Two steps only for container startup
const STEPS: Array<{ step: number; label: string }> = [
	{ step: 1, label: "Docker" },
	{ step: 2, label: "Agent" },
];

// Descriptions for each step
const STEP_DESCRIPTIONS: Record<number, string> = {
	1: "Starting containers...",
	2: "Initializing AI agent...",
};

export function ContainerStartupDisplay({
	projectId,
	reason = "initial",
	onComplete,
}: ContainerStartupDisplayProps) {
	const [isComplete, setIsComplete] = useState(false);
	const [currentEvent, setCurrentEvent] = useState<CurrentEvent | null>(null);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [currentStep, setCurrentStep] = useState(1);
	const [startupError, setStartupError] = useState<string | null>(null);
	const [jobTimeoutWarning, setJobTimeoutWarning] = useState<string | null>(
		null,
	);
	const [sessionsLoaded, setSessionsLoaded] = useState(false);
	const eventSourceRef = useRef<EventSource | null>(null);
	const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const startTimeRef = useRef<number>(Date.now());

	const handleOpencodeEvent = useCallback(
		(event: { type: string; payload: Record<string, unknown> }) => {
			const { type, payload } = event;

			switch (type) {
				case "chat.message.delta": {
					// Ignore message events - only show tool calls
					// Advance to agent step when we start streaming agent messages
					setCurrentStep(2);
					break;
				}

				case "chat.message.final": {
					// Ignore message events
					break;
				}

				case "chat.tool.start": {
					const { name, input } = payload as {
						name: string;
						input: unknown;
					};

					const inputObj = (input as Record<string, unknown>) || {};
					const filePath =
						typeof inputObj.filePath === "string"
							? inputObj.filePath
							: typeof inputObj.path === "string"
								? inputObj.path
								: null;
					const fileName = filePath ? filePath.split("/").pop() : null;

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
						toolDescriptions[name] ||
						name.charAt(0).toUpperCase() + name.slice(1);
					const friendlyText = fileName
						? `${action} ${fileName}...`
						: `${action}...`;

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
					setCurrentStep(2);
					onComplete?.();
					break;
				}
			}
		},
		[onComplete],
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
			} catch (error) {
				// Log parsing errors for debugging, but don't crash
				console.error(
					"Failed to parse opencode event",
					{ data: e.data, error },
					error instanceof Error ? error.message : String(error),
				);
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

	// Poll queue status for container startup progress
	useEffect(() => {
		if (isComplete) return;

		let intervalId: ReturnType<typeof setInterval> | null = null;

		const poll = async () => {
			try {
				const response = await fetch(`/api/projects/${projectId}/queue-status`);

				if (!response.ok) {
					setStartupError("Failed to check startup status");
					return;
				}

				const data = (await response.json()) as QueueStatusResponse;

				// For container startup, map the queue status steps:
				// Step 1-2 = Docker (containers starting)
				// Step 3+ = Agent (opencode initializing)
				if (data.currentStep >= 3) {
					setCurrentStep(2);
				} else {
					setCurrentStep(1);
				}

				// Check for queue job failures
				if (data.hasError) {
					setStartupError(data.errorMessage || "Startup failed");
					return;
				}

				// Show queue job timeout warning
				if (data.jobTimeoutWarning) {
					setJobTimeoutWarning(data.jobTimeoutWarning);
				}

				// When we reach step 5, the container is fully ready
				// But if restarting, also wait for sessions to load
				const shouldWaitForSessions = reason === "restart";
				const sessionConditionMet = !shouldWaitForSessions || sessionsLoaded;

				if (
					data.currentStep >= 5 &&
					data.isSetupComplete &&
					sessionConditionMet
				) {
					// Wait a moment for the UI to show final state, then signal completion
					setTimeout(() => {
						setIsComplete(true);
						onComplete?.();
					}, 1000);
				}
			} catch (error) {
				console.error("Failed to poll queue status:", error);
			}
		};

		// Adaptive polling: faster at first, slower later
		const elapsed = Date.now() - startTimeRef.current;
		const pollCount = Math.floor(elapsed / 500);

		let pollInterval = 2000;
		if (pollCount < 3) pollInterval = 500;
		else if (pollCount < 13) pollInterval = 1000;

		// Check for timeout (30 seconds)
		if (elapsed > 30_000 && !startupError) {
			setStartupError("Timeout waiting for containers to start");
			return;
		}

		intervalId = setInterval(poll, pollInterval);
		// Run first poll immediately
		poll();

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	}, [projectId, isComplete, startupError, sessionsLoaded, reason, onComplete]);

	// Poll for persisted session loading (only on restart)
	useEffect(() => {
		if (reason !== "restart" || sessionsLoaded || isComplete) return;

		let intervalId: ReturnType<typeof setInterval> | null = null;
		const sessionCheckStartTime = Date.now();

		const pollSessions = async () => {
			try {
				const response = await fetch(
					`/api/projects/${projectId}/opencode/session`,
				);
				if (!response.ok) return;

				let data: unknown;
				try {
					data = await response.json();
				} catch (parseError) {
					// Response is not valid JSON
					console.error(
						"Failed to parse session response",
						parseError instanceof Error
							? parseError.message
							: String(parseError),
					);
					return;
				}

				// Type-safe extraction of sessions array
				const sessions = Array.isArray(data)
					? data
					: (data as Record<string, unknown>)?.sessions || null;

				// If we have at least one session, mark as loaded
				if (Array.isArray(sessions) && sessions.length > 0) {
					setSessionsLoaded(true);
					return;
				}

				// Timeout after 30s - assume sessions are loaded or don't exist
				const elapsed = Date.now() - sessionCheckStartTime;
				if (elapsed > 30_000) {
					setSessionsLoaded(true);
				}
			} catch (error) {
				console.error(
					"Failed to check session loading",
					error instanceof Error ? error.message : String(error),
				);
			}
		};

		// Poll every 500ms for sessions
		intervalId = setInterval(pollSessions, 500);
		pollSessions(); // Check immediately

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	}, [projectId, reason, sessionsLoaded, isComplete]);

	const displayMessage =
		currentEvent?.type === "tool"
			? currentEvent?.text
			: jobTimeoutWarning
				? jobTimeoutWarning
				: reason === "restart" && !sessionsLoaded && currentStep >= 2
					? "Loading your chat history..."
					: (STEP_DESCRIPTIONS[currentStep] ?? "Starting your environment...");

	const hasError = startupError !== null;
	const heading =
		reason === "restart"
			? "Your environment was stopped. Restarting..."
			: "Starting your environment...";

	return (
		<div className="flex-1 flex items-center justify-center px-4">
			<div className="flex flex-col items-center gap-8 w-full max-w-2xl">
				<div className="text-center space-y-6 w-full">
					<h2 className="text-2xl font-semibold">
						{hasError ? "Failed to Start Environment" : heading}
					</h2>

					{!hasError ? (
						<div className="space-y-4">
							{/* Timeline of steps */}
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
								<p className="text-sm text-muted-foreground">
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
									{startupError}
								</p>
							</div>
							<Button
								onClick={() => window.location.reload()}
								variant="outline"
							>
								Retry Startup
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
