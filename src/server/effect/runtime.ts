import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";

export const BaseLayer = NodeContext.layer;

export const runEffect = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
	Effect.runPromise(Effect.provide(effect, BaseLayer));

export const runEffectWithFallback = <A, E>(
	effect: Effect.Effect<A, E>,
	onError: (error: E) => A,
): Promise<A> =>
	Effect.runPromise(
		Effect.provide(
			Effect.catchAll(effect, (e) => Effect.succeed(onError(e))),
			BaseLayer,
		),
	);

export const runEffectSync = <A, E>(effect: Effect.Effect<A, E>): A =>
	Effect.runSync(Effect.provide(effect, BaseLayer));

export { Effect };
