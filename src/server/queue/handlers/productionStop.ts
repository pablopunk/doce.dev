import { logger } from "@/server/logger";
import { removeProjectNginxConfig } from "@/server/productions/nginx";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
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

		// Remove project from nginx routing
		// This makes the public-facing URL inaccessible
		// Containers continue running so they can be rolled back if needed
		await removeProjectNginxConfig(project.id);

		logger.info(
			{
				projectId: project.id,
				currentHash: currentHash.slice(0, 8),
			},
			"Production server removed from nginx (containers kept alive for rollback)",
		);

		// Update production status to stopped
		// Note: We don't clear the hash, port, or URL - this allows rollback
		await updateProductionStatus(project.id, "stopped");
	} catch (error) {
		logger.error(
			{ projectId: project.id, error },
			"production.stop handler failed",
		);
		throw error;
	}
}
