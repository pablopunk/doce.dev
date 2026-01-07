import { getOrSet, stableStringify } from "./memory";

/**
 * Astro Action context type - contains request data, locals, cookies, and other metadata
 * We use Record<string, unknown> as a general-purpose type that accommodates the full ActionHandler context
 */
type ActionContext = Record<string, unknown>;

export type CacheKeyFactory<I> = (input: I, context: ActionContext) => string;

export function cachedAction<I, O>(
	actionName: string,
	options: {
		ttlMs: number;
		key?: CacheKeyFactory<I>;
	},
	handler: (input: I, context: ActionContext) => Promise<O> | O,
) {
	return async (input: I, context: ActionContext) => {
		const resolvedInput = input ?? {};
		const key =
			options.key?.(input, context) ??
			`cache:v1:action:${actionName}:${stableStringify(resolvedInput)}`;
		return getOrSet(key, { ttlMs: options.ttlMs }, () =>
			handler(input, context),
		);
	};
}
