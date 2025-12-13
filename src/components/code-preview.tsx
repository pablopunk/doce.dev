"use client";

import { actions } from "astro:actions";
import Editor from "@monaco-editor/react";
import {
	Code,
	Eye,
	Loader2,
	Plus,
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
import type { PreviewStatusPayload } from "@/lib/preview-status-bus";

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

const PREVIEW_STATUS_MESSAGES: Record<PreviewStatusPayload["status"], string> =
	{
		"not-created": "Waiting for preview container...",
		creating: "Copying starter files...",
		starting: "Booting container & installing deps...",
		running: "Starting Astro dev server...",
		failed: "Preview failed",
		unknown: "Preview status unknown",
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

// Track whether initial generation is in progress per project
const initialGenerationStatus = new Map<string, boolean>();

// Track in-flight dev server start requests to avoid duplicate triggers
const activeDevServerRequests = new Set<string>();

export function refreshCodePreview() {
	if (globalRefreshFn) {
		globalRefreshFn();
	}
}

export function setInitialGenerationInProgress(
	projectId: string,
	inProgress: boolean,
) {
	initialGenerationStatus.set(projectId, inProgress);
}

/**
 * Start the dev server for a project after AI finishes generating code.
 * This is called from the chat interface when session.idle is received.
 */
export async function startDevServerForProject(
	projectId: string,
): Promise<void> {
	if (activeDevServerRequests.has(projectId)) {
		return;
	}

	activeDevServerRequests.add(projectId);
	try {
		console.log(`Starting dev server for project ${projectId}`);
		const { error } = await actions.projects.startDevServer({ id: projectId });
		if (error) {
			console.error("Failed to start dev server:", error);
		} else {
			console.log(`Dev server started for project ${projectId}`);
		}
	} catch (error) {
		console.error("Failed to start dev server:", error);
	} finally {
		activeDevServerRequests.delete(projectId);
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
	const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
	const [iframeKey, setIframeKey] = useState(0);
	const [previewReady, setPreviewReady] = useState(false);
	const [previewStatus, setPreviewStatus] =
		useState<PreviewStatusPayload | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const statusEventRef = useRef<EventSource | null>(null);
	const statusReconnectTimer = useRef<NodeJS.Timeout | null>(null);

	const statusMessage = previewStatus
		? PREVIEW_STATUS_MESSAGES[previewStatus.status] ||
			PREVIEW_STATUS_MESSAGES.unknown
		: "Preparing your live preview...";

	const statusHint =
		previewStatus?.status === "running"
			? "Waiting for the Astro dev server to respond..."
			: "We'll load the preview as soon as it's ready.";

	const restartLabel =
		previewStatus?.status === "failed" ? "Retry preview" : "Restart preview";

	const { data: project, mutate } = useSWR(
		["project", projectId],
		([_key, id]) => projectFetcher(_key, id),
		{
			refreshInterval: 0,
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

	// Define restartPreview as callback before use
	const restartPreview = useCallback(
		async (expandTerminal: boolean = false) => {
			setPreviewReady(false);
			if (expandTerminal) {
				setIsTerminalExpanded(true);
			}
			try {
				await actions.projects.restartPreview({ id: projectId });
				setIframeKey((prev) => prev + 1);
				await mutate();
			} catch (error) {
				console.error("Failed to restart preview:", error);
			}
			void startDevServerForProject(projectId);
		},
		[projectId, mutate],
	);

	// Restart preview whenever this component is visited
	useEffect(() => {
		if (!project?.previewUrl) {
			void restartPreview(false);
		}
	}, [project?.previewUrl, restartPreview]);

	// Subscribe to preview status events via SSE for richer feedback
	useEffect(() => {
		let cancelled = false;

		const connect = () => {
			if (cancelled) return;

			const es = new EventSource(`/api/projects/${projectId}/status`);
			statusEventRef.current = es;

			es.onmessage = (event) => {
				if (!event.data || cancelled) return;
				try {
					const payload = JSON.parse(event.data);
					if (payload?.message === "connected") {
						return;
					}
					setPreviewStatus(payload as PreviewStatusPayload);
					if (payload?.error) {
						setPreviewError(payload.error);
					}
					if (payload?.status === "running") {
						setPreviewError(null);
						refreshCodePreview();
					} else if (payload?.status === "failed" && payload?.error) {
						setPreviewReady(false);
					}
				} catch (err) {
					console.error("Failed to parse preview status event:", err);
				}
			};

			es.onerror = () => {
				if (statusEventRef.current) {
					statusEventRef.current.close();
					statusEventRef.current = null;
				}
				if (!cancelled) {
					statusReconnectTimer.current = setTimeout(connect, 3000);
				}
			};
		};

		connect();

		return () => {
			cancelled = true;
			if (statusReconnectTimer.current) {
				clearTimeout(statusReconnectTimer.current);
				statusReconnectTimer.current = null;
			}
			if (statusEventRef.current) {
				statusEventRef.current.close();
				statusEventRef.current = null;
			}
		};
	}, [projectId]);

	// Poll the preview URL until it serves HTML
	useEffect(() => {
		setPreviewReady(false);
		setPreviewError(null);

		const url = project?.previewUrl;
		if (!url) return;

		let cancelled = false;
		let intervalId: number | undefined;

		const checkPreview = async () => {
			try {
				const response = await fetch(url, { method: "GET" });
				if (cancelled) return;

				const contentType = response.headers.get("content-type") || "";
				if (response.ok && contentType.includes("text/html")) {
					setPreviewReady(true);
					setPreviewError(null);
					if (intervalId !== undefined) {
						window.clearInterval(intervalId);
					}
				} else if (response.status >= 500) {
					setPreviewError(`Server responded with ${response.status}`);
				}
			} catch (error) {
				if (!cancelled) {
					setPreviewError((error as Error).message);
				}
			}
		};

		void checkPreview();
		intervalId = window.setInterval(checkPreview, 2000);

		return () => {
			cancelled = true;
			if (intervalId !== undefined) {
				window.clearInterval(intervalId);
			}
		};
	}, [project?.previewUrl]);

	const handleDeploy = async () => {
		await actions.projects.deployProject({ id: projectId });
		mutate();
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
				await restartPreview(true);
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
								value={project?.previewUrl ?? ""}
								placeholder="Preview URL"
								className="h-8 text-xs font-mono bg-raised text-muted border-border-border cursor-default"
								title={project?.previewUrl ?? "Preview URL"}
							/>
						</div>
					)}
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
						{previewReady && project?.previewUrl ? (
							<iframe
								key={`${project.previewUrl}-${iframeKey}`}
								src={project.previewUrl}
								className="w-full h-full border-0 bg-white"
								title="Preview"
								sandbox="allow-same-origin allow-scripts allow-forms"
							/>
						) : (
							<div className="absolute inset-0 bg-bg flex items-center justify-center px-6">
								<div className="text-center space-y-5 max-w-sm">
									<AIBlob size={80} className="mx-auto" />
									<div>
										<p className="text-sm font-medium">{statusMessage}</p>
										<p
											className={`text-xs mt-1 ${
												previewError ? "text-danger" : "text-muted"
											}`}
										>
											{previewError ?? statusHint}
										</p>
									</div>
									<div className="flex items-center justify-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setIsTerminalExpanded(true)}
										>
											View logs
										</Button>
										{project?.previewUrl && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => void restartPreview(true)}
											>
												{restartLabel}
											</Button>
										)}
									</div>
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
				isPreviewRunning={!!project?.previewUrl}
				isExpanded={isTerminalExpanded}
				onToggle={() => setIsTerminalExpanded(!isTerminalExpanded)}
				previewUrl={project?.previewUrl ?? undefined}
			/>
		</div>
	);
}
