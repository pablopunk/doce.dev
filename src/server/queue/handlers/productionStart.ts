import { allocatePort } from "@/server/ports/allocate";
import { composeUpProduction } from "@/server/docker/compose";
import { logger } from "@/server/logger";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { enqueueProductionWaitReady } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

export async function handleProductionStart(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("production.start", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		logger.warn(
			{ projectId: payload.projectId },
			"Project not found for production.start",
		);
		return;
	}

	if (project.status === "deleting") {
		logger.info(
			{ projectId: project.id },
			"Skipping production.start for deleting project",
		);
		return;
	}

	try {
		// Allocate production port
		const productionPort = await allocatePort();
		logger.info(
			{ projectId: project.id, productionPort },
			"Allocated production port",
		);

		await ctx.throwIfCancelRequested();

		// Start production container using docker compose with the production profile
		// This will run: pnpm install --prod && pnpm run build && pnpm run preview --host
		const result = await composeUpProduction(
			project.id,
			project.pathOnDisk,
			productionPort,
		);

		if (!result.success) {
			const errorMsg = `compose up failed: ${result.stderr.slice(0, 500)}`;
			await updateProductionStatus(project.id, "failed", {
				productionError: errorMsg,
			});
			throw new Error(errorMsg);
		}

		logger.info(
			{ projectId: project.id, productionPort },
			"Docker compose up succeeded for production",
		);

		// Update production status with port (status still "building" until waitReady confirms)
		await updateProductionStatus(project.id, "building", {
			productionPort,
			productionStartedAt: new Date(),
		});

		// Enqueue next step: wait for production server to be ready
		await enqueueProductionWaitReady({
			projectId: project.id,
			productionPort,
			startedAt: Date.now(),
			rescheduleCount: 0,
		});

		logger.debug(
			{ projectId: project.id, productionPort },
			"Enqueued production.waitReady",
		);
	} catch (error) {
		throw error;
	}
}
