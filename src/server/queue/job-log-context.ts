import { AsyncLocalStorage } from "node:async_hooks";

interface QueueJobLogContext {
	jobId: string;
}

const queueJobLogContext = new AsyncLocalStorage<QueueJobLogContext>();

export function runWithQueueJobLogContext<T>(
	jobId: string,
	callback: () => T,
): T {
	return queueJobLogContext.run({ jobId }, callback);
}

export function getQueueJobLogContext(): QueueJobLogContext | undefined {
	return queueJobLogContext.getStore();
}
