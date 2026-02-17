import pino, { type LoggerOptions } from "pino";
import { getQueueJobLogContext } from "@/server/queue/job-log-context";
import { appendJobLogLine } from "@/server/queue/job-logs";

const isDev = process.env.NODE_ENV !== "production";

const options: LoggerOptions = {
	level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
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

if (isDev) {
	options.transport = {
		target: "pino-pretty",
		options: {
			colorize: true,
		},
	};
}

export const logger = pino(options);

export type Logger = typeof logger;
