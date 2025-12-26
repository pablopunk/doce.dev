import { AlertTriangle, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssetsTab } from "@/components/assets/AssetsTab";
import { FilesTab } from "@/components/files/FilesTab";
import { DeployButton } from "@/components/preview/DeployButton";
import { TerminalDocks } from "@/components/terminal/TerminalDocks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface ProductionStatus {
	status: "queued" | "building" | "running" | "failed" | "stopped";
	url: string | null;
	port: number | null;
	error: string | null;
	startedAt: string | null;
}

interface PreviewPanelProps {
	projectId: string;
	onStatusChange?: (status: PresenceResponse) => void;
	fileToOpen?: string | null;
	onFileOpened?: () => void;
}

type PreviewState = "initializing" | "starting" | "ready" | "error";
type TabType = "preview" | "files" | "assets";

export function PreviewPanel({
	projectId,
	onStatusChange,
	fileToOpen,
	onFileOpened,
}: PreviewPanelProps) {
	const [state, setState] = useState<PreviewState>("initializing");
	const [message, setMessage] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [iframeKey, setIframeKey] = useState(0);
	const [activeTab, setActiveTab] = useState<TabType>(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			const tab = params.get("tab");
			if (tab === "files" || tab === "assets") {
				return tab as TabType;
			}
		}
		return "preview";
	});
	const [lastSelectedFile, setLastSelectedFile] = useState<string | null>(
		() => {
			if (typeof window !== "undefined") {
				return localStorage.getItem(`selectedFile_${projectId}`);
			}
			return null;
		},
	);
	const [isDeploying, setIsDeploying] = useState(false);
	const [isStopping, setIsStopping] = useState(false);
	const [productionStatus, setProductionStatus] =
		useState<ProductionStatus | null>(null);
	const viewerIdRef = useRef<string | null>(null);
	const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const productionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Generate viewer ID on mount
	useEffect(() => {
		let storedViewerId = sessionStorage.getItem(`viewer_${projectId}`);
		if (!storedViewerId) {
			storedViewerId = `viewer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			sessionStorage.setItem(`viewer_${projectId}`, storedViewerId);
		}
		viewerIdRef.current = storedViewerId;
	}, [projectId]);

	// Update URL when active tab changes
	useEffect(() => {
		if (typeof window === "undefined") return;

		const params = new URLSearchParams(window.location.search);
		const currentTab = params.get("tab");

		// Only update URL if tab has changed
		if (activeTab !== "preview" && currentTab !== activeTab) {
			params.set("tab", activeTab);
			window.history.replaceState(null, "", `?${params.toString()}`);
		} else if (activeTab === "preview" && currentTab !== null) {
			// Remove tab param if it's the default "preview"
			params.delete("tab");
			const newUrl = params.toString()
				? `?${params.toString()}`
				: window.location.pathname;
			window.history.replaceState(null, "", newUrl);
		}
	}, [activeTab]);

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

	// Handle file opening from chat panel
	useEffect(() => {
		if (fileToOpen) {
			setActiveTab("files");
			setLastSelectedFile(fileToOpen);
			onFileOpened?.();
		}
	}, [fileToOpen, onFileOpened]);

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

	const pollProductionStatus = useCallback(async () => {
		try {
			const response = await fetch(`/api/projects/${projectId}/production`);
			if (response.ok) {
				const status = await response.json();
				setProductionStatus(status);
			}
		} catch (error) {
			console.error("Failed to fetch production status:", error);
		}
	}, [projectId]);

	// Poll production status periodically
	useEffect(() => {
		// Start polling immediately
		pollProductionStatus();

		productionPollRef.current = setInterval(() => {
			pollProductionStatus();
		}, 2000);

		return () => {
			if (productionPollRef.current) {
				clearInterval(productionPollRef.current);
			}
		};
	}, [pollProductionStatus]);

	// Reset isStopping when production status changes from "building" to other states
	useEffect(() => {
		if (isStopping && productionStatus?.status !== "building") {
			setIsStopping(false);
		}
	}, [productionStatus?.status, isStopping]);

	const handleDeploy = async () => {
		try {
			setIsDeploying(true);
			const response = await fetch(`/api/projects/${projectId}/deploy`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (response.ok) {
				setIsDeploying(false);
			}
		} catch (error) {
			console.error("Deploy failed:", error);
			setIsDeploying(false);
		}
	};

	const handleStop = async () => {
		try {
			setIsStopping(true);
			const response = await fetch(
				`/api/projects/${projectId}/stop-production`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
				},
			);
			if (!response.ok) {
				console.error("Stop production failed:", response.statusText);
				setIsStopping(false);
			}
			// Keep isStopping true - it will be cleared when status updates to stopped
		} catch (error) {
			console.error("Stop production failed:", error);
			setIsStopping(false);
		}
	};

	return (
		<Tabs
			value={activeTab}
			onValueChange={(value) => setActiveTab(value as TabType)}
			className="flex flex-col h-full"
		>
			{/* Header with integrated tabs */}
			<div className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-muted/50">
				{/* Left: Tabs + Status */}
				<div className="flex items-center gap-4 flex-shrink-0">
					{/* Tab Navigation */}
					<TabsList className="p-1">
						<TabsTrigger value="preview">Preview</TabsTrigger>
						<TabsTrigger value="files">Files</TabsTrigger>
						<TabsTrigger value="assets">Assets</TabsTrigger>
					</TabsList>

					{/* Status indicators (only for preview tab) */}
					{activeTab === "preview" && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							{state === "starting" && (
								<>
									<Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
									<span>{message || "Starting..."}</span>
								</>
							)}
							{state === "error" && (
								<>
									<AlertTriangle className="h-3 w-3 text-red-500" />
									<span>{message || "Error"}</span>
								</>
							)}
						</div>
					)}
				</div>

				{/* Center: URL Bar with integrated buttons (only for preview tab when ready) */}
				{activeTab === "preview" && state === "ready" && previewUrl && (
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
							<a
								href={previewUrl ?? ""}
								target="_blank"
								rel="noopener noreferrer"
							>
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

				{/* Right: Action buttons */}
				<div className="flex items-center gap-2 flex-shrink-0">
					{activeTab === "preview" && state === "error" && (
						<Button variant="outline" size="sm" onClick={handleRetry}>
							Retry
						</Button>
					)}
					<DeployButton
						status={productionStatus?.status ?? null}
						error={productionStatus?.error ?? null}
						url={productionStatus?.url ?? null}
						isDeploying={isDeploying}
						isStopping={isStopping}
						previewReady={state === "ready"}
						onRetry={handleDeploy}
						onStop={handleStop}
					/>
				</div>
			</div>

			{/* Preview Tab Content */}
			<TabsContent
				value="preview"
				className="flex-1 flex flex-col overflow-hidden border-0 p-0 m-0"
			>
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

				{/* Terminal docks */}
				<TerminalDocks projectId={projectId} defaultOpen={false} />
			</TabsContent>

			{/* Files Tab Content */}
			<TabsContent
				value="files"
				className="flex-1 overflow-hidden border-0 p-0 m-0"
			>
				<FilesTab
					projectId={projectId}
					lastSelectedFile={lastSelectedFile}
					onFileSelect={(path) => {
						setLastSelectedFile(path);
						localStorage.setItem(`selectedFile_${projectId}`, path);
					}}
				/>
			</TabsContent>

			{/* Assets Tab Content */}
			<TabsContent
				value="assets"
				className="flex-1 overflow-hidden border-0 p-0 m-0"
			>
				<AssetsTab
					projectId={projectId}
					{...(previewUrl ? { previewUrl } : {})}
				/>
			</TabsContent>
		</Tabs>
	);
}
