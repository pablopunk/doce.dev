/**
 * Logger interface
 * Defines the contract for all logger providers
 */

export interface Logger {
	debug(message: string, context?: Record<string, unknown>): void;
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
	error(
		message: string,
		error?: Error,
		context?: Record<string, unknown>,
	): void;
}

export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: Date;
	context?: Record<string, unknown>;
	error?: {
		name: string;
		message: string;
		stack?: string;
	};
}

export enum LogLevel {
	DEBUG = "debug",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
}
