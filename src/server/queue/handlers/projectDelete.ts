import * as fs from "node:fs/promises";
import { composeDownWithVolumes } from "@/server/docker/compose";
import { logger } from "@/server/logger";
import {
	getProjectPreviewPath,
	normalizeProjectPath,
} from "@/server/projects/paths";
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

	const projectDir = normalizeProjectPath(project.pathOnDisk);
	let cleanupPerformed = false;

	try {
		// Step 1: Mark status as "deleting" (best-effort)
		try {
			await updateProjectStatus(project.id, "deleting");
			logger.debug({ projectId: project.id }, "Project marked as deleting");
		} catch (error) {
			logger.warn(
				{ error, projectId: project.id },
				"Failed to update project status to deleting",
			);
		}

		await ctx.throwIfCancelRequested();

		// Step 2: Stop and remove Docker containers (best-effort)
		try {
			// Stop dev containers (preview + opencode)
			const previewPath = getProjectPreviewPath(project.id);
			await composeDownWithVolumes(project.id, previewPath);
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
					logger.debug(
						{ projectId: project.id, image },
						"Removed Docker image",
					);
				}
			}
		} catch (error) {
			logger.warn(
				{ error, projectId: project.id },
				"Failed to stop Docker containers or remove images",
			);
		}

		await ctx.throwIfCancelRequested();

		// Step 3: Delete project files from disk (best-effort)
		try {
			await fs.rm(projectDir, { recursive: true, force: true });
			logger.debug({ projectId: project.id }, "Deleted project directory");
		} catch (error) {
			logger.warn(
				{ error, projectId: project.id },
				"Failed to delete project directory from disk",
			);
		}

		await ctx.throwIfCancelRequested();

		// Step 4: Hard-delete from database (CRITICAL - must succeed)
		await hardDeleteProject(project.id);
		logger.info(
			{ projectId: project.id },
			"Project hard-deleted from database",
		);

		cleanupPerformed = true;
	} catch (error) {
		if (!cleanupPerformed) {
			logger.debug({ projectId: project.id }, "Cleanup release triggered");
		}
		throw error;
	}
}
