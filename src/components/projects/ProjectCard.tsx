import { actions } from "astro:actions";
import {
	Download,
	Ellipsis,
	Loader2,
	Plug,
	SatelliteDish,
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
import { useProjectOptimisticState } from "@/stores/useProjectOptimisticState";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import type { ProjectListItem } from "./projects.types";

interface ProjectCardProps {
	project: ProjectListItem;
	onDeleted?: (projectId: string) => void;
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

	const rawPreviewUrl =
		project.previewUrl ?? `http://localhost:${project.devPort}`;
	const previewUrl =
		typeof window === "undefined"
			? rawPreviewUrl
			: (mapPortUrlToPreferredHost(
					rawPreviewUrl,
					baseUrl,
					window.location.origin,
				) ?? rawPreviewUrl);
	const isPreviewRunning = project.status === "running";
	const isProductionRunning =
		project.productionStatus === "running" && Boolean(project.productionUrl);

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
					<CardTitle className="text-lg truncate">
						<a href={`/projects/${project.id}/${project.slug}`}>
							{project.name}
						</a>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground line-clamp-2 mb-4">
						{project.prompt}
					</p>
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<div className="flex gap-2 flex-wrap min-w-0">
							<a href={`/projects/${project.id}/${project.slug}`}>
								<Button variant="default" size="sm">
									Open
								</Button>
							</a>
							{isPreviewRunning && (
								<a
									href={previewUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex"
								>
									<Button variant="outline" size="sm">
										<Plug className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
										Preview
									</Button>
								</a>
							)}
							{isProductionRunning && project.productionUrl && (
								<a
									href={project.productionUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex"
								>
									<Button variant="outline" size="sm">
										<SatelliteDish className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
										Production
									</Button>
								</a>
							)}
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
