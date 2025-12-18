import { startQueueWorker, type QueueWorkerHandle } from "./queue.worker";
import { randomBytes } from "node:crypto";

declare global {
  // eslint-disable-next-line no-var
  var __DOCE_QUEUE_WORKER__: QueueWorkerHandle | undefined;
}

export function ensureQueueWorkerStarted(): void {
  if (globalThis.__DOCE_QUEUE_WORKER__) {
    return;
  }

  const workerId = `host_${randomBytes(6).toString("hex")}`;

  globalThis.__DOCE_QUEUE_WORKER__ = startQueueWorker(workerId, {
    concurrency: 2,
    leaseMs: 60_000,
    pollMs: 250,
  });
}
