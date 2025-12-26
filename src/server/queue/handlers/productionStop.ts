import { logger } from "@/server/logger";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { composeDown } from "@/server/docker/compose";
import { writeHostMarker } from "@/server/docker/logs";
import path from "node:path";
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
		const logsDir = path.join(project.pathOnDisk, "logs");
		await writeHostMarker(logsDir, "Stopping production server");

		// Stop the production container using docker compose with the production profile
		const result = await composeDown(project.id, project.pathOnDisk);

		if (!result.success) {
			const errorMsg = `compose down failed: ${result.stderr.slice(0, 500)}`;
			await updateProductionStatus(project.id, "failed", {
				productionError: errorMsg,
			});
			throw new Error(errorMsg);
		}

		logger.info(
			{ projectId: project.id },
			"Production server stopped successfully",
		);

		// Update production status to stopped
		await updateProductionStatus(project.id, "stopped", {
			productionUrl: null,
			productionPort: null,
		});

		await writeHostMarker(logsDir, `exit=${result.exitCode}`);
	} catch (error) {
		throw error;
	}
}
