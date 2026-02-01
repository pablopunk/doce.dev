import { randomBytes } from "node:crypto";
import { getConcurrency } from "./queue.model";
import { type QueueWorkerHandle, startQueueWorker } from "./queue.worker";
import { logger } from "@/server/logger";

declare global {
	// eslint-disable-next-line no-var
	var __DOCE_QUEUE_WORKER__: QueueWorkerHandle | undefined;
}

/**
 * Start the queue worker.
 * With async refactoring (eliminating execSync), the queue polling loop
 * no longer blocks the main event loop during job execution.
 *
 * Note: The queue runs on the main thread but uses async/await for all
 * blocking operations, allowing the server to remain responsive.
 */
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
		logger.error({ error }, "Failed to fetch concurrency setting");
		// Fallback to default if fetch fails
		globalThis.__DOCE_QUEUE_WORKER__ = startQueueWorker(workerId, {
			concurrency: 2,
			leaseMs: 60_000,
			pollMs: 250,
		});
	});
}
