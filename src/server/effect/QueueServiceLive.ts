import { Effect, Layer } from "effect";
import { logger } from "@/server/logger";
import {
	claimNextJob as claimNextJobDb,
	heartbeatLease as heartbeatLeaseDb,
} from "@/server/queue/queue.claim";
import {
	getJobCancelRequestedAt as getJobCancelRequestedAtDb,
	listJobs as listJobsDb,
} from "@/server/queue/queue.crud";
import {
	cancelRunningJob as cancelRunningJobDb,
	completeJob as completeJobDb,
	failJob as failJobDb,
	recoverExpiredJobs as recoverExpiredJobsDb,
	rescheduleJob as rescheduleJobDb,
	scheduleRetry as scheduleRetryDb,
} from "@/server/queue/queue.lifecycle";
import { QueueError } from "./errors";
import { QueueService } from "./layers";

const toQueueError = (error: unknown, context?: Record<string, unknown>) =>
	new QueueError({
		message: error instanceof Error ? error.message : String(error),
		cause: error,
		...context,
	});

export const QueueServiceLive = Layer.succeed(
	QueueService,
	QueueService.of({
		claimNextJob: (options) =>
			Effect.tryPromise({
				try: () => claimNextJobDb(options),
				catch: (e) => toQueueError(e, { workerId: options.workerId }),
			}),

		completeJob: (jobId, workerId) =>
			Effect.tryPromise({
				try: () => completeJobDb(jobId, workerId),
				catch: (e) => toQueueError(e, { jobId, workerId }),
			}).pipe(
				Effect.tap(() =>
					Effect.sync(() =>
						logger.info({ jobId, workerId }, "Job completed successfully"),
					),
				),
			),

		failJob: (jobId, workerId, errorMessage) =>
			Effect.tryPromise({
				try: () => failJobDb(jobId, workerId, errorMessage),
				catch: (e) => toQueueError(e, { jobId, workerId }),
			}).pipe(
				Effect.tap(() =>
					Effect.sync(() =>
						logger.error(
							{ jobId, workerId, error: errorMessage },
							"Job marked as failed",
						),
					),
				),
			),

		heartbeatLease: (jobId, workerId, leaseMs) =>
			Effect.tryPromise({
				try: () => heartbeatLeaseDb(jobId, workerId, leaseMs),
				catch: () => new QueueError({ message: "Heartbeat failed", jobId }),
			}).pipe(Effect.orElse(() => Effect.succeed(undefined))),

		scheduleRetry: (jobId, workerId, delayMs, errorMessage) =>
			Effect.tryPromise({
				try: () => scheduleRetryDb(jobId, workerId, delayMs, errorMessage),
				catch: (e) => toQueueError(e, { jobId, workerId }),
			}),

		rescheduleJob: (jobId, workerId, delayMs) =>
			Effect.tryPromise({
				try: () => rescheduleJobDb(jobId, workerId, delayMs),
				catch: (e) => toQueueError(e, { jobId, workerId }),
			}),

		cancelRunningJob: (jobId, workerId) =>
			Effect.tryPromise({
				try: () => cancelRunningJobDb(jobId, workerId),
				catch: (e) => toQueueError(e, { jobId, workerId }),
			}),

		getJobCancelRequestedAt: (jobId) =>
			Effect.tryPromise({
				try: () => getJobCancelRequestedAtDb(jobId),
				catch: (e) => toQueueError(e, { jobId }),
			}),

		recoverExpiredJobs: () =>
			Effect.tryPromise({
				try: async () => {
					await recoverExpiredJobsDb();
					return 0;
				},
				catch: (e) => toQueueError(e),
			}).pipe(
				Effect.tap(() =>
					Effect.sync(() => logger.debug("Recovered expired jobs")),
				),
			),

		listJobs: (filters) =>
			Effect.tryPromise({
				try: () => listJobsDb(filters),
				catch: (e) => toQueueError(e),
			}),
	}),
);
