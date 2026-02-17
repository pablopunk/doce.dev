import { actions } from "astro:actions";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/server/db/schema";
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
	const [isDeleting, setIsDeleting] = useState(false);

	const previewUrl = `http://localhost:${project.devPort}`;
	const isRunning = project.status === "running";
	const isLoading =
		project.status === "starting" ||
		project.status === "stopping" ||
		project.status === "deleting";

	const handleDeleteClick = () => {
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async (projectId: string) => {
		setIsDeleting(true);
		try {
			const result = await actions.projects.delete({ projectId });
			if (result.error) {
				setIsDeleting(false);
				console.error("Failed to delete project:", result.error.message);
				throw new Error(result.error.message);
			}
			// Optimistic update: notify parent to remove from list
			onDeleted?.(projectId);
		} catch (error) {
			setIsDeleting(false);
			console.error("Failed to delete project:", error);
			throw error;
		}
	};

	return (
		<>
			<Card className="group relative overflow-hidden">
				<CardHeader className="pb-2">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div className="flex-1 min-w-0">
							<CardTitle className="text-lg truncate">{project.name}</CardTitle>
						</div>
						<div className="flex items-center gap-2 sm:ml-2 self-start">
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
						<Button
							variant="ghost"
							size="icon"
							className="text-muted-foreground hover:text-destructive"
							onClick={handleDeleteClick}
							disabled={isDeleting || project.status === "deleting"}
						>
							{isDeleting ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Trash2 className="h-4 w-4" />
							)}
						</Button>
					</div>
					<div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
						<span>Port: {project.devPort}</span>
						{project.model && (
							<span className="ml-3">Model: {project.model}</span>
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
