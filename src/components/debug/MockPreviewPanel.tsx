import { AlertTriangle, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type MockPreviewState = "initializing" | "starting" | "ready" | "error";

interface MockPreviewPanelProps {
	state?: MockPreviewState;
	message?: string | null;
	previewUrl?: string | null;
	onStateChange?: (state: MockPreviewState) => void;
}

export function MockPreviewPanel({
	state: initialState = "ready",
	message: initialMessage = null,
	previewUrl: initialPreviewUrl = "https://example.com/preview",
	onStateChange,
}: MockPreviewPanelProps) {
	const [state, setState] = useState<MockPreviewState>(initialState);
	const [message, setMessage] = useState<string | null>(initialMessage);
	const [previewUrl] = useState<string | null>(initialPreviewUrl);

	const handleRefresh = () => {
		// Mock refresh - in real app this would reload iframe
	};

	const handleRetry = () => {
		setState("starting");
		setMessage("Retrying...");
		setTimeout(() => {
			setState("ready");
			setMessage(null);
		}, 1500);
	};

	const handleStateChange = (newState: MockPreviewState) => {
		setState(newState);
		onStateChange?.(newState);
	};

	// State display message
	const getStateMessage = () => {
		switch (state) {
			case "initializing":
				return message || "Initializing...";
			case "starting":
				return message || "Starting preview server...";
			case "error":
				return message || "Failed to start preview";
			case "ready":
				return "Ready";
			default:
				return "";
		}
	};

	return (
		<div className="flex flex-col h-full w-full min-w-0">
			{/* Header */}
			<div className="flex items-center justify-between gap-3 px-3 md:px-4 py-2 border-b bg-muted/50">
				{/* Left: State indicator */}
				<div className="flex items-center gap-3 flex-shrink min-w-0">
					<div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
						{state === "starting" && (
							<>
								<Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
								<span className="truncate">{getStateMessage()}</span>
							</>
						)}
						{state === "error" && (
							<>
								<AlertTriangle className="h-3 w-3 text-status-error" />
								<span className="truncate">{getStateMessage()}</span>
							</>
						)}
						{state === "ready" && (
							<span className="text-green-600">{getStateMessage()}</span>
						)}
					</div>
				</div>

				{/* Center: URL Bar (when ready) */}
				{state === "ready" && previewUrl && (
					<div className="flex-1 relative flex items-center min-w-0 px-3 py-1 border border-border rounded bg-transparent">
						<input
							type="text"
							value={
								previewUrl.length > 50
									? `${previewUrl.slice(0, 50)}...`
									: previewUrl
							}
							disabled
							title={previewUrl}
							className="flex-1 min-w-0 bg-transparent text-xs text-foreground cursor-default opacity-60 text-center border-0 outline-none"
							readOnly
						/>
						<div className="flex items-center gap-0 flex-shrink-0 ml-2">
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 hover:bg-accent"
								onClick={handleRefresh}
							>
								<RefreshCw className="h-3.5 w-3.5" />
							</Button>
							<a href={previewUrl} target="_blank" rel="noopener noreferrer">
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 hover:bg-accent"
								>
									<ExternalLink className="h-3.5 w-3.5" />
								</Button>
							</a>
						</div>
					</div>
				)}

				{/* Right: Actions */}
				<div className="flex items-center gap-2 flex-shrink-0">
					{state === "error" && (
						<Button variant="outline" size="sm" onClick={handleRetry}>
							Retry
						</Button>
					)}
					{/* State toggler for debugging */}
					<select
						value={state}
						onChange={(e) =>
							handleStateChange(e.target.value as MockPreviewState)
						}
						className="text-xs border rounded px-2 py-1 bg-background"
					>
						<option value="initializing">Initializing</option>
						<option value="starting">Starting</option>
						<option value="ready">Ready</option>
						<option value="error">Error</option>
					</select>
				</div>
			</div>

			{/* Preview Content */}
			<div className="flex-1 relative bg-background">
				{state === "ready" && previewUrl ? (
					<div className="absolute inset-0 flex items-center justify-center bg-muted/30">
						<div className="text-center space-y-4">
							<div className="w-16 h-16 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
								<span className="text-2xl">🖥️</span>
							</div>
							<div>
								<p className="text-sm font-medium">Preview Ready</p>
								<p className="text-xs text-muted-foreground mt-1">
									{previewUrl}
								</p>
							</div>
							<p className="text-xs text-muted-foreground max-w-xs">
								This is a mock preview. In production, an iframe would load here
								showing the actual running application.
							</p>
						</div>
					</div>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						{state === "initializing" || state === "starting" ? (
							<div className="flex flex-col items-center gap-4 text-muted-foreground">
								<Loader2 className="h-8 w-8 animate-spin" />
								<p>{getStateMessage()}</p>
							</div>
						) : state === "error" ? (
							<div className="flex flex-col items-center gap-4 text-center p-4">
								<AlertTriangle className="h-8 w-8 text-status-error" />
								<div>
									<p className="font-medium text-status-error">
										Failed to start
									</p>
									<p className="text-sm text-muted-foreground mt-1 max-w-md">
										{getStateMessage()}
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
		</div>
	);
}
