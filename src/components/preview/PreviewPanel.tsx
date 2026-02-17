import { actions } from "astro:actions";
import {
	AlertTriangle,
	ExternalLink,
	FileCode2,
	Image,
	Loader2,
	MessageSquare,
	Monitor,
	RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssetsTab } from "@/components/assets/AssetsTab";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { FilesTab } from "@/components/files/FilesTab";
import { DeployButton } from "@/components/preview/DeployButton";
import type { ProductionVersion } from "@/components/preview/DeploymentVersionHistory";
import { ProjectDiagnosticBanner } from "@/components/projects/ProjectDiagnosticBanner";
import { TerminalDocks } from "@/components/terminal/TerminalDocks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

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
	opencodeDiagnostic?: {
		category: string | null;
		message: string | null;
		remediation: string[] | null;
	} | null;
}

interface ProductionStatus {
	status: "queued" | "building" | "running" | "failed" | "stopped";
	url: string | null;
	port: number | null;
	error: string | null;
	startedAt: string | null;
	activeJob: {
		type:
			| "production.build"
			| "production.start"
			| "production.waitReady"
			| "production.stop";
		state: "queued" | "running";
	} | null;
}

interface PreviewPanelProps {
	projectId: string;
	projectSlug?: string;
	onStatusChange?: (status: PresenceResponse) => void;
	fileToOpen?: string | null;
	onFileOpened?: () => void;
	initialResponseProcessing?: boolean;
	userMessageCount?: number;
	isStreaming?: boolean;
	forceTab?: TabType;
	models?: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
	}>;
	onOpenFile?: (filePath: string) => void;
	onStreamingStateChange?: (
		userMessageCount: number,
		isStreaming: boolean,
	) => void;
}

type PreviewState = "initializing" | "starting" | "ready" | "error";
type TabType = "chat" | "preview" | "files" | "assets";

