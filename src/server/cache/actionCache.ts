import { getOrSet, stableStringify } from "./memory";

export type CacheKeyFactory<I> = (input: I, context: any) => string;

export function cachedAction<I, O>(
	actionName: string,
	options: {
		ttlMs: number;
		key?: CacheKeyFactory<I>;
	},
	handler: (input: I, context: any) => Promise<O> | O,
) {
	return async (input: I, context: any) => {
		const resolvedInput = input ?? {};
		const key =
			options.key?.(input, context) ??
			`cache:v1:action:${actionName}:${stableStringify(resolvedInput)}`;
		return getOrSet(key, { ttlMs: options.ttlMs }, () =>
			handler(input, context),
		);
	};
}
