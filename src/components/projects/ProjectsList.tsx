import { Loader2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/server/db/schema";
import { useProjectOptimisticState } from "@/stores/useProjectOptimisticState";
import { ProjectCard } from "./ProjectCard";

interface ProjectsListProps {
	fallback: Project[];
}

/**
 * Projects list component.
 *
 * Intentionally does not poll. We prefer explicit navigation / optimistic UI
 * over background list polling.
 */
export function ProjectsList({ fallback }: ProjectsListProps) {
	const [deletedProjectIds, setDeletedProjectIds] = useState<Set<string>>(
		new Set(),
	);

	const creatingDraftsMap = useProjectOptimisticState((s) => s.creatingDrafts);
	const pendingByProjectId = useProjectOptimisticState(
		(s) => s.pendingByProjectId,
	);

	const creatingDrafts = useMemo(
		() => Array.from(creatingDraftsMap.values()),
		[creatingDraftsMap],
	);

	const filteredProjects = useMemo(
		() =>
			fallback.filter(
				(project) =>
					!deletedProjectIds.has(project.id) &&
					pendingByProjectId.get(project.id)?.action !== "deleting",
			),
		[fallback, deletedProjectIds, pendingByProjectId],
	);

	const handleProjectDeleted = (projectId: string) => {
		setDeletedProjectIds((prev) => new Set([...prev, projectId]));
	};

	const hasDrafts = creatingDrafts.length > 0;
	const hasProjects = filteredProjects.length > 0;

	if (!hasDrafts && !hasProjects) {
		return null;
	}

	return (
		<section className="container mx-auto p-8 relative">
			<h2 className="mb-4 text-xl font-semibold">Your Projects</h2>
			<LayoutGroup>
				<motion.div
					className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
					id="projects-grid"
				>
					<AnimatePresence>
						{/* Optimistic draft cards for projects being created */}
						{creatingDrafts.map((draft) => (
							<motion.div
								key={draft.id}
								layout
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.8 }}
								transition={{ duration: 0.2 }}
							>
								<CreatingDraftCard prompt={draft.prompt} />
							</motion.div>
						))}

						{filteredProjects.map((project) => (
							<motion.div
								key={project.id}
								data-project-id={project.id}
								layout
								exit={{ opacity: 0, scale: 0.8 }}
								transition={{ duration: 0.2 }}
							>
								<ProjectCard
									project={project}
									onDeleted={handleProjectDeleted}
								/>
							</motion.div>
						))}
					</AnimatePresence>
				</motion.div>
			</LayoutGroup>
		</section>
	);
}

function CreatingDraftCard({ prompt }: { prompt: string }) {
	return (
		<Card className="relative overflow-hidden opacity-80">
			<CardHeader className="pb-2">
				<div className="flex items-center gap-2 overflow-hidden">
					<div className="min-w-0 flex-1">
						<CardTitle className="text-lg truncate">
							Creating project...
						</CardTitle>
					</div>
					<div className="shrink-0">
						<span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap bg-accent text-accent-foreground">
							<Loader2 className="h-3 w-3 animate-spin" />
							Creating...
						</span>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground line-clamp-2 mb-4">
					{prompt}
				</p>
			</CardContent>
		</Card>
	);
}
