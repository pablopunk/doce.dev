"use client";

import {
	Code,
	Eye,
	Loader2,
	Plus,
	RefreshCw,
	Rocket,
	Settings,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { actions } from "astro:actions";
import { TerminalDock } from "@/domain/system/components/terminal-dock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIBlob from "@/components/ui/ai-blob";
import { useProjectLifecycle } from "@/domain/projects/hooks/use-project-lifecycle";
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
		} else if (inProgress === undefined) {
			// If we don't have info about this project, assume it's complete
			// (happens when loading an existing project)
			setIsFirstGenerationComplete(true);
		}
	}, [projectId]);

	// Poll the global state to detect when generation completes
	useEffect(() => {
		const interval = setInterval(() => {
			const inProgress = initialGenerationInProgress.get(projectId);
			if (inProgress === false) {
				setIsFirstGenerationComplete(true);
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
		if (!isFirstGenerationComplete) return;

		if (previewStatus === "not-created" || previewStatus === "unknown") {
			console.log(
				`Auto-starting preview for ${projectId} (status: ${previewStatus})`,
			);
			setHasAutoStarted(true);
			void handleCreatePreview();
		}
	}, [
		previewStatus,
		projectId,
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
		if (project?.previewUrl) {
			setIsIframeLoading(true);
			setIframeError(false);
			setPreviewReady(false);

			// Poll the preview URL to check if it's ready
			let attempts = 0;
			const maxAttempts = 60; // 60 seconds max
			const pollInterval = setInterval(async () => {
				attempts++;
				try {
					// Try to actually fetch the URL to see if it responds
					const response = await fetch(project.previewUrl as string, {
						method: "GET",
						cache: "no-cache",
					});

					// If we get any response (even 404), the server is up
					if (response) {
						console.log(`Preview server ready at ${project.previewUrl}`);
						setPreviewReady(true);
						setIsIframeLoading(false);
						clearInterval(pollInterval);
					}
				} catch (error) {
					// Server not ready yet, continue polling
					console.log(
						`Waiting for preview server... (attempt ${attempts}/${maxAttempts})`,
					);
					if (attempts >= maxAttempts) {
						console.error("Preview server failed to start within timeout");
						setIframeError(true);
						setIsIframeLoading(false);
						clearInterval(pollInterval);
					}
				}
			}, 1000);

			return () => clearInterval(pollInterval);
		} else {
			setPreviewReady(false);
		}
	}, [project?.previewUrl]);

	const handleDeploy = async () => {
		await actions.projects.deployProject({ id: projectId });
		mutate();
	};

	const handleRefresh = async () => {
		setIsRestarting(true);
		setPreviewReady(false);
		setIsIframeLoading(true);
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
				<div className="flex items-center gap-2">
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
						{project?.previewUrl ? (
							<>
								{/* Show iframe only if preview is ready AND first generation is complete */}
								{previewReady && isFirstGenerationComplete && (
									<iframe
										key={`${project.previewUrl}-${iframeKey}`}
										src={project.previewUrl}
										className="w-full h-full border-0"
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
														Generating your project...
													</p>
													<p className="text-xs text-muted mt-1">
														This might take a moment
													</p>
												</div>
											</div>
										) : (
											// Show regular loading after first generation is complete
											<div className="text-center space-y-4">
												<Loader2 className="h-8 w-8 animate-spin mx-auto text-strong" />
												<div>
													<p className="text-sm font-medium">
														Starting preview...
													</p>
													<p className="text-xs text-muted mt-1">
														Waiting for server to respond...
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
					<div className="h-full overflow-auto p-4 bg-surface/30">
						<div className="h-full flex items-center justify-center text-muted">
							Code view temporarily disabled
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
				isPreviewRunning={!!project?.previewUrl}
				isExpanded={isTerminalExpanded}
				onToggle={() => setIsTerminalExpanded(!isTerminalExpanded)}
			/>
		</div>
	);
}
