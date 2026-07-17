import { cleanupExpiredSessions } from "@/server/auth/sessions";
import { initConfig } from "@/server/config";
import { ensureDatabaseReady } from "@/server/db/ensure-db";
import {
	ensureDoceSharedNetwork,
	ensureGlobalPnpmVolume,
} from "@/server/docker/compose";
import { startImagePrewarm } from "@/server/docker/prewarm";
import { ensureEffectQueueWorkerStarted } from "@/server/effect";
import { logger } from "@/server/logger";
import { ensureGlobalOpencodeStarted } from "@/server/opencode/runtime";
import {
	installShutdownHandlers,
	registerDatabaseForShutdown,
	registerOpencodeRuntimeForShutdown,
	registerShutdownHandler,
} from "@/server/shutdown";
import { ensureTailscaleStarted } from "@/server/tailscale/startup";
import { createBootstrapCoordinator } from "./coordinator";
import { startPostDatabaseHousekeeping } from "./housekeeping";
import {
	type BootstrapResult,
	getBootstrapProcessState,
} from "./process-state";

const state = getBootstrapProcessState();

function installProcessOwnership(): void {
	if (!state.configInitialized) {
		initConfig();
		state.configInitialized = true;
	}
	if (!state.shutdownHandlersInstalled) {
		installShutdownHandlers();
		state.shutdownHandlersInstalled = true;
	}
	if (!state.opencodeShutdownRegistered) {
		registerOpencodeRuntimeForShutdown();
		state.opencodeShutdownRegistered = true;
	}
	if (!state.databaseShutdownRegistered) {
		registerDatabaseForShutdown();
		state.databaseShutdownRegistered = true;
	}
	if (!state.bootstrapShutdownRegistered) {
		registerShutdownHandler("server-bootstrap", () => {
			if (state.retryTimer) clearTimeout(state.retryTimer);
			if (state.sessionCleanupTimer) clearInterval(state.sessionCleanupTimer);
			state.retryTimer = null;
			state.sessionCleanupTimer = null;
		});
		state.bootstrapShutdownRegistered = true;
	}
}

const coordinator = createBootstrapCoordinator(state, {
	ensureDatabaseReady,
	startPostDatabaseHousekeeping: () =>
		startPostDatabaseHousekeeping(state, cleanupExpiredSessions),
	ensureEffectQueueWorkerStarted,
	ensureDoceSharedNetwork,
	ensureGlobalPnpmVolume,
	ensureGlobalOpencodeStarted,
	startImagePrewarm,
	startDefaultsBootstrap: async () => {
		const { startDefaultsBootstrap } = await import(
			"@/server/defaults/bootstrap"
		);
		startDefaultsBootstrap();
	},
	ensureTailscaleStarted,
	logError: (message, error) => logger.error({ error }, message),
});

/** Explicit callers get failure visibility; cooldown calls resolve without work. */
export function ensureServerBootstrap(): Promise<BootstrapResult> {
	installProcessOwnership();
	return coordinator.ensureServerBootstrap();
}

/** Safe for entry hooks and middleware module evaluation: it never blocks requests. */
export function startServerBootstrap(): void {
	void Promise.resolve()
		.then(installProcessOwnership)
		.then(coordinator.startServerBootstrap)
		.catch((error) => logger.error({ error }, "Server bootstrap failed"));
}
