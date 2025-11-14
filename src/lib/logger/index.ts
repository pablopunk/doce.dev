/**
 * Logger abstraction layer
 *
 * This is the public API for logging operations.
 * All application code should import from this file, not directly from providers.
 */

import { PinoLogger } from "./providers/pino";
import type { Logger } from "./types";

export type { Logger, LogEntry } from "./types";
export { LogLevel } from "./types";

/**
 * Create a logger instance
 * @param namespace Optional namespace for the logger (useful for identifying log sources)
 */
export function createLogger(namespace?: string): Logger {
	return new PinoLogger(namespace);
}

/**
 * Default logger instance (no namespace)
 */
export const logger = createLogger();
