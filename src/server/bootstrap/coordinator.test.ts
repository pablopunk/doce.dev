import { describe, expect, it, vi } from "vitest";
import {
	type BootstrapOperations,
	createBootstrapCoordinator,
} from "./coordinator";
import { createBootstrapProcessState } from "./process-state";

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
	for (let index = 0; index < 10; index += 1) {
		await Promise.resolve();
	}
	await new Promise<void>((resolve) => setImmediate(resolve));
}

function operations(overrides: Partial<BootstrapOperations> = {}) {
	const calls: string[] = [];
	const operation = (name: string) =>
		vi.fn(async () => {
			calls.push(name);
		});
	return {
		calls,
		operations: {
			ensureDatabaseReady: operation("database"),
			startPostDatabaseHousekeeping: vi.fn(() => calls.push("housekeeping")),
			ensureEffectQueueWorkerStarted: operation("queue"),
			ensureDoceSharedNetwork: operation("network"),
			ensureGlobalPnpmVolume: operation("volume"),
			ensureGlobalOpencodeStarted: operation("opencode"),
			startImagePrewarm: operation("prewarm"),
			startDefaultsBootstrap: operation("defaults"),
			ensureTailscaleStarted: operation("tailscale"),
			logError: vi.fn(),
			...overrides,
		} satisfies BootstrapOperations,
	};
}

describe("bootstrap coordinator", () => {
	it("shares the exact in-flight promise and retains startup ordering", async () => {
		const openCode = deferred<void>();
		const fixture = operations({
			ensureGlobalOpencodeStarted: () => openCode.promise,
		});
		const coordinator = createBootstrapCoordinator(
			createBootstrapProcessState(),
			fixture.operations,
		);

		const first = coordinator.ensureServerBootstrap();
		expect(coordinator.ensureServerBootstrap()).toBe(first);
		await flushPromises();
		expect(fixture.calls).toEqual([
			"database",
			"housekeeping",
			"queue",
			"network",
			"volume",
		]);
		openCode.resolve();
		await expect(first).resolves.toBe("ready");
		await flushPromises();
		expect(fixture.calls).toEqual([
			"database",
			"housekeeping",
			"queue",
			"network",
			"volume",
			"prewarm",
			"defaults",
			"tailscale",
		]);
	});

	it("contains detached and network/volume failures while OpenCode remains fatal", async () => {
		const fixture = operations({
			ensureEffectQueueWorkerStarted: () => {
				throw new Error("queue");
			},
			ensureDoceSharedNetwork: async () => {
				throw new Error("network");
			},
			ensureGlobalPnpmVolume: async () => {
				throw new Error("volume");
			},
			ensureGlobalOpencodeStarted: async () => {
				throw new Error("opencode");
			},
		});
		const coordinator = createBootstrapCoordinator(
			createBootstrapProcessState(),
			fixture.operations,
		);

		await expect(coordinator.ensureServerBootstrap()).rejects.toThrow(
			"opencode",
		);
		expect(fixture.operations.startImagePrewarm).not.toHaveBeenCalled();
		expect(fixture.operations.startDefaultsBootstrap).not.toHaveBeenCalled();
		expect(fixture.operations.ensureTailscaleStarted).not.toHaveBeenCalled();
		expect(fixture.operations.logError).toHaveBeenCalled();
	});

	it("resolves cooldown calls and schedules only one automatic retry", async () => {
		let clock = 0;
		const timers: Array<{ callback: () => void; cancelled: boolean }> = [];
		const fixture = operations({
			ensureGlobalOpencodeStarted: vi
				.fn<() => Promise<void>>()
				.mockRejectedValueOnce(new Error("first attempt"))
				.mockResolvedValueOnce(undefined),
		});
		const state = createBootstrapProcessState();
		const coordinator = createBootstrapCoordinator(state, fixture.operations, {
			now: () => clock,
			setTimeout: ((callback: () => void) => {
				const timer = { callback, cancelled: false };
				timers.push(timer);
				return timer as unknown as ReturnType<typeof setTimeout>;
			}) as typeof setTimeout,
			clearTimeout: ((timer: { cancelled: boolean }) => {
				timer.cancelled = true;
			}) as unknown as typeof clearTimeout,
		});

		await expect(coordinator.ensureServerBootstrap()).rejects.toThrow(
			"first attempt",
		);
		expect(timers).toHaveLength(1);
		expect(await coordinator.ensureServerBootstrap()).toBe("cooldown");
		expect(timers).toHaveLength(1);

		clock = 5_000;
		const retryTimer = timers[0];
		if (!retryTimer) throw new Error("missing retry timer");
		retryTimer.callback();
		await flushPromises();
		expect(
			fixture.operations.ensureGlobalOpencodeStarted,
		).toHaveBeenCalledTimes(2);
		expect(state.initialized).toBe(true);
	});
});
