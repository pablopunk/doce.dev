import { logger } from "@/server/logger";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import type { Project } from "@/server/db/schema";

/**
 * Helper to fetch a project and skip processing if not found or marked for deletion.
 * Used in queue handlers to safely get project context.
 *
 * Returns the project if found and not deleting, otherwise logs and returns null.
 */
export async function getProjectOrSkip(
	projectId: string,
	handlerName: string,
): Promise<Project | null> {
	const project = await getProjectByIdIncludeDeleted(projectId);

	if (!project) {
		logger.warn({ projectId }, `Project not found for ${handlerName}`);
		return null;
	}

	if (project.status === "deleting") {
		logger.info(
			{ projectId: project.id },
			`Skipping ${handlerName} for deleting project`,
		);
		return null;
	}

	return project;
}
