import { logger } from "@/server/logger";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { updateProductionStatus } from "@/server/productions/productions.model";
import type { QueueJobContext } from "../queue.worker";
import { RescheduleError } from "../queue.worker";
import { parsePayload } from "../types";

const WAIT_TIMEOUT_MS = 300_000; // 5 minutes max wait
const POLL_DELAY_MS = 1_000; // 1 second between polls
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

async function checkProductionReady(port: number): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			HEALTH_CHECK_TIMEOUT_MS,
		);

		const response = await fetch(`http://127.0.0.1:${port}`, {
			signal: controller.signal,
		});

		clearTimeout(timeout);

		// Any HTTP response means the server is up
		return response.status >= 100 && response.status < 600;
	} catch {
		return false;
	}
}

export async function handleProductionWaitReady(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("production.waitReady", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		logger.warn(
			{ projectId: payload.projectId },
			"Project not found for production.waitReady",
		);
		return;
	}

	if (project.status === "deleting") {
		logger.info(
			{ projectId: project.id },
			"Skipping production.waitReady for deleting project",
		);
		return;
	}

	try {
		logger.info(
			{ projectId: project.id, jobId: ctx.job.id, attempts: ctx.job.attempts },
			"production.waitReady handler started",
		);

		await ctx.throwIfCancelRequested();

		// Check if we've timed out
		const elapsed = Date.now() - payload.startedAt;
		if (elapsed > WAIT_TIMEOUT_MS) {
			const errorMsg = `Timed out waiting for production server to be ready (${elapsed}ms of ${WAIT_TIMEOUT_MS}ms allowed)`;
			logger.error(
				{ projectId: project.id, elapsed, maxWait: WAIT_TIMEOUT_MS },
				errorMsg,
			);
			await updateProductionStatus(project.id, "failed", {
				productionError: errorMsg,
			});
			throw new Error(errorMsg);
		}

		// Check if production server is ready
		logger.debug(
			{
				projectId: project.id,
				productionPort: payload.productionPort,
			},
			"Checking if production server is ready",
		);

		const productionReady = await checkProductionReady(payload.productionPort);

		logger.info(
			{
				projectId: project.id,
				productionPort: payload.productionPort,
				productionReady,
				elapsed,
				attempts: ctx.job.attempts,
			},
			"Health check complete",
		);

		if (productionReady) {
			// Set the production URL
			const productionUrl = `http://localhost:${payload.productionPort}`;
			await updateProductionStatus(project.id, "running", {
				productionUrl,
			});

			logger.info(
				{
					projectId: project.id,
					productionUrl,
					elapsed,
					attempts: ctx.job.attempts,
				},
				"Production server is ready",
			);

			return;
		}

		// Check if we've exceeded max reschedule attempts
		if (ctx.job.attempts >= 300) {
			const errorMsg = `Production server failed to become ready after ${ctx.job.attempts} polling attempts (${elapsed}ms elapsed)`;
			logger.error(
				{
					projectId: project.id,
					attempts: ctx.job.attempts,
					elapsed,
					productionReady,
				},
				errorMsg,
			);
			await updateProductionStatus(project.id, "failed", {
				productionError: errorMsg,
			});
			throw new Error(errorMsg);
		}

		// Not ready yet - reschedule
		logger.info(
			{
				projectId: project.id,
				elapsed,
				attempts: ctx.job.attempts,
				productionReady,
				nextRetryIn: POLL_DELAY_MS,
			},
			"Production server not ready, rescheduling",
		);

		ctx.reschedule(POLL_DELAY_MS);
	} catch (error) {
		// Don't catch reschedule errors - those should propagate
		if (error instanceof RescheduleError) {
			throw error;
		}
		throw error;
	}
}
