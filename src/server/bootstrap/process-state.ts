export type BootstrapResult = "ready" | "cooldown";

export interface BootstrapProcessState {
	initialized: boolean;
	attemptPromise: Promise<BootstrapResult> | null;
	lastFailureAt: number | null;
	retryTimer: ReturnType<typeof setTimeout> | null;
	housekeepingStarted: boolean;
	sessionCleanupTimer: ReturnType<typeof setInterval> | null;
	configInitialized: boolean;
	shutdownHandlersInstalled: boolean;
	opencodeShutdownRegistered: boolean;
	databaseShutdownRegistered: boolean;
	bootstrapShutdownRegistered: boolean;
}

declare global {
	// This survives Vite's server-module reloads. Do not put module-local state
	// here: this is deliberately the one owner of process-wide boot resources.
	var __DOCE_SERVER_BOOTSTRAP_STATE__: BootstrapProcessState | undefined;
}

export function createBootstrapProcessState(): BootstrapProcessState {
	return {
		initialized: false,
		attemptPromise: null,
		lastFailureAt: null,
		retryTimer: null,
		housekeepingStarted: false,
		sessionCleanupTimer: null,
		configInitialized: false,
		shutdownHandlersInstalled: false,
		opencodeShutdownRegistered: false,
		databaseShutdownRegistered: false,
		bootstrapShutdownRegistered: false,
	};
}

export function getBootstrapProcessState(): BootstrapProcessState {
	globalThis.__DOCE_SERVER_BOOTSTRAP_STATE__ ??= createBootstrapProcessState();
	return globalThis.__DOCE_SERVER_BOOTSTRAP_STATE__;
}
