import * as fs from "node:fs/promises";
import { composeDownWithVolumes } from "@/server/docker/compose";
import { logger } from "@/server/logger";
import { normalizeProjectPath } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	hardDeleteProject,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { spawnCommand } from "@/server/utils/execAsync";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

/**
 * Delete a project asynchronously via the queue system.
 *
 * Deletion steps (in order):
 * 1. Mark status as "deleting" to prevent new operations
 * 2. Stop and remove Docker containers + volumes (best-effort)
 * 3. Delete project files from disk (best-effort)
 * 4. Hard-delete from database (critical, must succeed)
 *
 * Each step can be cancelled via ctx.throwIfCancelRequested().
 * Best-effort steps continue on failure. The DB deletion is critical
 * and will cause job failure if it fails, triggering retries.
 */
export async function handleProjectDelete(ctx: QueueJobContext): Promise<void> {
	const payload = parsePayload("project.delete", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		logger.info(
			{ projectId: payload.projectId },
			"Project not found, skipping delete",
		);
		return;
	}

	await ctx.throwIfCancelRequested();

	// Step 1: Update status to "deleting" to prevent new operations
	try {
		await updateProjectStatus(project.id, "deleting");
		logger.debug({ projectId: project.id }, "Project marked as deleting");
	} catch (error) {
		// Non-critical: status update failure doesn't block deletion
		logger.warn(
			{ error, projectId: project.id },
			"Failed to update project status to deleting",
		);
	}

	await ctx.throwIfCancelRequested();

	// Step 2: Stop and remove Docker containers (best-effort)
	try {
		// Stop dev containers (preview + opencode)
		await composeDownWithVolumes(project.id, project.pathOnDisk);
		logger.debug(
			{ projectId: project.id },
			"Dev containers stopped (preview + opencode)",
		);

		// Stop production container
		const containerName = `doce-prod-${project.id}`;
		const stopResult = await spawnCommand("docker", ["stop", containerName]);
		const removeResult = await spawnCommand("docker", ["rm", containerName]);

		if (stopResult.success && removeResult.success) {
			logger.debug(
				{ projectId: project.id, containerName },
				"Production container stopped and removed",
			);
		}

		// Clean up Docker images (best-effort)
		const imagePrefix = `doce-prod-${project.id}-`;
		const listResult = await spawnCommand("docker", [
			"images",
			imagePrefix,
			"--format",
			"{{.Repository}}:{{.Tag}}",
		]);

		if (listResult.success && listResult.stdout) {
			const images = listResult.stdout.trim().split("\n").filter(Boolean);
			for (const image of images) {
				await spawnCommand("docker", ["rmi", image]);
				logger.debug({ projectId: project.id, image }, "Removed Docker image");
			}
		}
	} catch (error) {
		// Non-critical: Docker might not be available or already stopped
		logger.warn(
			{ error, projectId: project.id },
			"Failed to stop Docker containers or remove images",
		);
	}

	await ctx.throwIfCancelRequested();

	// Step 3: Delete project files from disk (best-effort)
	try {
		const projectDir = normalizeProjectPath(project.pathOnDisk);
		await fs.rm(projectDir, { recursive: true, force: true });
		logger.debug({ projectId: project.id }, "Deleted project directory");
	} catch (error) {
		// Non-critical: file system issues don't block database deletion
		// The directory might have permission issues, be on a different volume, etc.
		logger.warn(
			{ error, projectId: project.id },
			"Failed to delete project directory from disk",
		);
	}

	await ctx.throwIfCancelRequested();

	// Step 4: Hard-delete from database (CRITICAL - must succeed)
	// If this fails, the job will be retried automatically
	try {
		await hardDeleteProject(project.id);
		logger.info(
			{ projectId: project.id },
			"Project hard-deleted from database",
		);
	} catch (error) {
		// Critical: database deletion is required for operation success
		// Log error and throw to trigger job retry
		logger.error(
			{ error, projectId: project.id },
			"Failed to hard-delete project from database - job will retry",
		);
		throw error;
	}
}
