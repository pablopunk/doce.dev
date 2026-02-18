export * from "./errors";
export type { LegacyHandler } from "./handler-adapter";
export { wrapLegacyHandler } from "./handler-adapter";
export { registerAllHandlers } from "./handlers";

import { Layer } from "effect";
import { DockerServiceLive } from "./DockerServiceLive";
import { DatabaseServiceLive } from "./layers";
import { QueueServiceLive } from "./QueueServiceLive";

export const AppLayer = Layer.mergeAll(
	QueueServiceLive,
	DockerServiceLive,
	DatabaseServiceLive,
);

export {
	DatabaseService,
	DockerService,
	DockerServiceLive,
	QueueService,
	QueueServiceLive,
} from "./layers";
export type { QueueWorkerHandle, QueueWorkerOptions } from "./queue.worker";
export {
	getHandlers,
	registerHandler,
	startQueueWorkerEffect,
} from "./queue.worker";
export { runEffect, runEffectSync, runEffectWithFallback } from "./runtime";
export * from "./schemas";
export { ensureEffectQueueWorkerStarted } from "./start";
