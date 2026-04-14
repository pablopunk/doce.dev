import { Cause, Duration, Effect, Fiber, type Layer } from "effect";
import { getConfigValue } from "@/server/config";
import type { QueueJob } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { errorToSanitizedMessage } from "@/server/utils/sanitize";
import {
	JobCancelledError,
	JobLeaseLostError,
	RescheduleError,
} from "./errors";
import { QueueService } from "./layers";

const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Calculate retry delay with exponential backoff and jitter
 *
 * Uses full jitter: random value between 0 and the calculated exponential delay
 * This prevents thundering herd when many jobs fail simultaneously
 */
function calculateRetryDelay(attempts: number): number {
	const baseMs = getConfigValue("QUEUE_RETRY_BASE_MS");
	const maxDelayMs = getConfigValue("QUEUE_RETRY_MAX_DELAY_MS");

	// Calculate exponential delay: base * 2^(attempts-1)
	const exponentialDelay = baseMs * 2 ** Math.max(0, attempts - 1);
	const cappedDelay = Math.min(maxDelayMs, exponentialDelay);

	// Apply full jitter: random value between 0 and cappedDelay
	// This distributes retries across the interval and prevents thundering herd
	const jitter = Math.random() * cappedDelay;

	return Math.floor(jitter);
}

export interface QueueWorkerOptions {
	concurrency: number;
	leaseMs: number;
	pollMs: number;
	/**
	 * Layer to provide to each job handler. Should include all services
	 * required by handlers (e.g., BaseLayer merged with AppLayer).
	 */
	layer: Layer.Layer<unknown, never, never>;
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
	leaseMs: number,
	layer: Layer.Layer<unknown, never, never>,
): Effect.Effect<void, never, QueueService> =>
	Effect.gen(function* () {
		const queue = yield* QueueService;

		const heartbeatLoop = Effect.gen(function* () {
			while (true) {
				yield* Effect.sleep(Duration.millis(HEARTBEAT_INTERVAL_MS));
				yield* queue.heartbeatLease(job.id, workerId, leaseMs);
			}
		});

		const toMessage = (error: unknown) => errorToSanitizedMessage(error);

		const ignoreLeaseLoss = <A>(
			effect: Effect.Effect<A, unknown, QueueService>,
			operation: string,
		) =>
			effect.pipe(
				Effect.catchAll((error) => {
					if (error instanceof JobLeaseLostError) {
						return Effect.sync(() => {
							logger.warn(
								{
									jobId: error.jobId,
									workerId: error.workerId,
									operation: error.operation,
									during: operation,
									type: job.type,
								},
								"Queue job lost lease before state transition",
							);
							return true as A;
						});
					}

					return Effect.fail(error);
				}),
			);

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

		const handledEffect = Effect.raceFirst(
			Effect.scoped(handler(ctx).pipe(Effect.provide(layer))),
			heartbeatLoop,
		);
		const result = yield* Effect.exit(handledEffect);

		if (result._tag === "Success") {
			yield* ignoreLeaseLoss(queue.completeJob(job.id, workerId), "complete");
			logger.info({ jobId: job.id, type: job.type }, "Queue job succeeded");
			return;
		}

		const cause = result.cause;
		const error =
			cause._tag === "Fail"
				? cause.error
				: cause._tag === "Die"
					? cause.defect
					: cause._tag === "Interrupt"
						? new Error("Job was interrupted")
						: new Error(Cause.pretty(cause));

		if (error instanceof RescheduleError) {
			yield* ignoreLeaseLoss(
				queue.rescheduleJob(job.id, workerId, error.delayMs),
				"reschedule",
			);
			logger.info(
				{ jobId: job.id, delayMs: error.delayMs },
				"Queue job rescheduled",
			);
			return;
		}

		const errorMsg = toMessage(error);

		if (error instanceof JobLeaseLostError) {
			yield* Effect.sync(() => {
				logger.warn(
					{
						jobId: error.jobId,
						workerId: error.workerId,
						operation: error.operation,
						type: job.type,
					},
					"Queue job stopped after losing lease",
				);
			});
			return;
		}

		if (error instanceof JobCancelledError || errorMsg === "cancel_requested") {
			yield* ignoreLeaseLoss(
				queue.cancelRunningJob(job.id, workerId),
				"cancel",
			);
			logger.info({ jobId: job.id }, "Queue job cancelled");
			return;
		}

		if (job.attempts < job.maxAttempts) {
			const delay = calculateRetryDelay(job.attempts);
			yield* ignoreLeaseLoss(
				queue.scheduleRetry(job.id, workerId, delay, errorMsg),
				"scheduleRetry",
			);
			logger.warn(
				{ jobId: job.id, attempts: job.attempts, delay },
				"Queue job retry scheduled",
			);
			return;
		}

		yield* ignoreLeaseLoss(queue.failJob(job.id, workerId, errorMsg), "fail");
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

				const fiber = yield* Effect.fork(
					runJob(job, workerId, options.leaseMs, options.layer),
				);
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
