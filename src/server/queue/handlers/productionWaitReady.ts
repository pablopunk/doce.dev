import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
	checkDockerContainerReady,
	checkHttpServerReady,
} from "@/server/health/checkHealthEndpoint";
import { logger } from "@/server/logger";
import { cleanupOldProductionVersions } from "@/server/productions/cleanup";
import {
	getPreviousReleaseHash,
	updateProductionStatus,
} from "@/server/productions/productions.model";
import {
	getProductionCurrentSymlink,
	getProductionPath,
} from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

const WAIT_TIMEOUT_MS = 300_000; // 5 minutes max wait
const POLL_DELAY_MS = 1_000; // 1 second between polls
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

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

	logger.info(
		{ projectId: project.id, jobId: ctx.job.id, attempts: ctx.job.attempts },
		"production.waitReady handler started",
	);

	await ctx.throwIfCancelRequested();

	const elapsed = Date.now() - payload.startedAt;

	if (elapsed > WAIT_TIMEOUT_MS) {
		const errorMsg = `Timed out waiting for production server to be ready (${Math.round(elapsed / 1000)}s of ${WAIT_TIMEOUT_MS / 1000}s allowed)`;
		logger.error(
			{ projectId: project.id, elapsed, maxWait: WAIT_TIMEOUT_MS },
			errorMsg,
		);

		await rollbackOrFail(project.id, payload.productionHash, errorMsg);
		return; // Terminal — job completes, no retry
	}

	const httpReady = await checkHttpServerReady(
		payload.productionPort,
		HEALTH_CHECK_TIMEOUT_MS,
	);

	const containerName = `doce-prod-${project.id}`;
	const dockerReady = await checkDockerContainerReady(containerName);
	const productionReady = httpReady || dockerReady;

	logger.info(
		{
			projectId: project.id,
			productionPort: payload.productionPort,
			httpReady,
			dockerReady,
			containerName,
			productionReady,
			elapsed,
			attempts: ctx.job.attempts,
		},
		"Health check complete",
	);

	if (productionReady) {
		await promoteRelease(project.id, payload.productionHash);

		const productionUrl = `http://localhost:${payload.productionPort}`;
		await updateProductionStatus(project.id, "running", {
			productionUrl,
		});

		cleanupOldProductionVersions(project.id, 2).catch((error) => {
			logger.warn(
				{ projectId: project.id, error },
				"Failed to cleanup old production versions",
			);
		});

		logger.info(
			{
				projectId: project.id,
				productionUrl,
				elapsed,
				attempts: ctx.job.attempts,
			},
			"Production server is ready and promoted",
		);

		return;
	}

	logger.debug(
		{
			projectId: project.id,
			elapsed,
			attempts: ctx.job.attempts,
			nextRetryIn: POLL_DELAY_MS,
		},
		"Production server not ready, rescheduling",
	);

	ctx.reschedule(POLL_DELAY_MS);
}

async function rollbackOrFail(
	projectId: string,
	failedHash: string,
	errorMsg: string,
): Promise<void> {
	const previousHash = await getPreviousReleaseHash(projectId, failedHash);

	if (!previousHash) {
		await updateProductionStatus(projectId, "failed", {
			productionError: errorMsg,
		});
		return;
	}

	await promoteRelease(projectId, previousHash);
	await updateProductionStatus(projectId, "running", {
		productionHash: previousHash,
		productionError: `Rolled back to ${previousHash} after: ${errorMsg}`,
	});

	logger.info(
		{ projectId, failedHash, previousHash },
		"Rolled back to previous release after timeout",
	);
}

async function promoteRelease(
	projectId: string,
	productionHash: string,
): Promise<void> {
	const symlinkPath = getProductionCurrentSymlink(projectId);
	await fs.mkdir(path.dirname(symlinkPath), { recursive: true });

	const hashPath = getProductionPath(projectId, productionHash);
	const tempSymlink = `${symlinkPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	await fs.unlink(tempSymlink).catch(() => {});
	await fs.symlink(hashPath, tempSymlink);
	await fs.rename(tempSymlink, symlinkPath);

	logger.info(
		{ projectId, symlinkPath, target: hashPath },
		"Promoted release: current symlink updated",
	);
}
