import { actions } from "astro:actions";
import {
	Download,
	ExternalLink,
	Loader2,
	Moon,
	Pencil,
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBaseUrlSetting } from "@/hooks/useBaseUrlSetting";
import { getPreferredRuntimeUrl } from "@/lib/base-url";
import { useProjectOptimisticState } from "@/stores/useProjectOptimisticState";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { ProjectIcon } from "./ProjectIcon";
import { ProjectIconPicker } from "./ProjectIconPicker";
import type { ProjectListItem } from "./projects.types";

interface ProjectCardProps {
	project: ProjectListItem;
	onDeleted?: (projectId: string) => void;
}

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [isSavingIdentity, setIsSavingIdentity] = useState(false);
	const [displayName, setDisplayName] = useState(project.name);
	const [displayIcon, setDisplayIcon] = useState(project.icon);
	const [editName, setEditName] = useState(project.name);
	const [editIcon, setEditIcon] = useState(project.icon);
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
	const previewUrls = project.previewUrls ?? {
		local: `http://localhost:${project.devPort}`,
		tailscale: project.previewUrl,
		preferred: rawPreviewUrl,
	};
	const productionUrls = project.productionUrls ?? {
		local: project.productionPort
			? `http://localhost:${project.productionPort}`
			: null,
		tailscale: null,
		preferred: project.productionUrl,
	};
	const previewUrl =
		typeof window === "undefined"
			? (previewUrls.preferred ?? rawPreviewUrl)
			: (getPreferredRuntimeUrl(previewUrls, baseUrl, window.location.origin) ??
				rawPreviewUrl);
	const productionUrl =
		typeof window === "undefined"
			? (productionUrls.preferred ?? project.productionUrl)
			: getPreferredRuntimeUrl(productionUrls, baseUrl, window.location.origin);
	const isPreviewRunning = project.status === "running" && !isStoppingPreview;
	const isProductionRunning =
		project.productionStatus === "running" &&
		Boolean(productionUrl) &&
		!isStoppingProduction;

	const handleDeleteClick = () => {
		setIsDeleteDialogOpen(true);
	};

	const handleEditClick = () => {
		setEditName(displayName);
		setEditIcon(displayIcon);
		setIsEditDialogOpen(true);
	};

	const handleSaveIdentity = async () => {
		const name = editName.trim();
		if (!name) {
			toast.error("Project name is required");
			return;
		}

		setIsSavingIdentity(true);
		try {
			const result = await actions.projects.updateIdentity({
				projectId: project.id,
				name,
				icon: editIcon,
			});
			if (result.error) {
				toast.error(result.error.message);
				return;
			}

			setDisplayName(name);
			setDisplayIcon(editIcon);
			setIsEditDialogOpen(false);
			toast.success("Project updated");
		} catch {
			toast.error("Failed to update project");
		} finally {
			setIsSavingIdentity(false);
		}
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

	const hasAlternatePreviewUrls =
		Boolean(previewUrls.local && previewUrls.local !== previewUrl) ||
		Boolean(previewUrls.tailscale && previewUrls.tailscale !== previewUrl);
	const hasAlternateProductionUrls =
		Boolean(productionUrls.local && productionUrls.local !== productionUrl) ||
		Boolean(
			productionUrls.tailscale && productionUrls.tailscale !== productionUrl,
		);

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

			toast.success(`Exported ${displayName}`);
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
				<div className="absolute top-3 right-3 z-10 flex items-center gap-1 opacity-0 translate-x-2 transition-all duration-200 group-hover/card:opacity-100 group-hover/card:translate-x-0 focus-within:opacity-100 focus-within:translate-x-0">
					<Tooltip>
						{/* @ts-expect-error asChild from radix not typed */}
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 bg-card/80 backdrop-blur-sm"
								onClick={handleEditClick}
								disabled={isDeleting || isSavingIdentity}
							>
								{isSavingIdentity ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Pencil className="h-4 w-4" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Edit project</TooltipContent>
					</Tooltip>

					<Tooltip>
						{/* @ts-expect-error asChild from radix not typed */}
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 bg-card/80 backdrop-blur-sm"
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
						{/* @ts-expect-error asChild from radix not typed */}
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 bg-card/80 text-destructive backdrop-blur-sm hover:text-destructive hover:bg-destructive/10"
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
				<a
					href={`/projects/${project.id}/${project.slug}`}
					className="block top-link"
				>
					<CardHeader className="pb-2 pr-32">
						<div className="flex items-center gap-3 min-w-0">
							<ProjectIcon
								icon={displayIcon}
								name={displayName}
								className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs"
							/>
							<CardTitle className="text-lg truncate font-medium transition-all [.top-link:hover_&]:font-bold">
								{displayName}
							</CardTitle>
						</div>
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
										{/* @ts-expect-error asChild from radix not typed */}
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
										{hasAlternatePreviewUrls && previewUrls.local && (
											// @ts-expect-error asChild from radix not typed
											<DropdownMenuItem asChild className="cursor-pointer">
												<a
													href={previewUrls.local}
													target="_blank"
													rel="noopener noreferrer"
													className="flex items-center gap-2 w-full h-full"
												>
													<ExternalLink className="size-4 shrink-0" />
													Visit Preview locally
												</a>
											</DropdownMenuItem>
										)}
										{hasAlternatePreviewUrls && previewUrls.tailscale && (
											// @ts-expect-error asChild from radix not typed
											<DropdownMenuItem asChild className="cursor-pointer">
												<a
													href={previewUrls.tailscale}
													target="_blank"
													rel="noopener noreferrer"
													className="flex items-center gap-2 w-full h-full"
												>
													<ExternalLink className="size-4 shrink-0" />
													Visit Preview via Tailscale
												</a>
											</DropdownMenuItem>
										)}
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
							{isProductionRunning && productionUrl && (
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
										{/* @ts-expect-error asChild from radix not typed */}
										<DropdownMenuItem asChild className="cursor-pointer">
											<a
												href={productionUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-2 w-full h-full"
											>
												<ExternalLink className="size-4 shrink-0" />
												Visit Production
											</a>
										</DropdownMenuItem>
										{hasAlternateProductionUrls && productionUrls.local && (
											// @ts-expect-error asChild from radix not typed
											<DropdownMenuItem asChild className="cursor-pointer">
												<a
													href={productionUrls.local}
													target="_blank"
													rel="noopener noreferrer"
													className="flex items-center gap-2 w-full h-full"
												>
													<ExternalLink className="size-4 shrink-0" />
													Visit Production locally
												</a>
											</DropdownMenuItem>
										)}
										{hasAlternateProductionUrls && productionUrls.tailscale && (
											// @ts-expect-error asChild from radix not typed
											<DropdownMenuItem asChild className="cursor-pointer">
												<a
													href={productionUrls.tailscale}
													target="_blank"
													rel="noopener noreferrer"
													className="flex items-center gap-2 w-full h-full"
												>
													<ExternalLink className="size-4 shrink-0" />
													Visit Production via Tailscale
												</a>
											</DropdownMenuItem>
										)}
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
								<Tooltip>
									{/* @ts-expect-error asChild from radix not typed */}
									<TooltipTrigger asChild>
										<Badge variant="info" aria-label="Stale">
											<Moon className="h-3.5 w-3.5" />
										</Badge>
									</TooltipTrigger>
									<TooltipContent>Stale (open project to start)</TooltipContent>
								</Tooltip>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit project</DialogTitle>
						<DialogDescription>
							Update the display name and icon for this project.
						</DialogDescription>
					</DialogHeader>

					<div className="flex items-center gap-3 py-2">
						<ProjectIconPicker value={editIcon} onChange={setEditIcon} />
						<Input
							value={editName}
							onChange={(event) => setEditName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									void handleSaveIdentity();
								}
							}}
							maxLength={64}
							placeholder="Project name"
							disabled={isSavingIdentity}
							autoFocus
						/>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsEditDialogOpen(false)}
							disabled={isSavingIdentity}
						>
							Cancel
						</Button>
						<Button onClick={handleSaveIdentity} disabled={isSavingIdentity}>
							{isSavingIdentity && <Loader2 className="h-4 w-4 animate-spin" />}
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<DeleteProjectDialog
				projectId={project.id}
				projectName={displayName}
				isOpen={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDeleteConfirm}
				isDeleting={isDeleting}
			/>
		</>
	);
}
