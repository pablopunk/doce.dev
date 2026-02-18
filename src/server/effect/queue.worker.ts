import { Duration, Effect, Fiber } from "effect";
import type { QueueJob } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { JobCancelledError, RescheduleError } from "./errors";
import { QueueService } from "./layers";

export interface QueueWorkerOptions {
	concurrency: number;
	leaseMs: number;
	pollMs: number;
}

export interface QueueWorkerHandle {
	stop: () => Promise<void>;
	isRunning: () => Promise<boolean>;
}

export interface QueueJobContext {
	job: QueueJob;
	workerId: string;
	throwIfCancelRequested: () => Effect.Effect<void, never>;
	reschedule: (delayMs: number) => never;
}

type JobHandler = (ctx: QueueJobContext) => Effect.Effect<void, unknown>;

const handlerByType: Record<string, JobHandler | undefined> = {};

export const registerHandler = (type: string, handler: JobHandler) => {
	handlerByType[type] = handler;
};

const runJob = (
	job: QueueJob,
	workerId: string,
): Effect.Effect<void, never, QueueService> =>
	Effect.gen(function* () {
		const queue = yield* QueueService;

		const throwIfCancelRequested = () =>
			Effect.gen(function* () {
				const cancelledAt = yield* queue.getJobCancelRequestedAt(job.id);
				if (cancelledAt) {
					yield* Effect.fail(
						new JobCancelledError({
							jobId: job.id,
							requestedAt: cancelledAt,
						}),
					);
				}
			}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		const reschedule = (delayMs: number): never => {
			throw new RescheduleError({ jobId: job.id, delayMs, reason: "handler" });
		};

		const ctx: QueueJobContext = {
			job,
			workerId,
			throwIfCancelRequested,
			reschedule,
		};

		const handler = handlerByType[job.type];
		if (!handler) {
			yield* queue.failJob(
				job.id,
				workerId,
				`No handler for type: ${job.type}`,
			);
			return;
		}

		const result = yield* Effect.exit(handler(ctx));

		if (result._tag === "Success") {
			yield* queue.completeJob(job.id, workerId);
			logger.info({ jobId: job.id, type: job.type }, "Queue job succeeded");
			return;
		}

		const cause = result.cause;
		const error =
			cause._tag === "Fail" ? cause.error : new Error("Unknown error");

		if (error instanceof RescheduleError) {
			yield* queue.rescheduleJob(job.id, workerId, error.delayMs);
			logger.info(
				{ jobId: job.id, delayMs: error.delayMs },
				"Queue job rescheduled",
			);
			return;
		}

		const errorMsg =
			error instanceof Error ? error.message : JSON.stringify(error);

		if (error instanceof JobCancelledError || errorMsg === "cancel_requested") {
			yield* queue.cancelRunningJob(job.id, workerId);
			logger.info({ jobId: job.id }, "Queue job cancelled");
			return;
		}

		if (job.attempts < job.maxAttempts) {
			const delay = Math.min(60000, 2000 * 2 ** Math.max(0, job.attempts - 1));
			yield* queue.scheduleRetry(job.id, workerId, delay, errorMsg);
			logger.warn(
				{ jobId: job.id, attempts: job.attempts, delay },
				"Queue job retry scheduled",
			);
			return;
		}

		yield* queue.failJob(job.id, workerId, errorMsg);
		logger.error({ jobId: job.id, error: errorMsg }, "Queue job failed");
	}).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

const workerLoop = (
	workerId: string,
	options: QueueWorkerOptions,
): Effect.Effect<void, never, QueueService> =>
	Effect.gen(function* () {
		const queue = yield* QueueService;

		logger.info(
			{ workerId, concurrency: options.concurrency },
			"Queue worker started",
		);

		const fibers: Fiber.RuntimeFiber<void, never>[] = [];

		const safeRecover = queue
			.recoverExpiredJobs()
			.pipe(
				Effect.catchAll((e) =>
					Effect.sync(() =>
						logger.error({ error: e }, "Failed to recover expired jobs"),
					),
				),
			);

		const safeClaim = (opts: { workerId: string; leaseMs: number }) =>
			queue.claimNextJob(opts).pipe(
				Effect.catchAll((e) =>
					Effect.sync(() => {
						logger.error({ error: e }, "Failed to claim job");
						return null as QueueJob | null;
					}),
				),
			);

		while (true) {
			yield* safeRecover;

			while (fibers.length < options.concurrency) {
				const job = yield* safeClaim({
					workerId,
					leaseMs: options.leaseMs,
				});
				if (!job) break;

				const fiber = yield* Effect.fork(runJob(job, workerId));
				fibers.push(fiber);
			}

			yield* Effect.sleep(Duration.millis(options.pollMs));

			const activeFibers: Fiber.RuntimeFiber<void, never>[] = [];
			for (const fiber of fibers) {
				const status = yield* Fiber.status(fiber);
				if (status._tag !== "Done") {
					activeFibers.push(fiber);
				}
			}
			fibers.length = 0;
			fibers.push(...activeFibers);
		}
	});

export const startQueueWorkerEffect = (
	workerId: string,
	options: QueueWorkerOptions,
): Effect.Effect<QueueWorkerHandle, never, QueueService> =>
	Effect.gen(function* () {
		const fiber = yield* Effect.forkDaemon(workerLoop(workerId, options));

		return {
			stop: () =>
				Effect.runPromise(Fiber.interrupt(fiber)).then(() => {
					logger.info({ workerId }, "Queue worker stopped");
				}),
			isRunning: () =>
				Effect.runPromise(Fiber.status(fiber)).then(
					(status) => status._tag !== "Done",
				),
		};
	});

export const getHandlers = () => handlerByType;
