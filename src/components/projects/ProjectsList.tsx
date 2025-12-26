import { useState, useEffect } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { actions } from "astro:actions";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "@/server/db/schema";

interface ProjectsListProps {
	fallback: Project[];
}

/**
 * Projects list component with Astro Actions polling
 * Polls every 30 seconds for new projects
 * Animates list changes with Motion layout animations
 */
export function ProjectsList({ fallback }: ProjectsListProps) {
	const [projects, setProjects] = useState<Project[]>(fallback);
	const [error, setError] = useState<string | null>(null);
	const [deletedProjectIds, setDeletedProjectIds] = useState<Set<string>>(new Set());

	useEffect(() => {
		// Initial fetch
		const fetchProjects = async () => {
			try {
				const result = await actions.projects.list();
				if (result.error) {
					setError(result.error.message);
				} else if (result.data) {
					setProjects(result.data.projects);
					setError(null);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load projects");
			}
		};

		fetchProjects();

		// Poll every 30 seconds
		const interval = setInterval(fetchProjects, 30000);

		return () => clearInterval(interval);
	}, []);

	if (error) {
		return (
			<div className="container mx-auto p-8">
				<p className="text-destructive">{error}</p>
			</div>
		);
	}

	const displayProjects = projects && projects.length > 0 ? projects : fallback;
	const filteredProjects = displayProjects.filter(
		(project) => !deletedProjectIds.has(project.id)
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
				<motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" id="projects-grid">
					<AnimatePresence>
						{filteredProjects.map((project) => (
							<motion.div
								key={project.id}
								data-project-id={project.id}
								layout
								exit={{ opacity: 0, scale: 0.8 }}
								transition={{ duration: 0.2 }}
							>
								<ProjectCard project={project} onDeleted={handleProjectDeleted} />
							</motion.div>
						))}
					</AnimatePresence>
				</motion.div>
			</LayoutGroup>
		</section>
	);
}
