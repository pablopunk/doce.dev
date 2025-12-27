import type { QueueJob } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { handleDockerComposeUp } from "./handlers/dockerComposeUp";
import { handleDockerEnsureRunning } from "./handlers/dockerEnsureRunning";
import { handleDockerStop } from "./handlers/dockerStop";
import { handleDockerWaitReady } from "./handlers/dockerWaitReady";
import { handleOpencodeSendInitialPrompt } from "./handlers/opencodeSendInitialPrompt";
import { handleOpencodeSendUserPrompt } from "./handlers/opencodeSendUserPrompt";
import { handleOpencodeSessionCreate } from "./handlers/opencodeSessionCreate";
import { handleProjectCreate } from "./handlers/projectCreate";
import { handleProjectDelete } from "./handlers/projectDelete";
import { handleDeleteAllForUser } from "./handlers/projectsDeleteAllForUser";
import { handleProductionBuild } from "./handlers/productionBuild";
import { handleProductionStart } from "./handlers/productionStart";
import { handleProductionWaitReady } from "./handlers/productionWaitReady";
import { handleProductionStop } from "./handlers/productionStop";
import {
	cancelRunningJob,
	claimNextJob,
	completeJob,
	failJob,
	getJobCancelRequestedAt,
	heartbeatLease,
	rescheduleJob,
	scheduleRetry,
	toErrorMessage,
} from "./queue.model";
import type { QueueJobType } from "./types";

export interface QueueWorkerOptions {
	concurrency: number;
	leaseMs: number;
	pollMs: number;
}

export interface QueueWorkerHandle {
	stop: () => Promise<void>;
}

/**
 * Thrown by handlers to reschedule the job without error.
 */
export class RescheduleError extends Error {
	constructor(public readonly delayMs: number) {
		super("reschedule");
	}
}

export interface QueueJobContext {
	job: QueueJob;
	workerId: string;
	throwIfCancelRequested: () => Promise<void>;
	/**
	 * Reschedule this job to run again after a delay.
	 * Does not increment attempts or set error.
	 */
	reschedule: (delayMs: number) => never;
}

const handlerByType: Record<
	QueueJobType,
	(ctx: QueueJobContext) => Promise<void>
> = {
	"project.create": handleProjectCreate,
	"project.delete": handleProjectDelete,
	"projects.deleteAllForUser": handleDeleteAllForUser,
	"docker.composeUp": handleDockerComposeUp,
	"docker.waitReady": handleDockerWaitReady,
	"docker.ensureRunning": handleDockerEnsureRunning,
	"docker.stop": handleDockerStop,
	"opencode.sessionCreate": handleOpencodeSessionCreate,
	"opencode.sendInitialPrompt": handleOpencodeSendInitialPrompt,
	"opencode.sendUserPrompt": handleOpencodeSendUserPrompt,
	"production.build": handleProductionBuild,
	"production.start": handleProductionStart,
	"production.waitReady": handleProductionWaitReady,
	"production.stop": handleProductionStop,
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempts: number): number {
	// attempts is 1-based at runtime (incremented during claim)
	const base = 2000;
	return Math.min(60_000, base * 2 ** Math.max(0, attempts - 1));
}

export function startQueueWorker(
	workerId: string,
	options: QueueWorkerOptions,
): QueueWorkerHandle {
	const abort = new AbortController();
	const inFlight = new Set<Promise<void>>();
	let restartCount = 0;
	const MAX_RESTARTS = 3;

	const stop = async () => {
		abort.abort();
		await Promise.allSettled([...inFlight]);
	};

	const loop = async () => {
		logger.info(
			{ workerId, concurrency: options.concurrency },
			"Queue worker started",
		);

		while (!abort.signal.aborted) {
			while (!abort.signal.aborted && inFlight.size < options.concurrency) {
				const job = await claimNextJob({ workerId, leaseMs: options.leaseMs });
				if (!job) break;

				const p = runJob(workerId, job, options, abort.signal)
					.catch(() => {
						// handled inside runJob
					})
					.finally(() => {
						inFlight.delete(p);
					});

				inFlight.add(p);
			}

			await sleep(options.pollMs);
		}

		logger.info({ workerId }, "Queue worker stopped");
	};

	const startLoop = async () => {
		try {
			await loop();
		} catch (error) {
			if (abort.signal.aborted) {
				return; // Worker was stopped intentionally
			}

			restartCount++;
			const exponentialDelay = Math.min(5000, 500 * 2 ** (restartCount - 1));

			logger.error(
				{
					error,
					workerId,
					restartCount,
					nextRetryMs: exponentialDelay,
					maxRestarts: MAX_RESTARTS,
				},
				`Queue worker crashed (attempt ${restartCount}/${MAX_RESTARTS})`,
			);

			if (restartCount >= MAX_RESTARTS) {
				logger.error(
					{ workerId, restartCount, maxRestarts: MAX_RESTARTS },
					"Queue worker exceeded max restart attempts - alerting",
				);
				// TODO: Send alert to monitoring system (e.g., Sentry, PagerDuty)
				return;
			}

			// Wait before restarting
			await sleep(exponentialDelay);

			// Restart the loop
			await startLoop();
		}
	};

	// Start the loop with restart logic
	startLoop().catch((error) => {
		logger.error(
			{ error, workerId },
			"Queue worker loop fatal error - unable to recover",
		);
	});

	return { stop };
}

async function runJob(
	workerId: string,
	job: QueueJob,
	options: QueueWorkerOptions,
	signal: AbortSignal,
): Promise<void> {
	const heartbeatTimer = setInterval(() => {
		heartbeatLease(job.id, workerId, options.leaseMs).catch(() => {
			// ignore
		});
	}, 5000);

	const throwIfCancelRequested = async () => {
		const cancelRequestedAt = await getJobCancelRequestedAt(job.id);
		if (cancelRequestedAt) {
			throw new Error("cancel_requested");
		}
	};

	try {
		await throwIfCancelRequested();

		const handler = handlerByType[job.type as QueueJobType];
		if (!handler) {
			throw new Error(`No handler for job type: ${job.type}`);
		}

		const reschedule = (delayMs: number): never => {
			throw new RescheduleError(delayMs);
		};

		await handler({ job, workerId, throwIfCancelRequested, reschedule });

		await completeJob(job.id, workerId);
		logger.info({ jobId: job.id, type: job.type }, "Queue job succeeded");
	} catch (error) {
		// Handle reschedule (not an error, just re-queue)
		if (error instanceof RescheduleError) {
			await rescheduleJob(job.id, workerId, error.delayMs);
			logger.info(
				{
					jobId: job.id,
					type: job.type,
					delayMs: error.delayMs,
					attempts: job.attempts,
				},
				"Queue job rescheduled",
			);
			return;
		}

		const message = toErrorMessage(error);

		if (message === "cancel_requested") {
			await cancelRunningJob(job.id, workerId);
			logger.info({ jobId: job.id, type: job.type }, "Queue job cancelled");
			return;
		}

		// Retry if attempts remain
		if (job.attempts < job.maxAttempts && !signal.aborted) {
			const delay = retryDelayMs(job.attempts);
			await scheduleRetry(job.id, workerId, delay, message);
			logger.warn(
				{ jobId: job.id, type: job.type, attempts: job.attempts, delay },
				"Queue job scheduled for retry",
			);
			return;
		}

		await failJob(job.id, workerId, message);
		logger.error(
			{ jobId: job.id, type: job.type, error: message },
			"Queue job failed",
		);
	} finally {
		clearInterval(heartbeatTimer);
	}
}
