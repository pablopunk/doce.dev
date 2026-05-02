import { randomBytes } from "node:crypto";
import { Effect, Layer } from "effect";
import { getConfigValue } from "@/server/config";
import { logger } from "@/server/logger";
import { runReconciliation } from "@/server/reconciliation/reconcile";
import { registerQueueWorkerForShutdown } from "@/server/shutdown";
import { AppLayer, registerAllHandlers } from "./index";
import { type QueueWorkerHandle, startQueueWorkerEffect } from "./queue.worker";
import { BaseLayer } from "./runtime";

declare global {
	// eslint-disable-next-line no-var
	var __DOCE_EFFECT_QUEUE_WORKER__: QueueWorkerHandle | undefined;
}

registerAllHandlers();

let workerStartPromise: Promise<void> | null = null;

const startWorker = async () => {
	const workerId = `host_${randomBytes(6).toString("hex")}`;
	const layer = Layer.merge(BaseLayer, AppLayer) as Layer.Layer<
		unknown,
		never,
		never
	>;

	// Get configuration values
	const concurrency = getConfigValue("QUEUE_CONCURRENCY");
	const leaseMs = getConfigValue("QUEUE_LEASE_MS");
	const pollMs = getConfigValue("QUEUE_POLL_MS");

	const handle = await Effect.runPromise(
		startQueueWorkerEffect(workerId, {
			concurrency,
			leaseMs,
			pollMs,
			layer,
		}).pipe(Effect.provide(layer)),
	);

	globalThis.__DOCE_EFFECT_QUEUE_WORKER__ = handle;

	// Register for graceful shutdown
	registerQueueWorkerForShutdown(() => handle.stop());

	// Start self-healing reconciliation on its own timer
	// Completely independent of the queue worker poll loop
	const RECONCILIATION_INTERVAL_MS = 30_000;
	const reconciliationTimer = setInterval(async () => {
		try {
			await runReconciliation();
		} catch (error) {
			logger.error({ error }, "Reconciliation timer failed");
		}
	}, RECONCILIATION_INTERVAL_MS);

	// Clean up reconciliation timer on shutdown
	registerQueueWorkerForShutdown(() => {
		clearInterval(reconciliationTimer);
		return Promise.resolve();
	});

	logger.info(
		{ workerId, concurrency, leaseMs, pollMs },
		"Effect queue worker started",
	);
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
