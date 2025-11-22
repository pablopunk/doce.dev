"use client";

import { actions } from "astro:actions";
import Editor from "@monaco-editor/react";
import {
	ChevronLeft,
	ChevronRight,
	Code,
	Eye,
	Loader2,
	Plus,
	RefreshCw,
	Rocket,
	Settings,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import AIBlob from "@/components/ui/ai-blob";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectLifecycle } from "@/domain/projects/hooks/use-project-lifecycle";
import { TerminalDock } from "@/domain/system/components/terminal-dock";
import type { PreviewStatus } from "@/lib/preview-status-bus";

const projectFetcher = async (_key: string, id: string) => {
	const { data, error } = await actions.projects.getProject({ id });
	if (error) throw error;
	return data;
};

const envFetcher = async (_key: string, id: string) => {
	const { data, error } = await actions.projects.getEnv({ id });
	if (error) throw error;
	return data;
};

const filesFetcher = async (_key: string, id: string) => {
	const { data, error } = await actions.projects.getFiles({ id });
	if (error) throw error;
	return data;
};

const fileContentFetcher = async (_key: string, id: string, path: string) => {
	const { data, error } = await actions.projects.getFileContent({ id, path });
	if (error) throw error;
	return data;
};

function getLanguageFromPath(path: string): string {
	if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
	if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
	if (path.endsWith(".css")) return "css";
	if (path.endsWith(".md") || path.endsWith(".mdx")) return "markdown";
	if (path.endsWith(".astro")) return "html";
	if (path.endsWith(".json")) return "json";
	return "plaintext";
}

// Global refresh function that can be called from other components
let globalRefreshFn: (() => void) | null = null;
// Track if initial generation is in progress (per project)
const initialGenerationInProgress = new Map<string, boolean>();

export function setInitialGenerationInProgress(
	projectId: string,
	inProgress: boolean,
) {
	initialGenerationInProgress.set(projectId, inProgress);
}

export function refreshCodePreview() {
	if (globalRefreshFn) {
		globalRefreshFn();
	}
}

