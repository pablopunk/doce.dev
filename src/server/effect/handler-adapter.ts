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
			const legacyCtx = {
				job: ctx.job,
				workerId: ctx.workerId,
				throwIfCancelRequested: () =>
					Effect.runPromise(ctx.throwIfCancelRequested()),
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
