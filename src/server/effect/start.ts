import { randomBytes } from "node:crypto";
import { Effect } from "effect";
import { logger } from "@/server/logger";
import { AppLayer, registerAllHandlers } from "./index";
import { type QueueWorkerHandle, startQueueWorkerEffect } from "./queue.worker";

declare global {
	// eslint-disable-next-line no-var
	var __DOCE_EFFECT_QUEUE_WORKER__: QueueWorkerHandle | undefined;
}

registerAllHandlers();

let workerStartPromise: Promise<void> | null = null;

const startWorker = async () => {
	const workerId = `host_${randomBytes(6).toString("hex")}`;

	const handle = await Effect.runPromise(
		startQueueWorkerEffect(workerId, {
			concurrency: 2,
			leaseMs: 60_000,
			pollMs: 250,
		}).pipe(Effect.provide(AppLayer)),
	);

	globalThis.__DOCE_EFFECT_QUEUE_WORKER__ = handle;
	logger.info({ workerId }, "Effect queue worker started");
};

export function ensureEffectQueueWorkerStarted(): void {
	const existing = globalThis.__DOCE_EFFECT_QUEUE_WORKER__;
	if (existing) {
		existing
			.isRunning()
			.then((running) => {
				if (running) {
					return;
				}

				logger.warn(
					"Effect queue worker handle exists but worker is stopped; restarting",
				);
				globalThis.__DOCE_EFFECT_QUEUE_WORKER__ = undefined;
				ensureEffectQueueWorkerStarted();
			})
			.catch((error) => {
				logger.error(
					{ error },
					"Failed to check Effect queue worker status; restarting",
				);
				globalThis.__DOCE_EFFECT_QUEUE_WORKER__ = undefined;
				ensureEffectQueueWorkerStarted();
			});

		return;
	}

	if (workerStartPromise) {
		return;
	}

	workerStartPromise = startWorker()
		.catch((error) => {
			logger.error({ error }, "Failed to start Effect queue worker");
		})
		.finally(() => {
			workerStartPromise = null;
		});
}
