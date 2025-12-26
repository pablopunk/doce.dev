import { randomBytes } from "node:crypto";
import { getConcurrency } from "./queue.model";
import { type QueueWorkerHandle, startQueueWorker } from "./queue.worker";

declare global {
	// eslint-disable-next-line no-var
	var __DOCE_QUEUE_WORKER__: QueueWorkerHandle | undefined;
}

export function ensureQueueWorkerStarted(): void {
	if (globalThis.__DOCE_QUEUE_WORKER__) {
		return;
	}

	const workerId = `host_${randomBytes(6).toString("hex")}`;

	// Fetch concurrency from DB without awaiting - start with default
	// The worker will read the configured value on next poll cycle
	const startWorker = async () => {
		const concurrency = await getConcurrency();
		globalThis.__DOCE_QUEUE_WORKER__ = startQueueWorker(workerId, {
			concurrency,
			leaseMs: 60_000,
			pollMs: 250,
		});
	};

	startWorker().catch((error) => {
		console.error("Failed to fetch concurrency setting:", error);
		// Fallback to default if fetch fails
		globalThis.__DOCE_QUEUE_WORKER__ = startQueueWorker(workerId, {
			concurrency: 2,
			leaseMs: 60_000,
			pollMs: 250,
		});
	});
}
