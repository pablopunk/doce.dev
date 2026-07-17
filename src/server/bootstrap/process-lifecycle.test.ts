import { afterEach, describe, expect, it, vi } from "vitest";
import { startPostDatabaseHousekeeping } from "./housekeeping";
import {
	createBootstrapProcessState,
	getBootstrapProcessState,
} from "./process-state";

describe("bootstrap process lifecycle", () => {
	afterEach(() => {
		vi.useRealTimers();
		delete globalThis.__DOCE_SERVER_BOOTSTRAP_STATE__;
	});

	it("keeps one global ownership slot across HMR-like module access", () => {
		const first = getBootstrapProcessState();
		first.shutdownHandlersInstalled = true;
		expect(getBootstrapProcessState()).toBe(first);
		expect(getBootstrapProcessState().shutdownHandlersInstalled).toBe(true);
	});

	it("owns one immediate cleanup and one unrefed interval across repeat starts", async () => {
		vi.useFakeTimers();
		const state = createBootstrapProcessState();
		const cleanup = vi.fn().mockResolvedValue(undefined);
		startPostDatabaseHousekeeping(state, cleanup);
		startPostDatabaseHousekeeping(state, cleanup);
		await Promise.resolve();
		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(state.sessionCleanupTimer).not.toBeNull();
		await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
		expect(cleanup).toHaveBeenCalledTimes(2);
		if (state.sessionCleanupTimer) clearInterval(state.sessionCleanupTimer);
	});
});
