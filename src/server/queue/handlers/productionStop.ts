import path from "node:path";
import { composeDownProduction } from "@/server/docker/compose";
import { writeHostMarker } from "@/server/docker/logs";
import { logger } from "@/server/logger";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProductionPath } from "@/server/projects/paths";
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
		// Get current hash from database
		const currentHash = project.productionHash;
		if (!currentHash) {
			logger.warn(
				{ projectId: project.id },
				"No production hash found, skipping stop",
			);
			await updateProductionStatus(project.id, "stopped", {
				productionUrl: null,
				productionPort: null,
			});
			return;
		}

		// Use hash-versioned production path
		const productionPath = getProductionPath(project.id, currentHash);
		const logsDir = path.join(productionPath, "logs");

		try {
			await writeHostMarker(logsDir, "Stopping production server");
		} catch (error) {
			// Log directory might not exist if stop is called before setup completes
			logger.debug({ projectId: project.id }, "Could not write host marker");
		}

		// Stop the production container using the current hash's project name
		const result = await composeDownProduction(
			project.id,
			productionPath,
			currentHash,
		);

		if (!result.success) {
			const errorMsg = `compose down failed: ${result.stderr.slice(0, 500)}`;
			await updateProductionStatus(project.id, "failed", {
				productionError: errorMsg,
			});
			throw new Error(errorMsg);
		}

		logger.info(
			{ projectId: project.id, currentHash },
			"Production server stopped successfully",
		);

		// Update production status to stopped (keep hash for rollback history)
		await updateProductionStatus(project.id, "stopped", {
			productionUrl: null,
			productionPort: null,
		});

		try {
			await writeHostMarker(logsDir, `exit=${result.exitCode}`);
		} catch (error) {
			logger.debug({ projectId: project.id }, "Could not write exit marker");
		}
	} catch (error) {
		throw error;
	}
}
