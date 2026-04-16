import * as fs from "node:fs/promises";
import * as path from "node:path";
import pino, { type LoggerOptions } from "pino";
import { getQueueJobLogContext } from "@/server/queue/job-log-context";
import { appendJobLogLine } from "@/server/queue/job-logs";
import { getHostLogFilePath } from "@/server/settings/logs";

function getLogLevel(): string {
	try {
		const { getConfigValue } = require("@/server/config");
		const logLevel = getConfigValue("LOG_LEVEL");
		if (logLevel) return logLevel;
	} catch {}

	const isDev = process.env.NODE_ENV !== "production";
	return process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");
}

function getNodeEnv(): string {
	try {
		const { getConfigValue } = require("@/server/config");
		return getConfigValue("NODE_ENV");
	} catch {
		return process.env.NODE_ENV ?? "development";
	}
}

const isDev = getNodeEnv() !== "production";

const options: LoggerOptions = {
	level: getLogLevel(),
	hooks: {
		logMethod(inputArgs, method, level) {
			const context = getQueueJobLogContext();
			if (context) {
				const message = serializeLogArgs(inputArgs);
				const levelLabel = mapPinoLevel(level);
				void appendJobLogLine(context.jobId, levelLabel, message).catch(
					() => {},
				);
			}

			return method.apply(this, inputArgs);
		},
	},
};

function mapPinoLevel(level: number): string {
	if (level >= 60) return "fatal";
	if (level >= 50) return "error";
	if (level >= 40) return "warn";
	if (level >= 30) return "info";
	if (level >= 20) return "debug";
	return "trace";
}

function serializeLogArgs(inputArgs: unknown[]): string {
	const text = inputArgs
		.map((arg) => {
			if (typeof arg === "string") {
				return arg;
			}

			if (arg instanceof Error) {
				return `${arg.name}: ${arg.message}`;
			}

			try {
				return JSON.stringify(arg);
			} catch {
				return "[unserializable]";
			}
		})
		.join(" ")
		.trim();

	return text || "[empty-log-message]";
}

async function ensureHostLogDestination(): Promise<void> {
	const logFilePath = getHostLogFilePath();
	await fs.mkdir(path.dirname(logFilePath), { recursive: true });
}

function createLogger() {
	const streams: pino.StreamEntry[] = [];

	if (isDev) {
		streams.push({
			stream: pino.transport({
				target: "pino-pretty",
				options: { colorize: true },
			}),
		});
	} else {
		streams.push({ stream: pino.destination(1) });
	}

	const hostLogFilePath = getHostLogFilePath();
	void ensureHostLogDestination().catch(() => {});
	streams.push({
		stream: pino.destination({
			dest: hostLogFilePath,
			sync: false,
			mkdir: true,
		}),
	});

	return pino(options, pino.multistream(streams));
}

export const logger = createLogger();

export type Logger = typeof logger;
