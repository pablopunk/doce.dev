import { lru } from "tiny-lru";

interface CacheValue<T> {
	value: T;
	expiresAt: number;
}

const tinyStore = lru<CacheValue<unknown>>(500);
const pending = new Map<string, Promise<unknown>>();

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortValue);
	}

	if (value && typeof value === "object") {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			sorted[key] = sortValue((value as Record<string, unknown>)[key]);
		}
		return sorted;
	}

	return value;
}

export function stableStringify(value: unknown): string {
	const normalized = value === undefined ? null : value;
	return JSON.stringify(sortValue(normalized));
}

export async function getOrSet<T>(
	key: string,
	options: { ttlMs: number },
	factory: () => Promise<T> | T,
): Promise<T> {
	const now = Date.now();
	const cached = tinyStore.get(key);

	if (cached && cached.expiresAt > now) {
		return cached.value as T;
	}

	if (pending.has(key)) {
		return pending.get(key) as Promise<T>;
	}

	const promise = Promise.resolve()
		.then(() => factory())
		.then((value) => {
			tinyStore.set(key, { value, expiresAt: now + options.ttlMs });
			return value;
		})
		.finally(() => {
			pending.delete(key);
		});

	pending.set(key, promise);
	return promise;
}

export function invalidate(key: string): void {
	tinyStore.delete(key);
	pending.delete(key);
}

export function invalidatePrefix(prefix: string): void {
	for (const key of tinyStore.keys()) {
		if (key.startsWith(prefix)) {
			tinyStore.delete(key);
		}
	}

	for (const key of pending.keys()) {
		if (key.startsWith(prefix)) {
			pending.delete(key);
		}
	}
}

export function getCacheSize(): number {
	return tinyStore.size;
}
