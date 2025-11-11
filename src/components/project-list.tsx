"use client";

import { actions } from "astro:actions";
import { ArrowUpRight, ExternalLink, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const fetcher = async () => {
	const { data, error } = await actions.projects.getProjects();
	if (error) throw error;
	return data;
};

export function ProjectList() {
	const { data: projects, mutate } = useSWR("projects", fetcher);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

	const handleDeleteClick = (id: string) => {
		setProjectToDelete(id);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (projectToDelete && projects) {
			// Optimistically update UI immediately
			mutate(
				projects.filter((p: any) => p.id !== projectToDelete),
				false, // Don't revalidate yet
			);

			// Close dialog immediately
			setDeleteDialogOpen(false);
			setProjectToDelete(null);

			// Perform actual deletion in background
			try {
				await actions.projects.deleteProject({ id: projectToDelete });
				// Revalidate to ensure consistency
				mutate();
			} catch (error) {
				// On error, revert by revalidating
				console.error("Failed to delete project:", error);
				mutate();
			}
		}
	};

	if (!projects) {
		return <div className="text-center py-8">Loading projects...</div>;
	}

	if (projects.length === 0) {
		return (
			<div className="text-center py-12">
				<h2 className="text-xl font-semibold mb-2">No projects yet</h2>
				<p className="text-muted">Create your first project to get started</p>
			</div>
		);
	}

	return (
		<>
			<motion.div
				className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.3 }}
			>
				<AnimatePresence mode="popLayout">
					{projects.map((project: any, index: number) => (
						<motion.div
							key={project.id}
							layout
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
							transition={{
								duration: 0.3,
								delay: index * 0.05,
								layout: { duration: 0.3 },
							}}
						>
							<Card
								className="relative cursor-pointer hover:bg-raised transition-colors justify-between group"
								onClick={() =>
									(window.location.href = `/project/${project.id}`)
								}
							>
								{/* Arrow in top right */}
								<ArrowUpRight className="h-4 w-4 text-muted absolute top-4 right-4" />

								{/* Title and description */}
								<div className="pr-8 mb-4">
									<h3 className="font-semibold text-xl mb-1 text-strong">
										{project.name}
									</h3>
									{project.description && (
										<p className="text-xs text-muted line-clamp-2">
											{project.description}
										</p>
									)}
								</div>

								{/* Bottom row: date and action buttons */}
								<div className="flex items-center justify-between">
									<div className="text-xs text-muted/60">
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
						</motion.div>
					))}
				</AnimatePresence>
			</motion.div>

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
