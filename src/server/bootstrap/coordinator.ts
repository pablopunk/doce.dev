import type { BootstrapProcessState, BootstrapResult } from "./process-state";

export const STARTUP_RETRY_COOLDOWN_MS = 5_000;

type MaybePromise = void | Promise<void>;

export interface BootstrapOperations {
	ensureDatabaseReady: () => Promise<void>;
	startPostDatabaseHousekeeping: () => void;
	ensureEffectQueueWorkerStarted: () => MaybePromise;
	ensureDoceSharedNetwork: () => Promise<void>;
	ensureGlobalPnpmVolume: () => Promise<void>;
	ensureGlobalOpencodeStarted: () => Promise<void>;
	startImagePrewarm: () => MaybePromise;
	startDefaultsBootstrap: () => MaybePromise;
	ensureTailscaleStarted: () => MaybePromise;
	logError: (message: string, error: unknown) => void;
}

export interface BootstrapCoordinatorOptions {
	now?: () => number;
	setTimeout?: typeof setTimeout;
	clearTimeout?: typeof clearTimeout;
	cooldownMs?: number;
}

export interface BootstrapCoordinator {
	ensureServerBootstrap: () => Promise<BootstrapResult>;
	startServerBootstrap: () => void;
}

function unref(timer: ReturnType<typeof setTimeout>): void {
	(timer as { unref?: () => void }).unref?.();
}

/**
 * Coordinates startup without coupling it to an HTTP request. Only database and
 * OpenCode failures fail an attempt; the remaining background work retains its
 * former detached/non-fatal boundaries.
 */
export function createBootstrapCoordinator(
	state: BootstrapProcessState,
	operations: BootstrapOperations,
	options: BootstrapCoordinatorOptions = {},
): BootstrapCoordinator {
	const now = options.now ?? Date.now;
	const scheduleTimeout = options.setTimeout ?? setTimeout;
	const cancelTimeout = options.clearTimeout ?? clearTimeout;
	const cooldownMs = options.cooldownMs ?? STARTUP_RETRY_COOLDOWN_MS;

	const detached = (name: string, operation: () => MaybePromise): void => {
		void Promise.resolve()
			.then(operation)
			.catch((error) => operations.logError(`${name} failed`, error));
	};

	const nonFatal = async (name: string, operation: () => Promise<void>) => {
		try {
			await Promise.resolve().then(operation);
		} catch (error) {
			operations.logError(`${name} failed`, error);
		}
	};

	const clearRetryTimer = (): void => {
		if (state.retryTimer) {
			cancelTimeout(state.retryTimer);
			state.retryTimer = null;
		}
	};

	let ensureServerBootstrap: () => Promise<BootstrapResult>;
	const scheduleRetry = (): void => {
		if (state.retryTimer || state.lastFailureAt === null || state.initialized) {
			return;
		}

		const remaining = Math.max(0, state.lastFailureAt + cooldownMs - now());
		state.retryTimer = scheduleTimeout(() => {
			state.retryTimer = null;
			startServerBootstrap();
		}, remaining);
		unref(state.retryTimer);
	};

	const runOrderedStartup = async (): Promise<void> => {
		await operations.ensureDatabaseReady();
		operations.startPostDatabaseHousekeeping();
		detached(
			"Effect queue worker startup",
			operations.ensureEffectQueueWorkerStarted,
		);
		await nonFatal(
			"Shared Docker network startup",
			operations.ensureDoceSharedNetwork,
		);
		await nonFatal(
			"Global pnpm volume startup",
			operations.ensureGlobalPnpmVolume,
		);
		await operations.ensureGlobalOpencodeStarted();
		detached("Image prewarm", operations.startImagePrewarm);
		detached("Defaults bootstrap", operations.startDefaultsBootstrap);
		detached("Tailscale auto-start", operations.ensureTailscaleStarted);
	};

	ensureServerBootstrap = (): Promise<BootstrapResult> => {
		if (state.initialized) return Promise.resolve("ready");
		if (state.attemptPromise) return state.attemptPromise;

		if (
			state.lastFailureAt !== null &&
			now() < state.lastFailureAt + cooldownMs
		) {
			scheduleRetry();
			return Promise.resolve("cooldown");
		}

		clearRetryTimer();
		const attempt = Promise.resolve()
			.then(runOrderedStartup)
			.then(
				() => {
					state.initialized = true;
					state.lastFailureAt = null;
					clearRetryTimer();
					state.attemptPromise = null;
					return "ready" as const;
				},
				(error) => {
					state.initialized = false;
					state.lastFailureAt = now();
					scheduleRetry();
					operations.logError("Server bootstrap failed", error);
					state.attemptPromise = null;
					throw error;
				},
			);

		state.attemptPromise = attempt;
		return attempt;
	};

	const startServerBootstrap = (): void => {
		void Promise.resolve()
			.then(() => ensureServerBootstrap())
			// ensureServerBootstrap records failed attempts; this handler only keeps
			// the detached entrypoint from becoming an unhandled rejection.
			.catch(() => {});
	};

	return { ensureServerBootstrap, startServerBootstrap };
}
