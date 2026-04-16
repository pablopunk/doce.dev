import { actions } from "astro:actions";
import {
	Download,
	Ellipsis,
	ExternalLink,
	Loader2,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBaseUrlSetting } from "@/hooks/useBaseUrlSetting";
import { mapPortUrlToPreferredHost } from "@/lib/base-url";
import type { Project } from "@/server/db/schema";
import { useProjectOptimisticState } from "@/stores/useProjectOptimisticState";
import { DeleteProjectDialog } from "./DeleteProjectDialog";

interface ProjectCardProps {
	project: Project;
	onDeleted?: (projectId: string) => void;
}

interface PillStyle {
	bg: string;
	text: string;
}

const environmentPillStyles: Record<"preview" | "production", PillStyle> = {
	preview: {
		bg: "bg-primary/10",
		text: "text-primary",
	},
	production: {
		bg: "bg-accent",
		text: "text-accent-foreground",
	},
};

const transientStatusStyles: Record<string, PillStyle> = {
	starting: {
		bg: "bg-accent",
		text: "text-accent-foreground",
	},
	stopping: {
		bg: "bg-accent",
		text: "text-accent-foreground",
	},
	deleting: {
		bg: "bg-destructive",
		text: "text-destructive-foreground",
	},
	error: {
		bg: "bg-destructive",
		text: "text-destructive-foreground",
	},
	building: {
		bg: "bg-accent",
		text: "text-accent-foreground",
	},
	queued: {
		bg: "bg-muted",
		text: "text-muted-foreground",
	},
	failed: {
		bg: "bg-destructive",
		text: "text-destructive-foreground",
	},
};

const transientStatusLabels: Record<string, string> = {
	starting: "Starting...",
	stopping: "Stopping...",
	deleting: "Deleting...",
	error: "Error",
	building: "Deploying...",
	queued: "Queued",
	failed: "Deploy failed",
};

function getTransientStatusStyle(status: string): PillStyle {
	return (
		transientStatusStyles[status] || {
			bg: "bg-muted",
			text: "text-muted-foreground",
		}
	);
}

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const { baseUrl } = useBaseUrlSetting();
	const markDeleting = useProjectOptimisticState((s) => s.markDeleting);
	const clearPending = useProjectOptimisticState((s) => s.clearPending);
	const pending = useProjectOptimisticState(
		(s) => s.pendingByProjectId.get(project.id) ?? null,
	);
	const isDeleting = pending?.action === "deleting";

	const previewUrl =
		typeof window === "undefined"
			? `http://localhost:${project.devPort}`
			: (mapPortUrlToPreferredHost(
					`http://localhost:${project.devPort}`,
					baseUrl,
					window.location.origin,
				) ?? `http://localhost:${project.devPort}`);
	const isPreviewRunning = project.status === "running";
	const isProductionRunning = project.productionStatus === "running";
	const transientProjectStatus =
		project.status === "starting" ||
		project.status === "stopping" ||
		project.status === "deleting" ||
		project.status === "error"
			? project.status
			: null;
	const transientProductionStatus =
		project.productionStatus === "queued" ||
		project.productionStatus === "building" ||
		project.productionStatus === "failed"
			? project.productionStatus
			: null;
	const isLoading =
		transientProjectStatus === "starting" ||
		transientProjectStatus === "stopping" ||
		transientProjectStatus === "deleting" ||
		transientProductionStatus === "building";

	const handleDeleteClick = () => {
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async (projectId: string) => {
		// Optimistic: mark deleting + hide immediately
		markDeleting(projectId);
		onDeleted?.(projectId);

		try {
			const result = await actions.projects.delete({ projectId });
			if (result.error) {
				clearPending(projectId);
				toast.error(result.error.message);
			}
		} catch {
			clearPending(projectId);
			toast.error("Failed to delete project");
		}
	};

	const handleExportClick = async () => {
		setIsExporting(true);
		try {
			const response = await fetch(`/api/projects/${project.id}/export`);
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
				fileNameMatch?.[1] ?? `${project.slug}-preview-source.zip`;

			const link = document.createElement("a");
			link.href = downloadUrl;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(downloadUrl);

			toast.success(`Exported ${project.name}`);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to export project source",
			);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<>
			<Card className="group relative overflow-hidden">
				<CardHeader className="pb-2">
					<div className="flex items-start gap-2 overflow-hidden">
						<div className="min-w-0 flex-1">
							<CardTitle className="text-lg truncate">{project.name}</CardTitle>
						</div>
						<div className="flex shrink-0 flex-wrap justify-end gap-1.5">
							{isPreviewRunning && (
								<span
									className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${environmentPillStyles.preview.bg} ${environmentPillStyles.preview.text}`}
								>
									Preview
								</span>
							)}
							{isProductionRunning && (
								<span
									className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${environmentPillStyles.production.bg} ${environmentPillStyles.production.text}`}
								>
									Production
								</span>
							)}
							{transientProjectStatus && (
								<span
									className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getTransientStatusStyle(transientProjectStatus).bg} ${getTransientStatusStyle(transientProjectStatus).text}`}
								>
									{isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
									{transientStatusLabels[transientProjectStatus]}
								</span>
							)}
							{!transientProjectStatus && transientProductionStatus && (
								<span
									className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getTransientStatusStyle(transientProductionStatus).bg} ${getTransientStatusStyle(transientProductionStatus).text}`}
								>
									{isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
									{transientStatusLabels[transientProductionStatus]}
								</span>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground line-clamp-2 mb-4">
						{project.prompt}
					</p>
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<div className="flex gap-2 flex-wrap min-w-0">
							{isPreviewRunning && (
								<a
									href={previewUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex"
								>
									<Button variant="outline" size="sm">
										<ExternalLink className="h-4 w-4 mr-1" />
										Preview
									</Button>
								</a>
							)}
							<a href={`/projects/${project.id}/${project.slug}`}>
								<Button variant="default" size="sm">
									Open
								</Button>
							</a>
						</div>
						<DropdownMenu>
							{/* @ts-expect-error asChild from radix not typed */}
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									disabled={
										isDeleting || isExporting || project.status === "deleting"
									}
								>
									{isDeleting || isExporting ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Ellipsis className="h-4 w-4" />
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleExportClick}>
									<Download className="h-4 w-4" />
									Export source (.zip)
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={handleDeleteClick}
									className="text-destructive focus:text-destructive"
								>
									<Trash2 className="h-4 w-4" />
									Delete project
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
						<span>Port: {project.devPort}</span>
						{"defaultModel" in project &&
							typeof (project as Record<string, unknown>).defaultModel ===
								"string" && (
								<span className="ml-3">
									Model:{" "}
									{(project as Record<string, unknown>).defaultModel as string}
								</span>
							)}
					</div>
				</CardContent>
			</Card>

			<DeleteProjectDialog
				projectId={project.id}
				projectName={project.name}
				isOpen={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDeleteConfirm}
				isDeleting={isDeleting}
			/>
		</>
	);
}
