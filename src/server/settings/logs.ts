import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getDataPath } from "@/server/projects/paths";

const HOST_LOGS_DIR = path.join(getDataPath(), "logs");
const HOST_LOG_FILE_PATH = path.join(HOST_LOGS_DIR, "server.log");

export interface SettingsLogsPageData {
	logFilePath: string;
}

export function getHostLogFilePath(): string {
	return HOST_LOG_FILE_PATH;
}

export async function ensureHostLogsDir(): Promise<void> {
	await fs.mkdir(HOST_LOGS_DIR, { recursive: true });
}

export async function getSettingsLogsPageData(): Promise<SettingsLogsPageData> {
	await ensureHostLogsDir();
	return { logFilePath: HOST_LOG_FILE_PATH };
}

export async function readHostLogTail(
	maxBytes: number = 64000,
): Promise<{ content: string; offset: number; truncated: boolean }> {
	try {
		const stats = await fs.stat(HOST_LOG_FILE_PATH);
		const fileSize = stats.size;

		if (fileSize === 0) {
			return { content: "", offset: 0, truncated: false };
		}

		if (fileSize <= maxBytes) {
			const content = await fs.readFile(HOST_LOG_FILE_PATH, "utf-8");
			return { content, offset: fileSize, truncated: false };
		}

		const buffer = Buffer.alloc(maxBytes);
		const fh = await fs.open(HOST_LOG_FILE_PATH, "r");
		try {
			const startOffset = fileSize - maxBytes;
			await fh.read(buffer, 0, maxBytes, startOffset);
			const content = buffer.toString("utf-8");
			const firstNewline = content.indexOf("\n");
			const trimmedContent =
				firstNewline >= 0 ? content.slice(firstNewline + 1) : content;

			return {
				content: trimmedContent,
				offset: fileSize,
				truncated: true,
			};
		} finally {
			await fh.close();
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { content: "", offset: 0, truncated: false };
		}
		throw error;
	}
}

export async function readHostLogFromOffset(
	offset: number,
): Promise<{ content: string; nextOffset: number }> {
	try {
		const stats = await fs.stat(HOST_LOG_FILE_PATH);
		const fileSize = stats.size;

		if (offset >= fileSize) {
			return { content: "", nextOffset: fileSize };
		}

		const fh = await fs.open(HOST_LOG_FILE_PATH, "r");
		try {
			const bytesToRead = fileSize - offset;
			const buffer = Buffer.alloc(bytesToRead);
			await fh.read(buffer, 0, bytesToRead, offset);
			return {
				content: buffer.toString("utf-8"),
				nextOffset: fileSize,
			};
		} finally {
			await fh.close();
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { content: "", nextOffset: 0 };
		}
		throw error;
	}
}
