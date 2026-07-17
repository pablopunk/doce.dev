import { logger } from "@/server/logger";
import type { BootstrapProcessState } from "./process-state";

const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function unref(timer: ReturnType<typeof setInterval>): void {
	(timer as { unref?: () => void }).unref?.();
}

export function startPostDatabaseHousekeeping(
	state: BootstrapProcessState,
	cleanupExpiredSessions: () => Promise<void>,
): void {
	if (state.housekeepingStarted) return;
	state.housekeepingStarted = true;

	const cleanup = (): void => {
		void Promise.resolve()
			.then(cleanupExpiredSessions)
			.catch((error) =>
				logger.error({ error }, "Failed to cleanup expired sessions"),
			);
	};

	cleanup();
	state.sessionCleanupTimer = setInterval(cleanup, SESSION_CLEANUP_INTERVAL_MS);
	unref(state.sessionCleanupTimer);
}
