import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import type { Project } from "@/server/db/schema";
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

	const displayProjects = fallback;
	const filteredProjects = displayProjects.filter(
		(project) => !deletedProjectIds.has(project.id),
	);

	const handleProjectDeleted = (projectId: string) => {
		setDeletedProjectIds((prev) => new Set([...prev, projectId]));
	};

	if (!filteredProjects || filteredProjects.length === 0) {
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
