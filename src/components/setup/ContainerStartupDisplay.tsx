import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLiveState } from "@/hooks/useLiveState";

interface ContainerStartupDisplayProps {
	projectId: string;
	reason?: "initial" | "restart";
	onComplete?: () => void;
}

const TOTAL_STEPS = 2;
const STEPS = [
	{ step: 1, label: "Docker" },
	{ step: 2, label: "Agent" },
];

export function ContainerStartupDisplay({
	projectId,
	reason = "initial",
	onComplete,
}: ContainerStartupDisplayProps) {
	const { data } = useLiveState(`/api/projects/${projectId}/live`);
	const completionScheduledRef = useRef(false);
	const [timedOut, setTimedOut] = useState(false);

	const status = data?.status ?? "starting";
	const previewReady = data?.previewReady ?? false;
	const opencodeReady = data?.opencodeReady ?? false;
	const setupError = data?.setupError ?? null;
	const message = data?.message;

	const isReady = status === "running" && previewReady && opencodeReady;
	const hasError = status === "error" || timedOut || setupError !== null;

	// Current step: both ready = step 2 done; preview ready = step 2; else step 1
	const currentStep = opencodeReady ? 2 : previewReady ? 2 : 1;

	// Timeout safety net — server already handles this but belt-and-suspenders
	useEffect(() => {
		const id = setTimeout(() => {
			if (!isReady) setTimedOut(true);
		}, 120_000);
		return () => clearTimeout(id);
	}, [isReady]);

	// Signal completion when ready
	useEffect(() => {
		if (!isReady || completionScheduledRef.current) return;
		completionScheduledRef.current = true;
		setTimeout(() => onComplete?.(), 500);
	}, [isReady, onComplete]);

	const displayMessage =
		message ??
		(opencodeReady
			? "Leveraging agent..."
			: previewReady
				? "Waiting for opencode..."
				: "Starting containers...");

	const heading =
		reason === "restart"
			? "Your environment was stopped. Restarting..."
			: "Starting your environment...";

	const errorMessage = timedOut
		? "Timeout waiting for containers to start"
		: (setupError ?? "Startup failed");

	return (
		<div className="flex-1 flex items-center justify-center px-4">
			<div className="flex flex-col items-center gap-8 w-full max-w-2xl">
				<div className="text-center space-y-6 w-full">
					<h2 className="text-2xl font-semibold">
						{hasError ? "Failed to Start Environment" : heading}
					</h2>

					{!hasError ? (
						<div className="space-y-4">
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

							<div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
								<div
									className="h-full bg-primary transition-all duration-300 ease-out"
									style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
								/>
							</div>

							<div className="flex items-center justify-center gap-2 min-h-6">
								<Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
								<p className="text-sm text-muted-foreground">
									{displayMessage}
								</p>
							</div>
						</div>
					) : (
						<div className="space-y-4">
							<div className="flex justify-center">
								<AlertTriangle className="h-12 w-12 text-status-error" />
							</div>
							<div className="p-4 bg-status-error-light border border-status-error rounded-lg text-left">
								<p className="text-sm text-status-error break-words">
									<span className="font-semibold">Error: </span>
									{errorMessage}
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
