/**
 * Graceful shutdown handling for doce.dev
 *
 * Handles SIGTERM/SIGINT to cleanly shutdown:
 * - Queue worker
 * - OpenCode runtime
 * - Database connections
 */

import { Effect } from "effect";
import { getConfigValue } from "@/server/config";
import { sqlite } from "@/server/db/client";
import { logger } from "@/server/logger";

type CleanupFn = () => Promise<void> | void;
type EffectCleanupFn = () => Effect.Effect<void, unknown>;

interface ShutdownHandler {
	name: string;
	cleanup: CleanupFn;
}

interface EffectShutdownHandler {
	name: string;
	cleanup: EffectCleanupFn;
}

const handlers: ShutdownHandler[] = [];
const effectHandlers: EffectShutdownHandler[] = [];
let isShuttingDown = false;

/**
 * Register a cleanup function to be called during shutdown
 */
export function registerShutdownHandler(
	name: string,
	cleanup: CleanupFn,
): void {
	handlers.push({ name, cleanup });
}

/**
 * Register an Effect-based cleanup function
 */
export function registerEffectShutdownHandler(
	name: string,
	cleanup: EffectCleanupFn,
): void {
	effectHandlers.push({ name, cleanup });
}

/**
 * Register the queue worker for graceful shutdown
 */
export function registerQueueWorkerForShutdown(
	stopFn: () => Promise<void>,
): void {
	registerShutdownHandler("queue-worker", async () => {
		logger.info("Shutting down queue worker...");
		await stopFn();
		logger.info("Queue worker stopped");
	});
}

/**
 * Register the OpenCode runtime for graceful shutdown
 */
export function registerOpencodeRuntimeForShutdown(): void {
	registerShutdownHandler("opencode-runtime", (): Promise<void> | void => {
		const process = globalThis.__DOCE_OPENCODE_PROCESS__;
		if (process && process.exitCode === null && !process.killed) {
			logger.info("Shutting down OpenCode runtime...");
			process.kill("SIGTERM");

			// Return a promise that resolves when process exits or times out
			return new Promise<void>((resolve) => {
				const timeout = setTimeout(() => {
					logger.warn("OpenCode runtime did not exit gracefully, forcing kill");
					process.kill("SIGKILL");
					resolve();
				}, 5_000);

				process.once("exit", () => {
					clearTimeout(timeout);
					logger.info("OpenCode runtime stopped");
					resolve();
				});
			});
		}
	});
}

/**
 * Register database connections for graceful shutdown
 */
export function registerDatabaseForShutdown(): void {
	registerShutdownHandler("database", () => {
		logger.info("Closing database connections...");
		try {
			sqlite.close();
			logger.info("Database connections closed");
		} catch (error) {
			logger.warn({ error }, "Error closing database (may already be closed)");
		}
	});
}

/**
 * Perform graceful shutdown
 */
async function performShutdown(signal: string): Promise<void> {
	if (isShuttingDown) {
		logger.info("Shutdown already in progress, waiting...");
		return;
	}

	isShuttingDown = true;
	const timeoutMs = getConfigValue("SHUTDOWN_TIMEOUT_MS");

	logger.info({ signal, timeoutMs }, "Starting graceful shutdown...");

	const shutdownPromise = (async () => {
		// Run regular handlers
		for (const { name, cleanup } of handlers) {
			try {
				logger.debug({ handler: name }, "Running shutdown handler");
				await cleanup();
			} catch (error) {
				logger.error({ error, handler: name }, "Shutdown handler failed");
			}
		}

		// Run Effect handlers
		for (const { name, cleanup } of effectHandlers) {
			try {
				logger.debug({ handler: name }, "Running Effect shutdown handler");
				await Effect.runPromise(cleanup().pipe(Effect.timeout(timeoutMs)));
			} catch (error) {
				logger.error(
					{ error, handler: name },
					"Effect shutdown handler failed",
				);
			}
		}

		logger.info("Graceful shutdown complete");
	})();

	// Enforce timeout
	const timeoutPromise = new Promise<void>((_, reject) => {
		setTimeout(() => {
			reject(new Error(`Shutdown timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});

	try {
		await Promise.race([shutdownPromise, timeoutPromise]);
		process.exit(0);
	} catch (error) {
		logger.error(
			{ error },
			"Graceful shutdown failed or timed out, forcing exit",
		);
		process.exit(1);
	}
}

/**
 * Install shutdown handlers for SIGTERM and SIGINT
 */
export function installShutdownHandlers(): void {
	// Don't install handlers in test environment or if already installed
	if (process.env.NODE_ENV === "test") {
		return;
	}

	// Handle SIGTERM (Docker stop, Kubernetes, etc.)
	process.on("SIGTERM", () => {
		void performShutdown("SIGTERM");
	});

	// Handle SIGINT (Ctrl+C)
	process.on("SIGINT", () => {
		void performShutdown("SIGINT");
	});

	// Handle uncaught exceptions
	process.on("uncaughtException", (error) => {
		logger.fatal({ error }, "Uncaught exception");
		void performShutdown("uncaughtException");
	});

	// Handle unhandled rejections
	process.on("unhandledRejection", (reason) => {
		logger.fatal({ reason }, "Unhandled rejection");
		void performShutdown("unhandledRejection");
	});

	logger.info("Shutdown handlers installed (SIGTERM, SIGINT)");
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
	return isShuttingDown;
}
