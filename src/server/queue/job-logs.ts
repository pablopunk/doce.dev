import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getDataPath } from "@/server/projects/paths";

const JOB_LOGS_DIR_NAME = "queue-logs";
const DEFAULT_TAIL_BYTES = 64_000;
const MAX_CHUNK_BYTES = 64_000;

function sanitizeJobId(jobId: string): string {
	return jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getJobLogsDirPath(): string {
	return path.join(getDataPath(), JOB_LOGS_DIR_NAME);
}

function getJobLogFilePath(jobId: string): string {
	return path.join(getJobLogsDirPath(), `${sanitizeJobId(jobId)}.log`);
}

async function ensureJobLogsDir(): Promise<void> {
	await fs.mkdir(getJobLogsDirPath(), { recursive: true });
}

function truncateLogLine(line: string): string {
	const MAX_LINE_CHARS = 5_000;
	if (line.length <= MAX_LINE_CHARS) {
		return line;
	}

	return `${line.slice(0, MAX_LINE_CHARS)}...[truncated]`;
}

export async function appendJobLogLine(
	jobId: string,
	level: string,
	message: string,
): Promise<void> {
	const safeMessage = truncateLogLine(message);
	const line = `${new Date().toISOString()}\t${level}\t${safeMessage}\n`;

	await ensureJobLogsDir();
	await fs.appendFile(getJobLogFilePath(jobId), line);
}

export interface ReadJobLogTailResult {
	content: string;
	offset: number;
	truncated: boolean;
}

export async function readJobLogTail(
	jobId: string,
	maxBytes = DEFAULT_TAIL_BYTES,
): Promise<ReadJobLogTailResult> {
	const logPath = getJobLogFilePath(jobId);

	let stat: Awaited<ReturnType<typeof fs.stat>>;
	try {
		stat = await fs.stat(logPath);
	} catch {
		return { content: "", offset: 0, truncated: false };
	}

	const size = stat.size;
	if (size === 0) {
		return { content: "", offset: 0, truncated: false };
	}

	const start = Math.max(0, size - maxBytes);
	const length = size - start;
	const handle = await fs.open(logPath, "r");

	try {
		const buffer = Buffer.alloc(length);
		await handle.read(buffer, 0, length, start);
		return {
			content: buffer.toString("utf8"),
			offset: size,
			truncated: start > 0,
		};
	} finally {
		await handle.close();
	}
}

export interface ReadJobLogFromOffsetResult {
	content: string;
	nextOffset: number;
}

export async function readJobLogFromOffset(
	jobId: string,
	offset: number,
	maxBytes = MAX_CHUNK_BYTES,
): Promise<ReadJobLogFromOffsetResult> {
	if (offset < 0) {
		return { content: "", nextOffset: 0 };
	}

	const logPath = getJobLogFilePath(jobId);

	let stat: Awaited<ReturnType<typeof fs.stat>>;
	try {
		stat = await fs.stat(logPath);
	} catch {
		return { content: "", nextOffset: 0 };
	}

	const size = stat.size;
	if (offset >= size) {
		return { content: "", nextOffset: size };
	}

	const bytesToRead = Math.min(maxBytes, size - offset);
	const handle = await fs.open(logPath, "r");

	try {
		const buffer = Buffer.alloc(bytesToRead);
		await handle.read(buffer, 0, bytesToRead, offset);
		return {
			content: buffer.toString("utf8"),
			nextOffset: offset + bytesToRead,
		};
	} finally {
		await handle.close();
	}
}