export function CodePreview({ projectId }: { projectId: string }) {
	// Track project lifecycle for container management
	useProjectLifecycle(projectId);

	const [activeTab, setActiveTab] = useState<"preview" | "code" | "env">(
		"preview",
	);
	const [envVars, setEnvVars] = useState<Record<string, string>>({});
	const [isSavingEnv, setIsSavingEnv] = useState(false);
	const [isCreatingPreview, setIsCreatingPreview] = useState(false);
	const [hasAutoStarted, setHasAutoStarted] = useState(false);
	const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
	const [isIframeLoading, setIsIframeLoading] = useState(true);
	const [iframeError, setIframeError] = useState(false);
	const [previewReady, setPreviewReady] = useState(false);
	const [iframeKey, setIframeKey] = useState(0);
	const [isRestarting, setIsRestarting] = useState(false);
	const [isFirstGenerationComplete, setIsFirstGenerationComplete] =
		useState(false);
	const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("unknown");
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [logDerivedPreviewUrl, setLogDerivedPreviewUrl] = useState<
		string | null
	>(null);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const { data: project, mutate } = useSWR(
		["project", projectId],
		([_key, id]) => projectFetcher(_key, id),
		{
			refreshInterval: 0, // Disable auto-refresh to prevent input clearing
			revalidateOnFocus: false,
		},
	);

	const { data: envData } = useSWR(
		["env", projectId],
		([_key, id]) => envFetcher(_key, id),
		{
			refreshInterval: 0, // Disable auto-refresh
			revalidateOnFocus: false,
		},
	);

	const { data: filesData, isLoading: isFilesLoading } = useSWR(
		["files", projectId],
		([_key, id]) => filesFetcher(_key, id),
		{
			refreshInterval: 0,
			revalidateOnFocus: false,
		},
	);

	const { data: fileContentData, isLoading: isFileContentLoading } = useSWR(
		selectedFile ? ["file", projectId, selectedFile] : null,
		(key) => {
			if (!key) return null;
			const [_key, id, path] = key as [string, string, string];
			return fileContentFetcher(_key, id, path);
		},
		{
			refreshInterval: 0,
			revalidateOnFocus: false,
		},
	);

	const fileEntries = useMemo(
		() =>
			filesData?.files?.map((path: string) => {
				const withoutSrc = path.replace(/^src\//, "");
				const segments = withoutSrc.split("/");
				return {
					path,
					name: segments[segments.length - 1],
					displayPath: withoutSrc,
					depth: segments.length - 1,
				};
			}) ?? [],
		[filesData],
	);

	useEffect(() => {
		if (!filesData?.files || filesData.files.length === 0) return;
		if (selectedFile && filesData.files.includes(selectedFile)) return;

		const preferred = filesData.files.find(
			(path: string) => path === "src/pages/index.astro",
		);
		setSelectedFile(preferred ?? filesData.files[0]);
	}, [filesData, selectedFile]);

	// Register global refresh function
	useEffect(() => {
		globalRefreshFn = mutate;
		return () => {
			globalRefreshFn = null;
		};
	}, [mutate]);

	// Load env vars when data changes
	useEffect(() => {
		if (envData?.env) {
			setEnvVars(envData.env);
		}
	}, [envData]);

	// Track when first generation is complete based on the global state
	useEffect(() => {
		const inProgress = initialGenerationInProgress.get(projectId);
		if (inProgress === false) {
			setIsFirstGenerationComplete(true);
		} else if (inProgress === true) {
			setIsFirstGenerationComplete(false);
		}
	}, [projectId]);

	// Poll the global state to detect when generation completes
	useEffect(() => {
		const interval = setInterval(() => {
			const inProgress = initialGenerationInProgress.get(projectId);
			if (inProgress === false) {
				setIsFirstGenerationComplete(true);
			} else if (inProgress === true) {
				setIsFirstGenerationComplete(false);
			}
		}, 100);

		return () => clearInterval(interval);
	}, [projectId]);

	// Handler to create/start preview
	const handleCreatePreview = useCallback(async () => {
		setIsCreatingPreview(true);
		try {
			await actions.projects.createPreview({ id: projectId });
			mutate();
		} catch (error) {
			console.error("Failed to create preview:", error);
		} finally {
			setIsCreatingPreview(false);
		}
	}, [projectId, mutate]);

	// Subscribe to server-side preview status via SSE
	useEffect(() => {
		let eventSource: EventSource | null = null;
		if (!projectId) return;

		try {
			const url = `/api/projects/${projectId}/status`;
			const es = new EventSource(url);
			eventSource = es;

			es.onmessage = (event) => {
				try {
					const payload = JSON.parse(event.data) as {
						status?: PreviewStatus;
						previewUrl?: string | null;
						error?: string;
					};
					if (payload.status) {
						setPreviewStatus(payload.status);
					}
				} catch (e) {
					console.error("Failed to parse preview status event:", e);
				}
			};

			es.onerror = () => {
				// keep UI in existing state; browser will handle reconnects
			};
		} catch (e) {
			console.error("Failed to open preview status stream:", e);
		}

		return () => {
			if (eventSource) {
				try {
					eventSource.close();
				} catch (e) {
					// ignore
				}
			}
		};
	}, [projectId]);

	// Auto-start preview on first visit when not created yet
	useEffect(() => {
		if (hasAutoStarted || isCreatingPreview) return;
		// Only auto-start after the template has been copied
		if (!project || project.bootstrapped !== "true") return;
		// And only after the first generation has finished
		if (!isFirstGenerationComplete) return;

		if (previewStatus === "not-created" || previewStatus === "unknown") {
			setHasAutoStarted(true);
			void handleCreatePreview();
		}
	}, [
		previewStatus,
		project,
		hasAutoStarted,
		isCreatingPreview,
		isFirstGenerationComplete,
		handleCreatePreview,
	]);

	// When server reports a running preview but project data
	// doesn't yet have a previewUrl (eg. after dev server restart),
	// force a project refetch so UI can attach to the URL.
	useEffect(() => {
		if (previewStatus === "running" && !project?.previewUrl) {
			mutate();
		}
	}, [previewStatus, project?.previewUrl, mutate]);

	// Reset loading state when preview URL changes and poll for readiness
	useEffect(() => {
		const effectiveUrl = project?.previewUrl ?? logDerivedPreviewUrl;

		// If we don't yet have a preview URL from either the project
		// record or the logs, keep showing the AI/loading states.
		if (!effectiveUrl) {
			setPreviewReady(false);
			setIsIframeLoading(true);
			setIframeError(false);
			return;
		}

		// Once a preview URL exists and the server is up, mark the
		// iframe as ready. Any transient network errors will be
		// handled by the iframe onError handler.
		setIsIframeLoading(false);
		setIframeError(false);
		setPreviewReady(true);
		console.log(`Preview server ready at ${effectiveUrl}`);
	}, [project?.previewUrl, logDerivedPreviewUrl]);

	const handleBack = useCallback(() => {
		if (!iframeRef.current) return;
		try {
			iframeRef.current.contentWindow?.history.back();
		} catch (error) {
			console.error("Failed to navigate preview back:", error);
		}
	}, []);

	const handleForward = useCallback(() => {
		if (!iframeRef.current) return;
		try {
			iframeRef.current.contentWindow?.history.forward();
		} catch (error) {
			console.error("Failed to navigate preview forward:", error);
		}
	}, []);

	const handleDeploy = async () => {
		await actions.projects.deployProject({ id: projectId });
		mutate();
	};

	const handleRefresh = async () => {
		setIsRestarting(true);
		setPreviewReady(false);
		setIsIframeLoading(true);
		setIsTerminalExpanded(true);
		try {
			await actions.projects.restartPreview({ id: projectId });
			setIframeKey((prev) => prev + 1);
			await mutate();
		} catch (error) {
			console.error("Failed to restart preview:", error);
			setIframeError(true);
		} finally {
			setIsRestarting(false);
		}
	};

	const handleSaveEnv = async () => {
		setIsSavingEnv(true);
		try {
			await actions.projects.setEnv({
				id: projectId,
				env: envVars,
			});
			// Restart preview to pick up new env vars
			if (project?.previewUrl) {
				await handleCreatePreview();
			}
		} catch (error) {
			console.error("Failed to save env vars:", error);
		} finally {
			setIsSavingEnv(false);
		}
	};

	const addEnvVar = () => {
		const key = `NEW_VAR_${Object.keys(envVars).length + 1}`;
		setEnvVars({ ...envVars, [key]: "" });
	};

	const updateEnvVar = (oldKey: string, newKey: string, value: string) => {
		const newEnvVars = { ...envVars };
		if (oldKey !== newKey) {
			delete newEnvVars[oldKey];
		}
		newEnvVars[newKey] = value;
		setEnvVars(newEnvVars);
	};

	const deleteEnvVar = (key: string) => {
		const newEnvVars = { ...envVars };
		delete newEnvVars[key];
		setEnvVars(newEnvVars);
	};

	return (
		<div className="flex-1 flex flex-col relative">
			<div className="border-b border-border-border px-4 py-2 flex items-center justify-between">
				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
					<TabsList>
						<TabsTrigger value="preview" className="flex items-center gap-2">
							<Eye className="h-4 w-4" />
							Preview
						</TabsTrigger>
						<TabsTrigger value="code" className="flex items-center gap-2">
							<Code className="h-4 w-4" />
							Code
						</TabsTrigger>
						<TabsTrigger value="env" className="flex items-center gap-2">
							<Settings className="h-4 w-4" />
							Environment
						</TabsTrigger>
					</TabsList>
				</Tabs>
				<div className="flex items-center gap-2 flex-1 justify-end">
					{activeTab === "preview" && (
						<div className="flex items-center gap-1 mr-3 max-w-md flex-1">
							<Input
								readOnly
								value={project?.previewUrl ?? logDerivedPreviewUrl ?? ""}
								placeholder="Preview URL"
								className="h-8 text-xs font-mono bg-raised text-muted border-border-border cursor-default"
								title={
									project?.previewUrl ?? logDerivedPreviewUrl ?? "Preview URL"
								}
							/>
						</div>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isRestarting}
						title="Restart preview container and reload"
					>
						<RefreshCw
							className={`h-4 w-4 ${isRestarting ? "animate-spin" : ""}`}
						/>
					</Button>
					<Button onClick={handleDeploy} className="flex items-center gap-2">
						<Rocket className="h-4 w-4" />
						Deploy
					</Button>
				</div>
			</div>
			<div
				className={`flex-1 overflow-auto ${isTerminalExpanded ? "pb-80" : "pb-12"}`}
			>
				{activeTab === "preview" && (
					<div className="h-full min-h-full bg-bg relative">
						{project?.previewUrl || logDerivedPreviewUrl ? (
							<>
								{/* Show iframe only if preview is ready AND first generation is complete */}
								{previewReady && isFirstGenerationComplete && (
									<iframe
										ref={iframeRef}
										key={`${project?.previewUrl ?? logDerivedPreviewUrl ?? ""}-${iframeKey}`}
										src={
											project?.previewUrl ?? logDerivedPreviewUrl ?? undefined
										}
										className="w-full h-full border-0 bg-white"
										title="Preview"
										sandbox="allow-same-origin allow-scripts allow-forms"
									/>
								)}
								{/* Show loading state when iframe is loading OR during initial generation */}
								{(isIframeLoading || !isFirstGenerationComplete) && (
									<div className="absolute inset-0 bg-bg flex items-center justify-center">
										{!isFirstGenerationComplete ? (
											// Show AI blob during initial generation (even if preview is technically ready)
											<div className="text-center space-y-6">
												<AIBlob size={80} className="mx-auto" />
												<div>
													<p className="text-sm font-medium">
														Generating your project workspace...
													</p>
													<p className="text-xs text-muted mt-1">
														We’ll start the live preview as soon as files are
														ready.
													</p>
												</div>
											</div>
										) : (
											// Show regular loading after first generation is complete
											<div className="text-center space-y-4">
												<Loader2 className="h-8 w-8 animate-spin mx-auto text-strong" />
												<div>
													<p className="text-sm font-medium">
														Starting live preview server...
													</p>
													<p className="text-xs text-muted mt-1">
														This can take a few seconds the first time.
													</p>
												</div>
											</div>
										)}
									</div>
								)}
								{iframeError && !isIframeLoading && (
									<div className="absolute inset-0 bg-white flex items-center justify-center">
										<div className="text-center space-y-4">
											<p className="text-muted">Preview failed to load</p>
											<Button
												variant="outline"
												onClick={() => {
													setIsIframeLoading(true);
													setIframeError(false);
													mutate();
												}}
											>
												<RefreshCw className="h-4 w-4 mr-2" />
												Retry
											</Button>
										</div>
									</div>
								)}
							</>
						) : (
							<div className="h-full flex items-center justify-center">
								<div className="text-center space-y-4">
									{(() => {
										const isLoadingStatus =
											previewStatus === "creating" ||
											previewStatus === "starting" ||
											(previewStatus === "running" && !project?.previewUrl);

										// If the project hasn't been bootstrapped yet, don't
										// show any preview controls – just explain what's
										// happening.
										if (!project || project.bootstrapped !== "true") {
											return (
												<p className="text-muted">
													Your project is still being generated. The live
													preview will be available once initial generation
													finishes.
												</p>
											);
										}

										return (
											<>
												<p className="text-muted">
													{isLoadingStatus
														? "Preview is starting..."
														: previewStatus === "failed"
															? "Preview failed to start"
															: "No preview available yet"}
												</p>
												<Button
													onClick={handleCreatePreview}
													disabled={
														isCreatingPreview ||
														previewStatus === "creating" ||
														previewStatus === "starting" ||
														(previewStatus === "running" &&
															!project?.previewUrl)
													}
												>
													{isCreatingPreview || previewStatus === "creating" ? (
														<>
															<Loader2 className="h-4 w-4 mr-2 animate-spin" />
															Creating Preview...
														</>
													) : previewStatus === "starting" ||
														(previewStatus === "running" &&
															!project?.previewUrl) ? (
														<>
															<Loader2 className="h-4 w-4 mr-2 animate-spin" />
															Starting Preview...
														</>
													) : previewStatus === "failed" ? (
														"Retry Preview"
													) : (
														"Create Preview"
													)}
												</Button>
											</>
										);
									})()}
								</div>
							</div>
						)}
					</div>
				)}
				{activeTab === "code" && (
					<div className="h-full flex bg-surface/30">
						<div className="w-64 border-r border-border-border bg-surface/80 flex flex-col">
							<div className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wide">
								Files
							</div>
							<div className="flex-1 overflow-auto text-xs">
								{isFilesLoading && (
									<div className="px-3 py-2 text-muted">Loading files...</div>
								)}
								{!isFilesLoading && fileEntries.length === 0 && (
									<div className="px-3 py-2 text-muted">
										No source files in this project.
									</div>
								)}
								{!isFilesLoading &&
									fileEntries.map((entry) => (
										<button
											key={entry.path}
											type="button"
											onClick={() => setSelectedFile(entry.path)}
											className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate border-l-2 ${
												selectedFile === entry.path
													? "bg-bg/80 text-strong border-strong"
													: "text-muted border-transparent hover:bg-bg/60"
											}`}
											style={{ paddingLeft: 12 + entry.depth * 12 }}
										>
											{entry.displayPath}
										</button>
									))}
							</div>
						</div>
						<div className="flex-1 min-w-0 flex flex-col">
							<div className="border-b border-border-border px-4 py-2 text-xs text-muted flex items-center justify-between">
								<div className="truncate">
									{selectedFile
										? selectedFile.replace(/^src\//, "")
										: "Select a file to view"}
								</div>
							</div>
							<div className="flex-1 min-h-0">
								{!selectedFile && (
									<div className="h-full flex items-center justify-center text-muted text-sm">
										Select a file from the list to view its contents.
									</div>
								)}
								{selectedFile && isFileContentLoading && (
									<div className="h-full flex items-center justify-center text-muted text-sm">
										Loading file...
									</div>
								)}
								{selectedFile && !isFileContentLoading && fileContentData && (
									<Editor
										language={getLanguageFromPath(selectedFile)}
										value={fileContentData.content}
										theme="hc-black"
										options={{
											readOnly: true,
											fontSize: 12,
											minimap: { enabled: false },
											scrollBeyondLastLine: false,
											automaticLayout: true,
										}}
									/>
								)}
							</div>
						</div>
					</div>
				)}
				{activeTab === "env" && (
					<div className="h-full overflow-auto p-4 bg-surface/30">
						<div className="max-w-3xl mx-auto space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-lg font-semibold">
										Environment Variables
									</h3>
									<p className="text-sm text-muted">
										Variables for development and production
									</p>
								</div>
								<Button onClick={addEnvVar} variant="outline" size="sm">
									<Plus className="h-4 w-4 mr-2" />
									Add Variable
								</Button>
							</div>

							<div className="space-y-2">
								{Object.entries(envVars).map(([key, value]) => (
									<div
										key={key}
										className="flex items-center gap-2 bg-surface p-3 rounded-lg border border-border-border"
									>
										<Input
											placeholder="KEY"
											value={key}
											onChange={(e) => updateEnvVar(key, e.target.value, value)}
											className="flex-1 font-mono text-sm"
										/>
										<span className="text-muted">=</span>
										<Input
											placeholder="value"
											value={value}
											onChange={(e) => updateEnvVar(key, key, e.target.value)}
											className="flex-[2] font-mono text-sm"
											type="text"
										/>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => deleteEnvVar(key)}
											className="flex-shrink-0"
										>
											<Trash2 className="h-4 w-4 text-danger" />
										</Button>
									</div>
								))}

								{Object.keys(envVars).length === 0 && (
									<div className="text-center py-8 text-muted">
										No environment variables yet. Click "Add Variable" to create
										one.
									</div>
								)}
							</div>

							{Object.keys(envVars).length > 0 && (
								<div className="flex justify-end pt-4">
									<Button onClick={handleSaveEnv} disabled={isSavingEnv}>
										{isSavingEnv ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Saving...
											</>
										) : (
											"Save & Restart Preview"
										)}
									</Button>
								</div>
							)}

							<div className="mt-6 p-4 bg-surface rounded-lg border border-border-border">
								<h4 className="font-medium mb-2 text-sm">
									Usage in your code:
								</h4>
								<pre className="text-xs font-mono bg-bg p-3 rounded overflow-x-auto">
									<code>{`// Access in Astro components
const apiKey = import.meta.env.YOUR_API_KEY

// Access in React components (client-side)
const apiKey = import.meta.env.PUBLIC_YOUR_API_KEY

// Note: Prefix with PUBLIC_ for client-side access`}</code>
								</pre>
							</div>
						</div>
					</div>
				)}
			</div>
			<TerminalDock
				key={iframeKey}
				projectId={projectId}
				isPreviewRunning={!!(project?.previewUrl || logDerivedPreviewUrl)}
				isExpanded={isTerminalExpanded}
				onToggle={() => setIsTerminalExpanded(!isTerminalExpanded)}
				previewUrl={project?.previewUrl ?? logDerivedPreviewUrl ?? undefined}
				onPreviewUrlDetected={(url) => {
					setLogDerivedPreviewUrl(url);
					setInitialGenerationInProgress(projectId, false);
					setIsFirstGenerationComplete(true);
				}}
			/>
		</div>
	);
}
