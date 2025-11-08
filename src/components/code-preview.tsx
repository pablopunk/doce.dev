"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
	Eye,
	Code,
	Rocket,
	RefreshCw,
	Loader2,
	Settings,
	Plus,
	Trash2,
} from "lucide-react";
import useSWR from "swr";
import { TerminalDock } from "@/components/terminal-dock";
import { useProjectLifecycle } from "@/hooks/use-project-lifecycle";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Global refresh function that can be called from other components
let globalRefreshFn: (() => void) | null = null;

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
	const { data: project, mutate } = useSWR(
		`/api/projects/${projectId}`,
		fetcher,
		{
			refreshInterval: 0, // Disable auto-refresh to prevent input clearing
			revalidateOnFocus: false,
		},
	);

	const { data: envData } = useSWR(`/api/projects/${projectId}/env`, fetcher, {
		refreshInterval: 0, // Disable auto-refresh
		revalidateOnFocus: false,
	});

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

	// Handler to create/start preview
	const handleCreatePreview = useCallback(async () => {
		setIsCreatingPreview(true);
		try {
			await fetch(`/api/projects/${projectId}/preview`, { method: "POST" });
			mutate();
		} catch (error) {
			console.error("Failed to create preview:", error);
		} finally {
			setIsCreatingPreview(false);
		}
	}, [projectId, mutate]);

	// Auto-start preview when component mounts if not already running
	useEffect(() => {
		const checkAndStartPreview = async () => {
			if (!project || hasAutoStarted || isCreatingPreview) return;

			// Check if preview is actually running (not just DB state)
			try {
				const statusRes = await fetch(`/api/projects/${projectId}/preview`);
				const statusData = await statusRes.json();
				
				// If preview is not running, start it
				if (statusData.status === "not-created") {
					console.log(`Preview not running for ${projectId}, starting...`);
					setHasAutoStarted(true);
					await handleCreatePreview();
				}
			} catch (error) {
				console.error("Failed to check preview status:", error);
			}
		};

		checkAndStartPreview();
	}, [project, hasAutoStarted, isCreatingPreview, projectId, handleCreatePreview]);

	// Reset loading state when preview URL changes and poll for readiness
	useEffect(() => {
		if (project?.preview_url) {
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
					const response = await fetch(project.preview_url, { 
						method: 'GET',
						cache: 'no-cache'
					});
					
					// If we get any response (even 404), the server is up
					if (response) {
						console.log(`Preview server ready at ${project.preview_url}`);
						setPreviewReady(true);
						setIsIframeLoading(false);
						clearInterval(pollInterval);
					}
				} catch (error) {
					// Server not ready yet, continue polling
					console.log(`Waiting for preview server... (attempt ${attempts}/${maxAttempts})`);
					if (attempts >= maxAttempts) {
						console.error('Preview server failed to start within timeout');
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
	}, [project?.preview_url]);

	const handleDeploy = async () => {
		await fetch(`/api/projects/${projectId}/deploy`, { method: "POST" });
		mutate();
	};

	const handleSaveEnv = async () => {
		setIsSavingEnv(true);
		try {
			await fetch(`/api/projects/${projectId}/env`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ env: envVars }),
			});
			// Restart preview to pick up new env vars
			if (project?.preview_url) {
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
			<div className="border-b border-border px-4 py-2 flex items-center justify-between">
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
						onClick={() => mutate()}
						title="Refresh files and preview status"
					>
						<RefreshCw className="h-4 w-4" />
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
					<div className="h-full min-h-full bg-white relative">
						{project?.preview_url ? (
							<>
								{previewReady && (
									<iframe
										key={project.preview_url}
										src={project.preview_url}
										className="w-full h-full border-0"
										title="Preview"
										sandbox="allow-same-origin allow-scripts allow-forms"
									/>
								)}
								{isIframeLoading && (
									<div className="absolute inset-0 bg-white flex items-center justify-center">
										<div className="text-center space-y-4">
											<Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
											<div>
												<p className="text-sm font-medium">Starting preview...</p>
												<p className="text-xs text-muted-foreground mt-1">
													Waiting for server to respond...
												</p>
											</div>
										</div>
									</div>
								)}
								{iframeError && !isIframeLoading && (
									<div className="absolute inset-0 bg-white flex items-center justify-center">
										<div className="text-center space-y-4">
											<p className="text-muted-foreground">
												Preview failed to load
											</p>
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
									<p className="text-muted-foreground">
										No preview available yet
									</p>
									<Button
										onClick={handleCreatePreview}
										disabled={isCreatingPreview}
									>
										{isCreatingPreview ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Creating Preview...
											</>
										) : (
											"Create Preview"
										)}
									</Button>
								</div>
							</div>
						)}
					</div>
				)}
				{activeTab === "code" && (
					<div className="h-full overflow-auto p-4 bg-muted/30">
						{project?.files && project.files.length > 0 ? (
							<div className="space-y-4">
								{project.files.map((file: any) => (
									<div
										key={file.id}
										className="bg-card rounded-lg border border-border overflow-hidden"
									>
										<div className="bg-muted px-4 py-2 font-mono text-sm">
											{file.file_path}
										</div>
										<pre className="p-4 overflow-x-auto">
											<code className="text-sm">{file.content}</code>
										</pre>
									</div>
								))}
							</div>
						) : (
							<div className="h-full flex items-center justify-center text-muted-foreground">
								No code generated yet
							</div>
						)}
					</div>
				)}
				{activeTab === "env" && (
					<div className="h-full overflow-auto p-4 bg-muted/30">
						<div className="max-w-3xl mx-auto space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-lg font-semibold">
										Environment Variables
									</h3>
									<p className="text-sm text-muted-foreground">
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
										className="flex items-center gap-2 bg-card p-3 rounded-lg border border-border"
									>
										<Input
											placeholder="KEY"
											value={key}
											onChange={(e) => updateEnvVar(key, e.target.value, value)}
											className="flex-1 font-mono text-sm"
										/>
										<span className="text-muted-foreground">=</span>
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
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								))}

								{Object.keys(envVars).length === 0 && (
									<div className="text-center py-8 text-muted-foreground">
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

							<div className="mt-6 p-4 bg-muted rounded-lg border border-border">
								<h4 className="font-medium mb-2 text-sm">
									Usage in your code:
								</h4>
								<pre className="text-xs font-mono bg-background p-3 rounded overflow-x-auto">
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
				projectId={projectId}
				isPreviewRunning={!!project?.preview_url}
				isExpanded={isTerminalExpanded}
				onToggle={() => setIsTerminalExpanded(!isTerminalExpanded)}
			/>
		</div>
	);
}
