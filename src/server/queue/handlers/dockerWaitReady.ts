import { pushAuthToContainer } from "@/server/docker/pushAuth";
import { logger } from "@/server/logger";
import {
	checkOpencodeReady,
	checkPreviewReady,
} from "@/server/projects/health";
import {
	getProjectByIdIncludeDeleted,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { enqueueOpencodeSessionCreate } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { RescheduleError } from "../queue.worker";
import { parsePayload } from "../types";

const WAIT_TIMEOUT_MS = 300_000; // 5 minutes max wait
const POLL_DELAY_MS = 1_000; // 1 second between polls

export async function handleDockerWaitReady(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("docker.waitReady", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		logger.warn(
			{ projectId: payload.projectId },
			"Project not found for docker.waitReady",
		);
		return;
	}

	if (project.status === "deleting") {
		logger.info(
			{ projectId: project.id },
			"Skipping docker.waitReady for deleting project",
		);
		return;
	}

	try {
		logger.info(
			{ projectId: project.id, jobId: ctx.job.id, attempts: ctx.job.attempts },
			"docker.waitReady handler started",
		);

		await ctx.throwIfCancelRequested();

		// Check if we've timed out
		const elapsed = Date.now() - payload.startedAt;
		if (elapsed > WAIT_TIMEOUT_MS) {
			const errorMsg = `Timed out waiting for services to be ready (${elapsed}ms of ${WAIT_TIMEOUT_MS}ms allowed)`;
			logger.error(
				{ projectId: project.id, elapsed, maxWait: WAIT_TIMEOUT_MS },
				errorMsg,
			);
			await updateProjectStatus(project.id, "error");
			throw new Error(errorMsg);
		}

		// Check if services are ready
		logger.debug(
			{
				projectId: project.id,
			},
			"Checking if services are ready",
		);

		const [previewReady, opencodeReady] = await Promise.all([
			checkPreviewReady(project.id),
			checkOpencodeReady(project.id),
		]);

		logger.info(
			{
				projectId: project.id,
				previewReady,
				opencodeReady,
				elapsed,
				attempts: ctx.job.attempts,
			},
			"Health check complete",
		);

		if (previewReady && opencodeReady) {
			// Push auth.json to OpenCode container
			await pushAuthToContainer(project.id);

			await updateProjectStatus(project.id, "running");
			logger.info(
				{ projectId: project.id, elapsed, attempts: ctx.job.attempts },
				"Services are ready",
			);

			// Only enqueue bootstrap jobs if initial prompt hasn't been sent yet
			if (!project.initialPromptSent) {
				await enqueueOpencodeSessionCreate({ projectId: project.id });
				logger.info(
					{ projectId: project.id },
					"Enqueued opencode.sessionCreate",
				);
			}

			return;
		}

		// Check if we've exceeded max reschedule attempts (10 attempts = ~10 seconds of polling)
		if (ctx.job.attempts >= 10) {
			const errorMsg = `Services failed to become ready after ${ctx.job.attempts} polling attempts (${elapsed}ms elapsed)`;
			logger.error(
				{
					projectId: project.id,
					attempts: ctx.job.attempts,
					elapsed,
					previewReady,
					opencodeReady,
				},
				errorMsg,
			);
			await updateProjectStatus(project.id, "error");
			throw new Error(errorMsg);
		}

		// Not ready yet - reschedule
		logger.info(
			{
				projectId: project.id,
				elapsed,
				attempts: ctx.job.attempts,
				previewReady,
				opencodeReady,
				nextRetryIn: POLL_DELAY_MS,
			},
			"Services not ready, rescheduling",
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
