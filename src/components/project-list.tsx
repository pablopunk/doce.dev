"use client";

import { ArrowUpRight, ExternalLink, Eye, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ProjectList() {
	const { data: projects, mutate } = useSWR("/api/projects", fetcher);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

	const handleDeleteClick = (id: string) => {
		setProjectToDelete(id);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (projectToDelete) {
			await fetch(`/api/projects/${projectToDelete}`, { method: "DELETE" });
			mutate();
		}
		setDeleteDialogOpen(false);
		setProjectToDelete(null);
	};

	if (!projects) {
		return <div className="text-center py-8">Loading projects...</div>;
	}

	if (projects.length === 0) {
		return (
			<div className="text-center py-12">
				<h2 className="text-xl font-semibold mb-2">No projects yet</h2>
				<p className="text-muted-foreground">
					Create your first project to get started
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
				{projects.map((project: any) => (
					<Card
						key={project.id}
						className="p-4 relative cursor-pointer hover:bg-bg-raised transition-colors justify-between group"
						onClick={() => (window.location.href = `/project/${project.id}`)}
					>
						{/* Arrow in top right */}
						<ArrowUpRight className="h-4 w-4 text-muted-foreground absolute top-4 right-4" />

						{/* Title and description */}
						<div className="pr-8 mb-4">
							<h3 className="font-semibold text-xl mb-1">{project.name}</h3>
							{project.description && (
								<p className="text-xs text-muted-foreground line-clamp-2">
									{project.description}
								</p>
							)}
						</div>

						{/* Bottom row: date and action buttons */}
						<div className="flex items-center justify-between">
							<div className="text-xs text-muted-foreground">
								Updated {new Date(project.updated_at).toLocaleDateString()}
							</div>
							<div className="flex items-center gap-1">
								{project.deployed_url && (
									<Button
										asChild
										variant="ghost"
										size="icon-sm"
										onClick={(e) => e.stopPropagation()}
									>
										<a
											href={project.deployed_url}
											target="_blank"
											rel="noopener noreferrer"
										>
											<ExternalLink className="h-4 w-4" />
										</a>
									</Button>
								)}
								<Button
									variant="ghost"
									size="icon-sm"
									className="opacity-0 group-hover:opacity-100 transition-opacity"
									onClick={(e) => {
										e.stopPropagation();
										handleDeleteClick(project.id);
									}}
								>
									<Trash2 className="h-4 w-1" />
								</Button>
							</div>
						</div>
					</Card>
				))}
			</div>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Project</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this project? This action cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className={cn(buttonVariants({ variant: "destructive" }))}
							onClick={handleDeleteConfirm}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
