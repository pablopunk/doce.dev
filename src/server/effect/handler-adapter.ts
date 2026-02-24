/**
 * Adapter to wrap existing async handlers for the Effect-based queue worker
 *
 * This allows incremental migration from async handlers to Effect handlers.
 * Eventually, handlers should be rewritten to use Effect directly.
 */
import { Effect } from "effect";
import type { QueueJob } from "@/server/db/schema";
import type { QueueJobContext as EffectQueueJobContext } from "./queue.worker";

export type LegacyHandler = (ctx: {
	job: QueueJob;
	workerId: string;
	throwIfCancelRequested: () => Promise<void>;
	reschedule: (delayMs: number) => never;
}) => Promise<void>;

export function wrapLegacyHandler(
	handler: LegacyHandler,
): (ctx: EffectQueueJobContext) => Effect.Effect<void, unknown> {
	return (ctx: EffectQueueJobContext) =>
		Effect.gen(function* () {
			// Check cancellation before running the legacy handler
			// This runs with the worker's layer context
			yield* ctx.throwIfCancelRequested();

			const legacyCtx = {
				job: ctx.job,
				workerId: ctx.workerId,
				// No-op since we already checked above
				throwIfCancelRequested: () => Promise.resolve(),
				reschedule: ctx.reschedule,
			};

			yield* Effect.tryPromise({
				try: () => handler(legacyCtx),
				catch: (error) => {
					// Re-throw RescheduleError so the worker can handle it
					if (
						error instanceof Error &&
						error.message === "reschedule" &&
						"delayMs" in error
					) {
						throw error;
					}
					return error;
				},
			});
		});
}
