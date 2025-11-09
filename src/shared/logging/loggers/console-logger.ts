import type { LogEntry, Logger } from "../logger.interface";
import { LogLevel } from "../logger.interface";

/**
 * Console logger implementation
 * Outputs structured logs to console
 */
export class ConsoleLogger implements Logger {
	constructor(private readonly namespace?: string) {}

	debug(message: string, context?: Record<string, unknown>): void {
		this.log(LogLevel.DEBUG, message, context);
	}

	info(message: string, context?: Record<string, unknown>): void {
		this.log(LogLevel.INFO, message, context);
	}

	warn(message: string, context?: Record<string, unknown>): void {
		this.log(LogLevel.WARN, message, context);
	}

	error(
		message: string,
		error?: Error,
		context?: Record<string, unknown>,
	): void {
		const entry: LogEntry = {
			level: LogLevel.ERROR,
			message,
			timestamp: new Date(),
			context,
		};

		if (error) {
			entry.error = {
				name: error.name,
				message: error.message,
				stack: error.stack,
			};
		}

		this.output(entry);
	}

	private log(
		level: LogLevel,
		message: string,
		context?: Record<string, unknown>,
	): void {
		const entry: LogEntry = {
			level,
			message,
			timestamp: new Date(),
			context,
		};

		this.output(entry);
	}

	private output(entry: LogEntry): void {
		const prefix = this.namespace ? `[${this.namespace}]` : "";
		const timestamp = entry.timestamp.toISOString();
		const level = entry.level.toUpperCase().padEnd(5);

		const baseMessage = `${timestamp} ${level} ${prefix} ${entry.message}`;

		switch (entry.level) {
			case LogLevel.DEBUG:
				console.debug(baseMessage, entry.context || "");
				break;
			case LogLevel.INFO:
				console.info(baseMessage, entry.context || "");
				break;
			case LogLevel.WARN:
				console.warn(baseMessage, entry.context || "");
				break;
			case LogLevel.ERROR:
				console.error(baseMessage, entry.error || "", entry.context || "");
				break;
		}
	}
}
