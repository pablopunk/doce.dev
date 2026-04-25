import { actions } from "astro:actions";
import {
	Download,
	ExternalLink,
	Loader2,
	Moon,
	Plug,
	SatelliteDish,
	Square,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
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
	const markStopping = useProjectOptimisticState((s) => s.markStopping);
	const markStoppingProduction = useProjectOptimisticState(
		(s) => s.markStoppingProduction,
	);
	const clearPending = useProjectOptimisticState((s) => s.clearPending);
	const pending = useProjectOptimisticState(
		(s) => s.pendingByProjectId.get(project.id) ?? null,
	);
	const isDeleting = pending?.action === "deleting";
	const isStoppingPreview = pending?.action === "stopping";
	const isStoppingProduction = pending?.action === "stopping-production";

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
	const isPreviewRunning = project.status === "running" && !isStoppingPreview;
	const isProductionRunning =
		project.productionStatus === "running" &&
		Boolean(project.productionUrl) &&
		!isStoppingProduction;

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

	const handleStopPreview = async () => {
		markStopping(project.id);
		try {
			const result = await actions.projects.stop({ projectId: project.id });
			if (result.error) {
				clearPending(project.id);
				toast.error(result.error.message);
			} else {
				toast.success("Preview stopped");
			}
		} catch {
			clearPending(project.id);
			toast.error("Failed to stop preview");
		}
	};

	const handleStopProduction = async () => {
		markStoppingProduction(project.id);
		try {
			const result = await actions.projects.stopProduction({
				projectId: project.id,
			});
			if (result.error) {
				clearPending(project.id);
				toast.error(result.error.message);
			} else {
				toast.success("Production stopped");
			}
		} catch {
			clearPending(project.id);
			toast.error("Failed to stop production");
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
			<Card className="group/card relative overflow-hidden transition-all duration-300 has-[.top-link:hover]:shadow-lg has-[.top-link:hover]:ring-1 has-[.top-link:hover]:ring-primary/20">
				<a
					href={`/projects/${project.id}/${project.slug}`}
					className="block top-link"
				>
					<CardHeader className="pb-2">
						<CardTitle className="text-lg truncate font-medium transition-all [.top-link:hover_&]:font-bold">
							{project.name}
						</CardTitle>
					</CardHeader>
				</a>
				<CardContent>
					<p className="text-sm text-muted-foreground line-clamp-2 mb-4">
						{project.prompt}
					</p>
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<div className="flex gap-2 flex-wrap items-center min-w-0">
							{isPreviewRunning && (
								<DropdownMenu>
									{/* @ts-expect-error asChild from radix not typed */}
									<DropdownMenuTrigger asChild>
										<button type="button" className="cursor-pointer">
											<Badge variant="info">
												<Plug className="h-3.5 w-3.5" />
												Preview
											</Badge>
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start">
										<DropdownMenuItem asChild className="cursor-pointer">
											<a
												href={previewUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-2 w-full h-full"
											>
												<ExternalLink className="size-4 shrink-0" />
												Visit Preview
											</a>
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={handleStopPreview}
											disabled={isStoppingPreview}
											className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer flex items-center gap-2"
										>
											{isStoppingPreview ? (
												<Loader2 className="size-4 shrink-0 animate-spin" />
											) : (
												<Square className="size-4 shrink-0 fill-current" />
											)}
											<span className="flex-1">Stop Preview</span>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
							{isProductionRunning && project.productionUrl && (
								<DropdownMenu>
									{/* @ts-expect-error asChild from radix not typed */}
									<DropdownMenuTrigger asChild>
										<button type="button" className="cursor-pointer">
											<Badge variant="info">
												<SatelliteDish className="h-3.5 w-3.5" />
												Production
											</Badge>
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start">
										<DropdownMenuItem asChild className="cursor-pointer">
											<a
												href={project.productionUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-2 w-full h-full"
											>
												<ExternalLink className="size-4 shrink-0" />
												Visit Production
											</a>
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={handleStopProduction}
											disabled={isStoppingProduction}
											className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer flex items-center gap-2"
										>
											{isStoppingProduction ? (
												<Loader2 className="size-4 shrink-0 animate-spin" />
											) : (
												<Square className="size-4 shrink-0 fill-current" />
											)}
											<span className="flex-1">Stop Production</span>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
							{!isPreviewRunning && !isProductionRunning && (
								<Badge variant="info">
									<Moon className="h-3.5 w-3.5" />
									Stale
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-1 opacity-0 translate-x-2.5 transition-all duration-200 group-hover/card:opacity-100 group-hover/card:translate-x-0 has-[.top-link:hover]:opacity-100 has-[.top-link:hover]:translate-x-0">
							<div className="flex items-center gap-1">
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={handleExportClick}
											disabled={isDeleting || isExporting}
										>
											{isExporting ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Download className="h-4 w-4" />
											)}
										</Button>
									</TooltipTrigger>
									<TooltipContent>Export source (.zip)</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
											onClick={handleDeleteClick}
											disabled={isDeleting || project.status === "deleting"}
										>
											{isDeleting ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Trash2 className="h-4 w-4" />
											)}
										</Button>
									</TooltipTrigger>
									<TooltipContent>Delete project</TooltipContent>
								</Tooltip>
							</div>
						</div>
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
