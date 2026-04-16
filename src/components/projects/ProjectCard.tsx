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

interface StatusStyle {
	bg: string;
	text: string;
}

const statusStyles: Record<string, StatusStyle> = {
	created: {
		bg: "bg-muted",
		text: "text-muted-foreground",
	},
	starting: {
		bg: "bg-accent",
		text: "text-accent-foreground",
	},
	running: {
		bg: "bg-primary",
		text: "text-primary-foreground",
	},
	stopping: {
		bg: "bg-accent",
		text: "text-accent-foreground",
	},
	stopped: {
		bg: "bg-muted",
		text: "text-muted-foreground",
	},
	deleting: {
		bg: "bg-destructive",
		text: "text-destructive-foreground",
	},
	error: {
		bg: "bg-destructive",
		text: "text-destructive-foreground",
	},
};

const statusLabels: Record<string, string> = {
	created: "Created",
	starting: "Starting...",
	running: "Running",
	stopping: "Stopping...",
	stopped: "Stopped",
	deleting: "Deleting...",
	error: "Error",
};

function getStatusStyle(status: string): StatusStyle {
	return (
		statusStyles[status] || {
			bg: "bg-muted",
			text: "text-muted-foreground",
		}
	);
}

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const { baseUrl } = useBaseUrlSetting();
	const { markDeleting, clearPending, getPending } =
		useProjectOptimisticState();
	const pending = getPending(project.id);
	const isDeleting = pending?.action === "deleting";

	const previewUrl =
		typeof window === "undefined"
			? `http://localhost:${project.devPort}`
			: (mapPortUrlToPreferredHost(
					`http://localhost:${project.devPort}`,
					baseUrl,
					window.location.origin,
				) ?? `http://localhost:${project.devPort}`);
	const isRunning = project.status === "running";
	const isLoading =
		project.status === "starting" ||
		project.status === "stopping" ||
		project.status === "deleting";

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
					<div className="flex items-center gap-2 overflow-hidden">
						<div className="min-w-0 flex-1">
							<CardTitle className="text-lg truncate">{project.name}</CardTitle>
						</div>
						<div className="shrink-0">
							{(() => {
								const style = getStatusStyle(project.status);
								return (
									<span
										className={`inline-flex max-w-full items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${style.bg} ${style.text}`}
									>
										{isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
										{statusLabels[project.status]}
									</span>
								);
							})()}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground line-clamp-2 mb-4">
						{project.prompt}
					</p>
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<div className="flex gap-2 flex-wrap min-w-0">
							{isRunning && (
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
