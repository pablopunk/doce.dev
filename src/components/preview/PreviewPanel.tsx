import { actions } from "astro:actions";
import {
	AlertTriangle,
	Download,
	ExternalLink,
	FileCode2,
	Image,
	Loader2,
	MessageSquare,
	Monitor,
	RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AssetsTab } from "@/components/assets/AssetsTab";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { RestartAgentButton } from "@/components/chat/RestartAgentButton";
import { FilesTab } from "@/components/files/FilesTab";
import { DeployButton } from "@/components/preview/DeployButton";
import type { ProductionVersion } from "@/components/preview/DeploymentVersionHistory";
import { ProjectDiagnosticBanner } from "@/components/projects/ProjectDiagnosticBanner";
import { TerminalDocks } from "@/components/terminal/TerminalDocks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBaseUrlSetting } from "@/hooks/useBaseUrlSetting";
import { useLiveState } from "@/hooks/useLiveState";
import { mapPortUrlToPreferredHost } from "@/lib/base-url";
import { useProjectOptimisticState } from "@/stores/useProjectOptimisticState";

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
	onStatusChange?: (status: {
		status: string;
		previewReady: boolean;
		opencodeReady: boolean;
	}) => void;
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

type PreviewState =
	| "initializing"
	| "starting"
	| "ready"
	| "error"
	| "opencode-unresponsive";
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
	const { baseUrl } = useBaseUrlSetting();
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
	const [productionVersions, setProductionVersions] = useState<
		ProductionVersion[]
	>([]);
	const productionHistoryPollRef = useRef<ReturnType<
		typeof setInterval
	> | null>(null);

	// Live state from SSE — replaces all presence heartbeat polling
	const { data: liveData } = useLiveState(`/api/projects/${projectId}/live`);

	// Optimistic action state
	const markDeploying = useProjectOptimisticState((s) => s.markDeploying);
	const markStoppingProduction = useProjectOptimisticState(
		(s) => s.markStoppingProduction,
	);
	const markRollingBack = useProjectOptimisticState((s) => s.markRollingBack);
	const clearPending = useProjectOptimisticState((s) => s.clearPending);
	const pendingAction = useProjectOptimisticState(
		(s) => s.pendingByProjectId.get(projectId) ?? null,
	);

	// Opencode diagnostic from live state
	const opencodeDiagnostic = liveData?.opencodeDiagnostic ?? null;
	const setOpencodeDiagnostic = (_: null) => {
		// No-op — diagnostic is read-only from live state
		// This is kept for API compatibility with existing banner dismiss handlers
	};

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

	const mapPortUrlToPreferredBase = useCallback(
		(url: string | null) => {
			if (!url || typeof window === "undefined") {
				return url;
			}

			return mapPortUrlToPreferredHost(url, baseUrl, window.location.origin);
		},
		[baseUrl],
	);

	// React to live state changes
	useEffect(() => {
		if (!liveData) return;

		// Update preview URL with preferred host mapping
		const mappedUrl =
			typeof window !== "undefined"
				? (mapPortUrlToPreferredBase(liveData.previewUrl) ??
					liveData.previewUrl)
				: liveData.previewUrl;
		setPreviewUrl(mappedUrl);
		setMessage(liveData.message);
		onStatusChange?.(liveData);

		// State machine
		const { status, previewReady, opencodeReady } = liveData;
		if (previewReady && opencodeReady && status === "running") {
			setState("ready");
		} else if (status === "error" || status === "deleting") {
			setState("error");
		} else if (status === "running" && previewReady && !opencodeReady) {
			setState("opencode-unresponsive");
			setMessage("AI agent is not responding");
		} else if (status === "running" && !previewReady) {
			setState("starting");
			setMessage("Waiting for preview server...");
		} else {
			setState("starting");
		}
	}, [liveData, mapPortUrlToPreferredBase, onStatusChange]);

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

	// Auto-refresh preview iframe when state first becomes "ready".
	// The container health check can pass before Astro finishes its initial compile,
	// causing a 404 on first load. A couple of delayed refreshes covers this window.
	const prevStateRef = useRef<PreviewState>("initializing");
	useEffect(() => {
		const wasReady = prevStateRef.current === "ready";
		prevStateRef.current = state;
		if (state === "ready" && !wasReady && previewUrl) {
			const t1 = setTimeout(() => setIframeKey((k) => k + 1), 3_000);
			const t2 = setTimeout(() => setIframeKey((k) => k + 1), 8_000);
			return () => {
				clearTimeout(t1);
				clearTimeout(t2);
			};
		}
		return undefined;
	}, [state, previewUrl]);

	const handleRetry = () => {
		// The SSE stream will push the current state — nothing to do but reset UI
		setState("starting");
		setMessage("Retrying...");
	};

	// Production status comes from the live stream
	// Auto-clear optimistic state when SSE catches up
	useEffect(() => {
		if (!liveData || !pendingAction) return;
		const { action } = pendingAction;
		const ps = liveData.production.status;
		const pj = liveData.production.activeJobType;

		const shouldClear =
			(action === "deploying" &&
				(pj === "production.build" ||
					ps === "building" ||
					ps === "running" ||
					ps === "failed")) ||
			(action === "stopping-production" &&
				(ps === "stopped" || ps === "failed")) ||
			(action === "rolling-back" &&
				(pj === "production.build" ||
					ps === "building" ||
					ps === "running" ||
					ps === "failed"));

		if (shouldClear) clearPending(projectId);
	}, [liveData, pendingAction, projectId, clearPending]);

	// Derive production status: optimistic first, then live
	const liveProductionStatus: ProductionStatus | null = liveData
		? {
				status: liveData.production.status,
				url:
					typeof window !== "undefined"
						? (mapPortUrlToPreferredBase(liveData.production.url) ??
							liveData.production.url)
						: liveData.production.url,
				port: liveData.production.port,
				error: liveData.production.error,
				startedAt: liveData.production.startedAt,
				activeJob: liveData.production.activeJobType
					? {
							type: liveData.production.activeJobType,
							state: "running" as const,
						}
					: null,
			}
		: null;

	const productionStatus: ProductionStatus | null = (() => {
		if (!liveProductionStatus) return null;
		if (!pendingAction) return liveProductionStatus;

		switch (pendingAction.action) {
			case "deploying":
				return {
					...liveProductionStatus,
					status: "building" as const,
					activeJob: {
						type: "production.build" as const,
						state: "running" as const,
					},
				};
			case "stopping-production":
				return {
					...liveProductionStatus,
					status: "stopped" as const,
					activeJob: {
						type: "production.stop" as const,
						state: "running" as const,
					},
				};
			case "rolling-back":
				return {
					...liveProductionStatus,
					status: "building" as const,
					activeJob: {
						type: "production.build" as const,
						state: "running" as const,
					},
				};
			default:
				return liveProductionStatus;
		}
	})();

	const pollProductionHistory = useCallback(async () => {
		try {
			const { data, error } = await actions.projects.getProductionHistory({
				projectId,
			});
			if (!error) {
				const history = data as unknown as { versions: ProductionVersion[] };
				setProductionVersions(history.versions);
			}
		} catch {
			// Non-critical — versions will refresh next cycle
		}
	}, [projectId]);

	// Poll production history when deployed
	useEffect(() => {
		let mounted = true;

		const poll = async () => {
			if (!mounted) return;
			await pollProductionHistory();
			if (mounted) {
				productionHistoryPollRef.current = setTimeout(poll, 5_000);
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
		markDeploying(projectId);
		try {
			const { error } = await actions.projects.deploy({ projectId });
			if (error) {
				clearPending(projectId);
				toast.error(error.message);
			}
		} catch {
			clearPending(projectId);
			toast.error("Deploy failed");
		}
	};

	const handleStop = async () => {
		markStoppingProduction(projectId);
		try {
			const { error } = await actions.projects.stopProduction({ projectId });
			if (error) {
				clearPending(projectId);
				toast.error(error.message);
			}
		} catch {
			clearPending(projectId);
			toast.error("Failed to stop production");
		}
	};

	const handleExportPreviewSource = async () => {
		try {
			const response = await fetch(`/api/projects/${projectId}/export`);
			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				throw new Error(payload?.error ?? "Failed to export project source");
			}

			const blob = await response.blob();
			const downloadUrl = URL.createObjectURL(blob);
			const contentDisposition = response.headers.get("Content-Disposition");
			const fileNameMatch = contentDisposition?.match(/filename="([^"]+)"/);
			const fileName =
				fileNameMatch?.[1] ?? `${projectSlug ?? projectId}-preview-source.zip`;

			const link = document.createElement("a");
			link.href = downloadUrl;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(downloadUrl);

			toast.success("Preview source exported");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to export preview source",
			);
		}
	};

	const handleRollback = async (hash: string) => {
		markRollingBack(projectId, hash);
		try {
			const { error } = await actions.projects.rollback({
				projectId,
				toHash: hash,
			});
			if (error) {
				clearPending(projectId);
				throw new Error(error.message);
			}
			await pollProductionHistory();
		} catch (error) {
			clearPending(projectId);
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
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportPreviewSource}
					>
						<Download className="mr-1.5 h-4 w-4" />
						Export
					</Button>
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
							) : state === "opencode-unresponsive" ? (
								<div className="flex flex-col items-center gap-4 text-center p-4">
									<AlertTriangle className="h-8 w-8 text-status-warning" />
									<div>
										<p className="font-medium text-status-warning">
											AI Agent Not Responding
										</p>
										<p className="text-sm text-muted-foreground mt-1 max-w-md">
											{message ||
												"The AI agent appears to be stuck. Try restarting it."}
										</p>
									</div>
									<RestartAgentButton projectId={projectId} />
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
					{userMessageCount === 1 &&
						isStreaming &&
						state !== "opencode-unresponsive" && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
								<div className="flex flex-col items-center gap-4 text-muted-foreground">
									<Loader2 className="h-8 w-8 animate-spin" />
									<p>Building {projectSlug}...</p>
									<p className="text-sm opacity-70">This may take a minute</p>
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
