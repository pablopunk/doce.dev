import { useProjects } from "@/hooks/useProjects";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "@/server/db/schema";

interface ProjectsListProps {
	fallback: Project[];
}

/**
 * Projects list component that uses SWR for data management
 * Handles automatic refetching and cache invalidation
 */
export function ProjectsList({ fallback }: ProjectsListProps) {
	const { projects, error } = useProjects(fallback);

	if (error) {
		return (
			<div className="container mx-auto p-8">
				<p className="text-destructive">Failed to load projects</p>
			</div>
		);
	}

	const displayProjects = projects ?? fallback;

	if (!displayProjects || displayProjects.length === 0) {
		return null;
	}

	return (
		<section className="container mx-auto p-8">
			<h2 className="mb-4 text-xl font-semibold">Your Projects</h2>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" id="projects-grid">
				{displayProjects.map((project) => (
					<div key={project.id} data-project-id={project.id}>
						<ProjectCard project={project} />
					</div>
				))}
			</div>
		</section>
	);
}