export function PreviewPanel({
	projectId,
	projectSlug,
	onStatusChange,
	fileToOpen,
	onFileOpened,
	userMessageCount = 0,
	isStreaming = false,
	forceTab,
	models = [],
	onOpenFile,
	onStreamingStateChange,
}: PreviewPanelProps) {
	const isMobile = useIsMobile();
	const [state, setState] = useState<PreviewState>("initializing");
	const [message, setMessage] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [iframeKey, setIframeKey] = useState(0);
	const [activeTab, setActiveTab] = useState<TabType>(() => {
		if (forceTab) {
			return forceTab;
		}
		if (isMobile) {
			return "chat";
		}
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
	const [productionStatus, setProductionStatus] =
		useState<ProductionStatus | null>(null);
	const [productionVersions, setProductionVersions] = useState<
		ProductionVersion[]
	>([]);
	const [opencodeDiagnostic, setOpencodeDiagnostic] = useState<{
		category: string | null;
		message: string | null;
	} | null>(null);
	const viewerIdRef = useRef<string | null>(null);
	const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const productionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const productionHistoryPollRef = useRef<ReturnType<
		typeof setInterval
	> | null>(null);

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
				const { data, error } = await actions.projects.presence({
					projectId,
					viewerId: viewerIdRef.current,
				});

				if (error) {
					throw new Error(error.message);
				}

				return data as unknown as PresenceResponse;
			} catch (error) {
				console.error("Heartbeat failed:", error);
				return null;
			}
		}, [projectId]);

	const mapPortUrlToCurrentHost = useCallback((url: string | null) => {
		if (!url || typeof window === "undefined") {
			return url;
		}

		const originWithoutPort = window.location.origin.replace(/:\d+$/, "");

		try {
			const parsed = new URL(url);
			if (!parsed.port) {
				return url;
			}

			return `${originWithoutPort}:${parsed.port}${parsed.pathname}${parsed.search}${parsed.hash}`;
		} catch {
			const match = url.match(/:(\d+)(?:\/|$)/);
			if (!match) {
				return url;
			}

			return `${originWithoutPort}:${match[1]}`;
		}
	}, []);

	const handlePresenceResponse = useCallback(
		(data: PresenceResponse) => {
			// Construct preview URL from current window location origin + port from backend response
			// This ensures the preview works in both local and remote deployments
			if (typeof window !== "undefined" && data.previewUrl) {
				// Extract port from the backend's previewUrl (e.g., "http://127.0.0.1:42949" -> "42949")
				const match = data.previewUrl.match(/:(\d+)$/);
				const port = match ? match[1] : "4321";
				const frontendPreviewUrl = `${window.location.origin.replace(/:\d+$/, "")}:${port}`;
				setPreviewUrl(frontendPreviewUrl);
			} else {
				setPreviewUrl(data.previewUrl);
			}

			setMessage(data.message);
			setOpencodeDiagnostic(data.opencodeDiagnostic ?? null);
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

	const pollProductionStatus =
		useCallback(async (): Promise<ProductionStatus | null> => {
			try {
				const { data, error } = await actions.projects.getProductionStatus({
					projectId,
				});
				if (!error) {
					const status = data as unknown as ProductionStatus;
					const frontendUrl = mapPortUrlToCurrentHost(status.url);
					const normalizedStatus = {
						...status,
						url: frontendUrl,
					};

					setProductionStatus(normalizedStatus);
					return normalizedStatus;
				}
			} catch (error) {
				console.error("Failed to fetch production status:", error);
			}
			return null;
		}, [projectId, mapPortUrlToCurrentHost]);

	const pollProductionHistory = useCallback(async () => {
		try {
			const { data, error } = await actions.projects.getProductionHistory({
				projectId,
			});
			if (!error) {
				const history = data as unknown as { versions: ProductionVersion[] };
				setProductionVersions(history.versions);
			}
		} catch (error) {
			console.error("Failed to fetch production history:", error);
		}
	}, [projectId]);

	// Adaptive polling for production status
	useEffect(() => {
		let mounted = true;

		const poll = async () => {
			if (!mounted) return;

			// Fetch fresh status and use it directly (not stale state)
			const freshStatus = await pollProductionStatus();

			if (!mounted) return;

			// Determine polling interval based on FRESH status (not state)
			let pollInterval = 10_000; // Default: 10s when stable
			if (freshStatus?.activeJob) {
				// Job in progress - poll aggressively
				pollInterval = 1_000; // 1s
			} else if (
				freshStatus?.status === "running" ||
				freshStatus?.status === "building" ||
				freshStatus?.status === "queued"
			) {
				// Transition state - poll moderately
				pollInterval = 2_000; // 2s
			}
			// If stopped/failed and no active job, use default (10s or no polling)

			productionPollRef.current = setTimeout(poll, pollInterval);
		};

		// Start polling immediately
		poll();

		return () => {
			mounted = false;
			if (productionPollRef.current) {
				clearTimeout(productionPollRef.current);
			}
		};
	}, [pollProductionStatus]);

	// Poll production history when deployed
	useEffect(() => {
		let mounted = true;

		const poll = async () => {
			if (!mounted) return;
			await pollProductionHistory();
			if (mounted) {
				productionHistoryPollRef.current = setTimeout(poll, 5_000); // Poll every 5s
			}
		};

		if (productionStatus?.status === "running") {
			poll();
		}

		return () => {
			mounted = false;
			if (productionHistoryPollRef.current) {
				clearTimeout(productionHistoryPollRef.current);
			}
		};
	}, [productionStatus?.status, pollProductionHistory]);

	const handleDeploy = async () => {
		try {
			const { error } = await actions.projects.deploy({ projectId });
			if (error) {
				console.error("Deploy failed:", error.message);
			}
			// Polling will pick up the state change
			await pollProductionStatus();
		} catch (error) {
			console.error("Deploy failed:", error);
		}
	};

	const handleStop = async () => {
		try {
			const { error } = await actions.projects.stopProduction({ projectId });
			if (error) {
				console.error("Stop production failed:", error.message);
			}
			// Polling will pick up the state change
			await pollProductionStatus();
		} catch (error) {
			console.error("Stop production failed:", error);
		}
	};

	const handleRollback = async (hash: string) => {
		try {
			const { error } = await actions.projects.rollback({
				projectId,
				toHash: hash,
			});
			if (error) {
				console.error("Rollback failed:", error.message);
				throw new Error(error.message);
			}
			// Polling will pick up the state change
			await pollProductionStatus();
			await pollProductionHistory();
		} catch (error) {
			console.error("Rollback failed:", error);
			throw error;
		}
	};

	return (
		<Tabs
			value={activeTab}
			onValueChange={(value) => setActiveTab(value as TabType)}
			className="flex flex-col h-full w-full min-w-0 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0"
		>
			{/* OpenCode Diagnostic Banner */}
			{opencodeDiagnostic && (
				<ProjectDiagnosticBanner
					category={opencodeDiagnostic.category}
					message={opencodeDiagnostic.message}
				/>
			)}

			{/* Header with integrated tabs */}
			<div className="flex items-center justify-between gap-3 px-3 md:px-4 py-2 border-b bg-muted/50">
				{/* Left: Tabs + Status */}
				<div className="flex items-center gap-3 flex-shrink min-w-0">
					{/* Tab Navigation */}
					{!isMobile && (
						<TabsList className="p-1">
							<TabsTrigger value="preview">Preview</TabsTrigger>
							<TabsTrigger value="files">Files</TabsTrigger>
							<TabsTrigger value="assets">Assets</TabsTrigger>
						</TabsList>
					)}

					{/* Status indicators (only for preview tab) */}
					{activeTab === "preview" && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
							{state === "starting" && (
								<>
									<Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
									<span className="truncate">{message || "Starting..."}</span>
								</>
							)}
							{state === "error" && (
								<>
									<AlertTriangle className="h-3 w-3 text-status-error" />
									<span className="truncate">{message || "Error"}</span>
								</>
							)}
						</div>
					)}
				</div>

				{/* Center: URL Bar with integrated buttons (only for preview tab when ready) */}
				{!isMobile &&
					activeTab === "preview" &&
					state === "ready" &&
					previewUrl && (
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
					{isMobile &&
						activeTab === "preview" &&
						state === "ready" &&
						previewUrl && (
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
					{activeTab === "preview" && state === "error" && (
						<Button variant="outline" size="sm" onClick={handleRetry}>
							Retry
						</Button>
					)}
					{productionStatus && (
						<DeployButton
							state={{
								status: productionStatus.status,
								url: productionStatus.url,
								error: productionStatus.error,
								activeJob: productionStatus.activeJob,
							}}
							previewReady={state === "ready"}
							onDeploy={handleDeploy}
							onStop={handleStop}
							versions={productionVersions}
							onRollback={handleRollback}
						/>
					)}
				</div>
			</div>

			{opencodeDiagnostic && (
				<ProjectDiagnosticBanner
					category={opencodeDiagnostic.category}
					message={opencodeDiagnostic.message}
					onDismiss={() => setOpencodeDiagnostic(null)}
				/>
			)}

			{isMobile && (
				<TabsContent
					value="chat"
					className="flex-1 flex flex-col w-full min-w-0 overflow-hidden border-0 p-0 m-0"
				>
					<ChatPanel
						projectId={projectId}
						models={models}
						onOpenFile={(path) => {
							onOpenFile?.(path);
							setActiveTab("files");
						}}
						onStreamingStateChange={(count, streaming) => {
							onStreamingStateChange?.(count, streaming);
						}}
					/>
				</TabsContent>
			)}

			{/* Preview Tab Content */}
			<TabsContent
				value="preview"
				className="flex-1 flex flex-col w-full min-w-0 overflow-hidden border-0 p-0 m-0"
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
									<AlertTriangle className="h-8 w-8 text-status-error" />
									<div>
										<p className="font-medium text-status-error">
											Failed to start
										</p>
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

					{/* Overlay when initial prompt is processing (only one user message and streaming) */}
					{userMessageCount === 1 && isStreaming && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
							<div className="flex flex-col items-center gap-4 text-muted-foreground">
								<Loader2 className="h-8 w-8 animate-spin" />
								<p>Building {projectSlug}...</p>
							</div>
						</div>
					)}
				</div>

				{/* Terminal docks */}
				<TerminalDocks projectId={projectId} defaultOpen={false} />
			</TabsContent>

			{/* Files Tab Content */}
			<TabsContent
				value="files"
				className="flex-1 flex flex-col w-full min-w-0 overflow-hidden border-0 p-0 m-0"
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
				className="flex-1 flex flex-col w-full min-w-0 overflow-hidden border-0 p-0 m-0"
			>
				<AssetsTab
					projectId={projectId}
					{...(previewUrl ? { previewUrl } : {})}
				/>
			</TabsContent>

			{isMobile && (
				<div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
					<TabsList className="grid h-[calc(4.25rem+env(safe-area-inset-bottom))] w-full grid-cols-4 rounded-none bg-transparent px-2 pb-[env(safe-area-inset-bottom)] pt-1">
						<TabsTrigger
							value="chat"
							className="h-14 flex-col gap-1 text-[11px]"
						>
							<MessageSquare className="h-4 w-4" />
							<span>Chat</span>
						</TabsTrigger>
						<TabsTrigger
							value="preview"
							className="h-14 flex-col gap-1 text-[11px]"
						>
							<Monitor className="h-4 w-4" />
							<span>Preview</span>
						</TabsTrigger>
						<TabsTrigger
							value="files"
							className="h-14 flex-col gap-1 text-[11px]"
						>
							<FileCode2 className="h-4 w-4" />
							<span>Files</span>
						</TabsTrigger>
						<TabsTrigger
							value="assets"
							className="h-14 flex-col gap-1 text-[11px]"
						>
							<Image className="h-4 w-4" />
							<span>Assets</span>
						</TabsTrigger>
					</TabsList>
				</div>
			)}
		</Tabs>
	);
}
