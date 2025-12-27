import * as fs from "node:fs/promises";
import { composeDownWithVolumes } from "@/server/docker/compose";
import { logger } from "@/server/logger";
import { getProjectPath, getProductionPath } from "./paths";
import {
	getProjectById,
	getProjectsByUserId,
	hardDeleteProject,
	updateProjectStatus,
} from "./projects.model";

export interface DeleteProjectResult {
	success: boolean;
	error?: string;
}

/**
 * Delete a project completely.
 * This handles:
 * 1. Stop and remove Docker containers + volumes
 * 2. Delete project directory
 * 3. Delete production directory
 * 4. Remove DB record (final, atomic step)
 *
 * Note: This function does synchronous deletion. For long-running deletions,
 * use the queue system (enqueueProjectDelete) instead, which handles the
 * operation asynchronously with better cancellation support.
 */
export async function deleteProject(
	projectId: string,
): Promise<DeleteProjectResult> {
	logger.info({ projectId }, "Deleting project");

	// Get project from DB
	const project = await getProjectById(projectId);
	if (!project) {
		return { success: false, error: "Project not found" };
	}

	const projectPath = getProjectPath(projectId);

	// Step 1: Stop and remove Docker containers
	// This is best-effort since Docker might not be available
	try {
		await composeDownWithVolumes(projectId, projectPath);
		logger.debug({ projectId }, "Docker compose down completed");
	} catch (err) {
		logger.warn(
			{ error: err, projectId },
			"Failed to stop Docker containers (continuing with file deletion)",
		);
		// Continue - Docker failure doesn't block deletion
	}

	// Step 2: Delete project directory
	// This is best-effort since the directory might have permission issues
	try {
		await fs.rm(projectPath, { recursive: true, force: true });
		logger.debug({ projectId, projectPath }, "Deleted project directory");
	} catch (err) {
		logger.warn(
			{ error: err, projectId },
			"Failed to delete project directory (continuing with production deletion)",
		);
		// Continue - file deletion doesn't block database deletion
	}

	// Step 3: Delete production directory
	// This is best-effort since production might not exist
	try {
		const productionPath = getProductionPath(projectId);
		await fs.rm(productionPath, { recursive: true, force: true });
		logger.debug({ projectId, productionPath }, "Deleted production directory");
	} catch (err) {
		logger.warn(
			{ error: err, projectId },
			"Failed to delete production directory (continuing with DB deletion)",
		);
		// Continue - file deletion doesn't block database deletion
	}

	// Step 4: Remove from database (critical step - must succeed)
	// This is the final, atomic operation. If this fails, abort the deletion.
	try {
		await hardDeleteProject(projectId);
		logger.info({ projectId }, "Project deleted from database");
	} catch (err) {
		logger.error(
			{ error: err, projectId },
			"Failed to delete project from database - deletion aborted",
		);
		// Return error - DB deletion is required for operation success
		return {
			success: false,
			error:
				err instanceof Error ? err.message : "Failed to delete from database",
		};
	}

	// Success: All critical steps completed
	return { success: true };
}

/**
 * Delete all projects for a user.
 */
export async function deleteAllProjectsForUser(
	userId: string,
): Promise<{ success: boolean; deleted: number; errors: string[] }> {
	logger.info({ userId }, "Deleting all projects for user");

	const projects = await getProjectsByUserId(userId);
	const errors: string[] = [];
	let deleted = 0;

	for (const project of projects) {
		const result = await deleteProject(project.id);
		if (result.success) {
			deleted++;
		} else {
			errors.push(`Failed to delete ${project.name}: ${result.error}`);
		}
	}

	logger.info(
		{ userId, deleted, errors: errors.length },
		"Finished deleting all projects",
	);

	return { success: errors.length === 0, deleted, errors };
}

/**
 * Stop a project's containers without deleting.
 */
export async function stopProject(
	projectId: string,
): Promise<DeleteProjectResult> {
	logger.info({ projectId }, "Stopping project");

	const project = await getProjectById(projectId);
	if (!project) {
		return { success: false, error: "Project not found" };
	}

	const projectPath = getProjectPath(projectId);

	try {
		await updateProjectStatus(projectId, "stopping");

		// Import composeDown to avoid circular dependency
		const { composeDown } = await import("@/server/docker/compose");
		const result = await composeDown(projectId, projectPath);

		if (result.success) {
			await updateProjectStatus(projectId, "stopped");
			logger.info({ projectId }, "Project stopped");
			return { success: true };
		} else {
			await updateProjectStatus(projectId, "error");
			return {
				success: false,
				error: `Docker compose down failed: ${result.stderr.slice(0, 200)}`,
			};
		}
	} catch (err) {
		await updateProjectStatus(projectId, "error");
		logger.error({ error: err, projectId }, "Failed to stop project");
		return {
			success: false,
			error:
				err instanceof Error ? err.message : "Unknown error stopping project",
		};
	}
}
