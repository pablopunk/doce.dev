import { logger } from "@/server/logger";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { spawnCommand } from "@/server/utils/execAsync";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

export async function handleProductionStop(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("production.stop", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		logger.warn(
			{ projectId: payload.projectId },
			"Project not found for production.stop",
		);
		return;
	}

	if (project.status === "deleting") {
		logger.info(
			{ projectId: project.id },
			"Skipping production.stop for deleting project",
		);
		return;
	}

	try {
		const currentHash = project.productionHash;
		if (!currentHash) {
			logger.warn(
				{ projectId: project.id },
				"No production hash found, skipping stop",
			);
			await updateProductionStatus(project.id, "stopped");
			return;
		}

		const containerName = `doce-prod-${project.id}`;

		// Stop the container
		logger.info(
			{ projectId: project.id, containerName },
			"Stopping production container",
		);

		const stopResult = await spawnCommand("docker", ["stop", containerName]);

		if (!stopResult.success) {
			logger.warn(
				{ projectId: project.id, stderr: stopResult.stderr.slice(0, 200) },
				"Failed to stop production container",
			);
		}

		// Remove the container
		const removeResult = await spawnCommand("docker", ["rm", containerName]);

		if (!removeResult.success) {
			logger.warn(
				{ projectId: project.id, stderr: removeResult.stderr.slice(0, 200) },
				"Failed to remove production container",
			);
		}

		logger.info(
			{
				projectId: project.id,
				currentHash: currentHash.slice(0, 8),
			},
			"Production container stopped",
		);

		// Clean up Docker image (best-effort, don't throw on failure)
		const imageName = `doce-prod-${project.id}-${currentHash}`;
		try {
			const rmiResult = await spawnCommand("docker", ["rmi", imageName]);
			if (rmiResult.success) {
				logger.debug(
					{ projectId: project.id, imageName },
					"Removed Docker image",
				);
			}
		} catch (error) {
			// Image might not exist or be in use, that's okay
			logger.debug(
				{ projectId: project.id, imageName, error },
				"Failed to remove Docker image (might not exist)",
			);
		}

		// Update production status to stopped
		// Keep hash, port, and URL for rollback
		await updateProductionStatus(project.id, "stopped");
	} catch (error) {
		logger.error(
			{ projectId: project.id, error },
			"production.stop handler failed",
		);
		throw error;
	}
}
