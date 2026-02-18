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

export function ensureEffectQueueWorkerStarted(): void {
	if (globalThis.__DOCE_EFFECT_QUEUE_WORKER__) {
		return;
	}

	const workerId = `host_${randomBytes(6).toString("hex")}`;

	const startWorker = async () => {
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

	startWorker().catch((error) => {
		logger.error({ error }, "Failed to start Effect queue worker");
	});
}
