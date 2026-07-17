import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	cleanupExpiredSessions: vi.fn(),
	ensureDatabaseReady: vi.fn(),
	ensureDoceSharedNetwork: vi.fn(),
	ensureEffectQueueWorkerStarted: vi.fn(),
	ensureGlobalOpencodeStarted: vi.fn(),
	ensureGlobalPnpmVolume: vi.fn(),
	ensureTailscaleStarted: vi.fn(),
	initConfig: vi.fn(),
	installShutdownHandlers: vi.fn(),
	logger: { error: vi.fn() },
	registerDatabaseForShutdown: vi.fn(),
	registerOpencodeRuntimeForShutdown: vi.fn(),
	registerShutdownHandler: vi.fn(),
	startImagePrewarm: vi.fn(),
}));

vi.mock("@/server/auth/sessions", () => ({
	cleanupExpiredSessions: mocks.cleanupExpiredSessions,
}));
vi.mock("@/server/config", () => ({ initConfig: mocks.initConfig }));
vi.mock("@/server/db/ensure-db", () => ({
	ensureDatabaseReady: mocks.ensureDatabaseReady,
}));
vi.mock("@/server/docker/compose", () => ({
	ensureDoceSharedNetwork: mocks.ensureDoceSharedNetwork,
	ensureGlobalPnpmVolume: mocks.ensureGlobalPnpmVolume,
}));
vi.mock("@/server/docker/prewarm", () => ({
	startImagePrewarm: mocks.startImagePrewarm,
}));
vi.mock("@/server/effect", () => ({
	ensureEffectQueueWorkerStarted: mocks.ensureEffectQueueWorkerStarted,
}));
vi.mock("@/server/logger", () => ({ logger: mocks.logger }));
vi.mock("@/server/opencode/runtime", () => ({
	ensureGlobalOpencodeStarted: mocks.ensureGlobalOpencodeStarted,
}));
vi.mock("@/server/shutdown", () => ({
	installShutdownHandlers: mocks.installShutdownHandlers,
	registerDatabaseForShutdown: mocks.registerDatabaseForShutdown,
	registerOpencodeRuntimeForShutdown: mocks.registerOpencodeRuntimeForShutdown,
	registerShutdownHandler: mocks.registerShutdownHandler,
}));
vi.mock("@/server/tailscale/startup", () => ({
	ensureTailscaleStarted: mocks.ensureTailscaleStarted,
}));

async function flushPromises(): Promise<void> {
	for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

describe("bootstrap process lifecycle", () => {
	afterEach(() => {
		globalThis.__DOCE_SERVER_BOOTSTRAP_STATE__ = undefined;
		vi.unstubAllGlobals();
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("owns registrations and timers across HMR-like reloads after a later startup failure", async () => {
		const retryTimer = { unref: vi.fn() };
		const sessionTimer = { unref: vi.fn() };
		const clearTimeout = vi.fn();
		const clearInterval = vi.fn();
		vi.stubGlobal(
			"setTimeout",
			(() => retryTimer) as unknown as typeof setTimeout,
		);
		vi.stubGlobal(
			"setInterval",
			(() => sessionTimer) as unknown as typeof setInterval,
		);
		vi.stubGlobal("clearTimeout", clearTimeout);
		vi.stubGlobal("clearInterval", clearInterval);
		mocks.ensureDatabaseReady.mockResolvedValue(undefined);
		mocks.cleanupExpiredSessions.mockResolvedValue(undefined);
		mocks.ensureDoceSharedNetwork.mockResolvedValue(undefined);
		mocks.ensureGlobalPnpmVolume.mockResolvedValue(undefined);
		mocks.ensureGlobalOpencodeStarted.mockRejectedValue(new Error("OpenCode"));

		const bootstrap = await import("./index");
		await expect(bootstrap.ensureServerBootstrap()).rejects.toThrow("OpenCode");
		await flushPromises();

		expect(mocks.initConfig).toHaveBeenCalledTimes(1);
		expect(mocks.installShutdownHandlers).toHaveBeenCalledTimes(1);
		expect(mocks.registerOpencodeRuntimeForShutdown).toHaveBeenCalledTimes(1);
		expect(mocks.registerDatabaseForShutdown).toHaveBeenCalledTimes(1);
		expect(mocks.registerShutdownHandler).toHaveBeenCalledTimes(1);
		expect(mocks.cleanupExpiredSessions).toHaveBeenCalledTimes(1);
		expect(sessionTimer.unref).toHaveBeenCalledTimes(1);
		expect(retryTimer.unref).toHaveBeenCalledTimes(1);

		vi.resetModules();
		const reloadedBootstrap = await import("./index");
		expect(await reloadedBootstrap.ensureServerBootstrap()).toBe("cooldown");
		expect(mocks.installShutdownHandlers).toHaveBeenCalledTimes(1);
		expect(mocks.cleanupExpiredSessions).toHaveBeenCalledTimes(1);

		const shutdown = mocks.registerShutdownHandler.mock.calls[0]?.[1];
		if (typeof shutdown !== "function")
			throw new Error("missing shutdown handler");
		shutdown();
		expect(clearTimeout).toHaveBeenCalledWith(retryTimer);
		expect(clearInterval).toHaveBeenCalledWith(sessionTimer);
		expect(globalThis.__DOCE_SERVER_BOOTSTRAP_STATE__?.retryTimer).toBeNull();
		expect(
			globalThis.__DOCE_SERVER_BOOTSTRAP_STATE__?.sessionCleanupTimer,
		).toBeNull();
	});
});
