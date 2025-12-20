import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { TerminalDock } from "@/components/terminal/TerminalDock";

interface PresenceResponse {
	projectId: string;
	status: string;
	viewerCount: number;
	previewUrl: string;
	previewReady: boolean;
	opencodeReady: boolean;
	message: string | null;
	nextPollMs: number;
	initialPromptCompleted?: boolean;
}

interface PreviewPanelProps {
	projectId: string;
	onStatusChange?: (status: PresenceResponse) => void;
}

type PreviewState = "initializing" | "starting" | "ready" | "error";

export function PreviewPanel({ projectId, onStatusChange }: PreviewPanelProps) {
	const [state, setState] = useState<PreviewState>("initializing");
	const [message, setMessage] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [iframeKey, setIframeKey] = useState(0);
	const viewerIdRef = useRef<string | null>(null);
	const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Generate viewer ID on mount
	useEffect(() => {
		let storedViewerId = sessionStorage.getItem(`viewer_${projectId}`);
		if (!storedViewerId) {
			storedViewerId = `viewer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			sessionStorage.setItem(`viewer_${projectId}`, storedViewerId);
		}
		viewerIdRef.current = storedViewerId;
	}, [projectId]);

	const sendHeartbeat =
		useCallback(async (): Promise<PresenceResponse | null> => {
			if (!viewerIdRef.current) return null;

			try {
				const response = await fetch(`/api/projects/${projectId}/presence`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ viewerId: viewerIdRef.current }),
				});

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				return await response.json();
			} catch (error) {
				console.error("Heartbeat failed:", error);
				return null;
			}
		}, [projectId]);

	const handlePresenceResponse = useCallback(
		(data: PresenceResponse) => {
			setPreviewUrl(data.previewUrl);
			setMessage(data.message);
			onStatusChange?.(data);

			// State machine
			if (data.previewReady && data.status === "running") {
				setState("ready");
			} else if (data.status === "error" || data.status === "deleting") {
				setState("error");
			} else if (
				data.status === "starting" ||
				data.status === "created" ||
				data.status === "stopped"
			) {
				setState("starting");
			} else if (data.status === "running" && !data.previewReady) {
				// Container is running but preview health check hasn't passed yet
				setState("starting");
				setMessage("Waiting for preview server...");
			}

			return data;
		},
		[onStatusChange],
	);

	// Initial heartbeat and polling
	useEffect(() => {
		let mounted = true;

		const poll = async () => {
			if (!mounted) return;

			const data = await sendHeartbeat();
			if (!data || !mounted) return;

			const result = handlePresenceResponse(data);

			// Schedule next poll based on state
			if (result.status === "starting" || result.status === "created") {
				pollTimeoutRef.current = setTimeout(poll, result.nextPollMs);
			} else if (result.status === "running" && !result.previewReady) {
				// Keep polling until preview is ready
				pollTimeoutRef.current = setTimeout(poll, 2000);
			}
		};

		// Start polling after a short delay to ensure viewerId is set
		const initTimeout = setTimeout(poll, 100);

		return () => {
			mounted = false;
			clearTimeout(initTimeout);
			if (pollTimeoutRef.current) {
				clearTimeout(pollTimeoutRef.current);
			}
		};
	}, [sendHeartbeat, handlePresenceResponse]);

	// Regular heartbeat (every 15s)
	useEffect(() => {
		heartbeatRef.current = setInterval(async () => {
			const data = await sendHeartbeat();
			if (data) {
				handlePresenceResponse(data);
			}
		}, 15_000);

		return () => {
			if (heartbeatRef.current) {
				clearInterval(heartbeatRef.current);
			}
		};
	}, [sendHeartbeat, handlePresenceResponse]);

	const handleRefresh = () => {
		setIframeKey((k) => k + 1);
	};

	const handleRetry = async () => {
		setState("starting");
		setMessage("Retrying...");
		const data = await sendHeartbeat();
		if (data) {
			handlePresenceResponse(data);
		}
	};

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
				<div className="flex items-center gap-2 text-sm">
					{state === "starting" && (
						<Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
					)}
					{state === "ready" && (
						<div className="h-2 w-2 rounded-full bg-green-500" />
					)}
					{state === "error" && (
						<AlertTriangle className="h-4 w-4 text-red-500" />
					)}
					<span className="text-muted-foreground">
						{state === "initializing" && "Initializing..."}
						{state === "starting" && (message || "Starting preview...")}
						{state === "ready" && "Preview"}
						{state === "error" && (message || "Error")}
					</span>
				</div>
				<div className="flex items-center gap-1">
					{state === "ready" && (
						<>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={handleRefresh}
							>
								<RefreshCw className="h-4 w-4" />
							</Button>
							<a
								href={previewUrl ?? ""}
								target="_blank"
								rel="noopener noreferrer"
							>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<ExternalLink className="h-4 w-4" />
								</Button>
							</a>
						</>
					)}
					{state === "error" && (
						<Button variant="outline" size="sm" onClick={handleRetry}>
							Retry
						</Button>
					)}
				</div>
			</div>

			{/* Content and Terminal */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Preview iframe */}
				<div className="flex-1 relative bg-background">
					{state === "ready" && previewUrl ? (
						<iframe
							key={iframeKey}
							src={previewUrl}
							className="absolute inset-0 w-full h-full border-0"
							title="Preview"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center">
							{state === "initializing" || state === "starting" ? (
								<div className="flex flex-col items-center gap-4 text-muted-foreground">
									<Loader2 className="h-8 w-8 animate-spin" />
									<p>{message || "Starting preview server..."}</p>
								</div>
							) : state === "error" ? (
								<div className="flex flex-col items-center gap-4 text-center p-4">
									<AlertTriangle className="h-8 w-8 text-red-500" />
									<div>
										<p className="font-medium text-red-500">Failed to start</p>
										<p className="text-sm text-muted-foreground mt-1 max-w-md">
											{message || "Check the terminal for details."}
										</p>
									</div>
									<Button variant="outline" onClick={handleRetry}>
										Try Again
									</Button>
								</div>
							) : null}
						</div>
					)}
				</div>

				{/* Terminal dock */}
				<TerminalDock projectId={projectId} defaultOpen={false} />
			</div>
		</div>
	);
}
