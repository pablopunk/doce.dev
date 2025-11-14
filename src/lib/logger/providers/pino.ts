import pino from "pino";
import type { Logger } from "../types";

/**
 * Pino logger implementation
 * High-performance JSON logger for production use
 */
export class PinoLogger implements Logger {
	private logger: pino.Logger;

	constructor(namespace?: string) {
		const options: pino.LoggerOptions = {
			level: process.env.NODE_ENV === "production" ? "info" : "debug",
			timestamp: pino.stdTimeFunctions.isoTime,
			formatters: {
				level: (label) => ({ level: label }),
				bindings: (bindings) => {
					const { pid, hostname, ...rest } = bindings;
					return {
						...rest,
						...(namespace && { namespace }),
					};
				},
			},
			transport:
				process.env.NODE_ENV === "development"
					? {
							target: "pino-pretty",
							options: {
								colorize: true,
								translateTime: "HH:MM:ss Z",
								ignore: "pid,hostname",
							},
						}
					: undefined,
		};

		this.logger = pino(options);
	}

	debug(message: string, context?: Record<string, unknown>): void {
		this.logger.debug({ ...context }, message);
	}

	info(message: string, context?: Record<string, unknown>): void {
		this.logger.info({ ...context }, message);
	}

	warn(message: string, context?: Record<string, unknown>): void {
		this.logger.warn({ ...context }, message);
	}

	error(
		message: string,
		error?: Error,
		context?: Record<string, unknown>,
	): void {
		const errorContext = error
			? {
					error: {
						name: error.name,
						message: error.message,
						stack: error.stack,
					},
				}
			: {};

		this.logger.error({ ...context, ...errorContext }, message);
	}
}
