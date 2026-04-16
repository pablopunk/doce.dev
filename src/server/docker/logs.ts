import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { runCommand } from "@/server/utils/execAsync";
import { isComposeV1 } from "./composeVersion";

/**
 * Get the compose command parts based on detected version.
 * Returns ["docker-compose"] for v1 or ["docker", "compose"] for v2.
 */
function getComposeCmd(): string[] {
	return isComposeV1() ? ["docker-compose"] : ["docker", "compose"];
}

const LOG_FILE_NAME = "docker.log";

interface ChildProcessWithCleanup extends ChildProcess {
	_cleanup?: () => void;
}

export interface ContainerLogSource {
	kind: "preview" | "production";
	projectId: string;
	projectPath: string;
	productionHash?: string;
}

// Map to track running container log streaming processes
// Key: source key, Value: ChildProcess
const streamingProcesses = new Map<string, ChildProcessWithCleanup>();

function getPreviewProjectName(projectId: string): string {
	return `doce_${projectId}`;
}

function getProductionProjectName(projectId: string, hash?: string): string {
	if (hash) {
		return `doce_prod_${projectId.slice(0, 8)}_${hash}`;
	}
	return `doce_prod_${projectId}`;
}

function getStreamingKey(source: ContainerLogSource): string {
	return source.kind === "production"
		? `production:${source.projectId}:${source.productionHash ?? "current"}`
		: `preview:${source.projectId}`;
}

function getComposeProjectName(source: ContainerLogSource): string {
	return source.kind === "production"
		? getProductionProjectName(source.projectId, source.productionHash)
		: getPreviewProjectName(source.projectId);
}

function getComposeServiceName(source: ContainerLogSource): string {
	return source.kind === "production" ? "production" : "preview";
}

/**
 * Ensure the logs directory exists.
 */
export async function ensureLogsDir(logsDir: string): Promise<void> {
	await fs.mkdir(logsDir, { recursive: true });
}

/**
 * Get the path to the docker log file.
 */
export function getLogFilePath(logsDir: string): string {
	return path.join(logsDir, LOG_FILE_NAME);
}

/**
 * Write a host marker line to the log file.
 * Format: [host 2025-01-01T12:00:00.000Z] message
 */
export async function writeHostMarker(
	logsDir: string,
	message: string,
): Promise<void> {
	try {
		await ensureLogsDir(logsDir);
		const timestamp = new Date().toISOString();
		const line = `[host ${timestamp}] ${message}\n`;
		await fs.appendFile(getLogFilePath(logsDir), line);
	} catch (err) {
		logger.warn(
			{ error: err, logsDir, message },
			"Failed to write host marker",
		);
	}
}

/**
 * Append text to the log file.
 */
export async function appendToLogFile(
	logsDir: string,
	text: string,
): Promise<void> {
	try {
		await ensureLogsDir(logsDir);
		await fs.appendFile(getLogFilePath(logsDir), text);
	} catch (err) {
		logger.warn({ error: err, logsDir }, "Failed to append to log file");
	}
}

/**
 * Append docker logs with marker.
 */
export async function appendDockerLog(
	logsDir: string,
	text: string,
	_isStderr: boolean = false,
): Promise<void> {
	if (!text) return;
	try {
		await ensureLogsDir(logsDir);
		const lines = text.split("\n").filter((l) => l.trim());
		const markedText = lines.map((line) => `[docker] ${line}`).join("\n");
		if (markedText) {
			await fs.appendFile(getLogFilePath(logsDir), `${markedText}\n`);
		}
	} catch (err) {
		logger.warn({ error: err, logsDir }, "Failed to append docker log");
	}
}

/**
 * Append app/container logs with marker.
 */
export async function appendAppLog(
	logsDir: string,
	text: string,
	_isStderr: boolean = false,
): Promise<void> {
	if (!text) return;
	try {
		await ensureLogsDir(logsDir);
		const lines = text.split("\n").filter((l) => l.trim());
		const markedText = lines.map((line) => `[app] ${line}`).join("\n");
		if (markedText) {
			await fs.appendFile(getLogFilePath(logsDir), `${markedText}\n`);
		}
	} catch (err) {
		logger.warn({ error: err, logsDir }, "Failed to append app log");
	}
}

/**
 * Get container logs from the preview service and append them to the log file.
 * This captures logs from the app container (e.g., pnpm dev output).
 */
export async function captureContainerLogs(
	source: ContainerLogSource,
): Promise<void> {
	try {
		const logsDir = path.join(source.projectPath, "logs");
		await ensureLogsDir(logsDir);

		const projectName = getComposeProjectName(source);
		const serviceName = getComposeServiceName(source);
		const composeCmd = getComposeCmd().join(" ");
		const cmd = `${composeCmd} --project-name ${projectName} logs --no-log-prefix ${serviceName}`;

		const result = await runCommand(cmd, {
			cwd: source.projectPath,
			timeout: 30_000,
		});

		if (result.success && result.stdout && result.stdout.trim()) {
			await appendAppLog(logsDir, result.stdout, false);
		}
	} catch (err) {
		logger.debug(
			{ error: err, projectId: source.projectId, kind: source.kind },
			"Failed to capture container logs",
		);
	}
}

/**
 * Strip docker compose log prefix (e.g., "preview | " or "preview-1 | ")
 */
function stripLogPrefix(line: string): string {
	// Docker compose logs format: "service-name | log message"
	// Match pattern: anything followed by " | "
	const match = line.match(/^[^\s|]+\s*\|\s*(.*)/);
	return match?.[1] ?? line;
}

/**
 * Start continuous streaming of container logs from the preview service.
 * Spawns a long-running `docker compose logs -f` process that pipes output
 * to the log file as it's generated.
 */
export function streamContainerLogs(source: ContainerLogSource): void {
	try {
		const streamingKey = getStreamingKey(source);
		stopStreamingContainerLogs(source);

		const logsDir = path.join(source.projectPath, "logs");
		const projectName = getComposeProjectName(source);
		const serviceName = getComposeServiceName(source);

		logger.debug(
			{
				projectId: source.projectId,
				kind: source.kind,
				productionHash: source.productionHash,
			},
			"Starting container log streaming",
		);

		const composeCmd = getComposeCmd();
		const command = composeCmd[0] ?? "docker";
		const proc = spawn(
			command,
			[
				...composeCmd.slice(1),
				"--project-name",
				projectName,
				"logs",
				"-f",
				"--tail=100",
				serviceName,
			],
			{
				cwd: source.projectPath,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);

		streamingProcesses.set(streamingKey, proc);

		// Handle stdout and stderr (combined, no distinction)
		const setupStreamHandler = (
			stream: NodeJS.ReadableStream | null,
		): (() => void) => {
			if (!stream) return () => {};
			let buffer = "";

			const onData = async (chunk: Buffer) => {
				buffer += chunk.toString();
				const lines = buffer.split("\n");
				// Keep the last incomplete line in the buffer
				buffer = lines.pop() || "";

				// Process complete lines, strip prefixes, and append
				const processedLines = lines
					.map((line) => stripLogPrefix(line))
					.filter((line) => line.trim())
					.join("\n");

				if (processedLines) {
					try {
						await appendAppLog(logsDir, processedLines, false);
					} catch (err) {
						logger.warn(
							{ error: err, projectId: source.projectId, kind: source.kind },
							"Failed to append streamed app log",
						);
					}
				}
			};

			stream.on("data", onData);

			// Return cleanup function to remove listener
			return () => {
				stream.removeListener("data", onData);
			};
		};

		const cleanupStdout = setupStreamHandler(proc.stdout);
		const cleanupStderr = setupStreamHandler(proc.stderr);

		// Handle process exit
		const onExit = (code: number | null) => {
			cleanupStdout();
			cleanupStderr();
			streamingProcesses.delete(streamingKey);
			logger.info(
				{ projectId: source.projectId, kind: source.kind, exitCode: code },
				"Container log streaming process exited",
			);
		};

		// Handle process error
		const onError = (err: Error) => {
			cleanupStdout();
			cleanupStderr();
			streamingProcesses.delete(streamingKey);
			logger.warn(
				{ error: err, projectId: source.projectId, kind: source.kind },
				"Container log streaming process error",
			);
		};

		proc.on("exit", onExit);
		proc.on("error", onError);

		// Store cleanup functions for manual cleanup (in stopStreamingContainerLogs)
		// ChildProcess type doesn't expose _cleanup property; using interface to add custom cleanup tracker
		const procWithCleanup = proc as ChildProcessWithCleanup;
		procWithCleanup._cleanup = () => {
			cleanupStdout();
			cleanupStderr();
		};

		logger.info(
			{
				projectId: source.projectId,
				kind: source.kind,
				productionHash: source.productionHash,
			},
			"Container log streaming started successfully",
		);
	} catch (err) {
		logger.error(
			{
				error: err,
				projectId: source.projectId,
				kind: source.kind,
				productionHash: source.productionHash,
			},
			"Failed to start container log streaming",
		);
	}
}

/**
 * Stop streaming container logs for a project.
 */
export function stopStreamingContainerLogs(source: ContainerLogSource): void {
	const streamingKey = getStreamingKey(source);
	const proc = streamingProcesses.get(streamingKey);
	if (proc) {
		try {
			// Call cleanup functions to remove event listeners
			// ChildProcess doesn't expose _cleanup; using interface to access custom property set in startStreamingContainerLogs
			const procWithCleanup = proc as ChildProcessWithCleanup;
			const cleanup = procWithCleanup._cleanup;
			if (cleanup && typeof cleanup === "function") {
				cleanup();
			}

			proc.kill("SIGTERM");
			streamingProcesses.delete(streamingKey);
			logger.debug(
				{
					projectId: source.projectId,
					kind: source.kind,
					productionHash: source.productionHash,
				},
				"Stopped container log streaming",
			);
		} catch (err) {
			logger.warn(
				{
					error: err,
					projectId: source.projectId,
					kind: source.kind,
					productionHash: source.productionHash,
				},
				"Failed to stop container log streaming",
			);
		}
	}
}

/**
 * Check if log streaming is currently active for a project.
 */
export function isStreamingActive(source: ContainerLogSource): boolean {
	const proc = streamingProcesses.get(getStreamingKey(source));
	if (!proc) return false;
	// Check if process is still running (not killed)
	return proc.exitCode === null && proc.signalCode === null;
}

/**
 * Read the last N bytes of the log file.
 */
export async function readLogTail(
	logsDir: string,
	maxBytes: number = 64000,
): Promise<{ content: string; offset: number; truncated: boolean }> {
	const logPath = getLogFilePath(logsDir);

	try {
		const stats = await fs.stat(logPath);
		const fileSize = stats.size;

		if (fileSize === 0) {
			return { content: "", offset: 0, truncated: false };
		}

		if (fileSize <= maxBytes) {
			const content = await fs.readFile(logPath, "utf-8");
			return { content, offset: fileSize, truncated: false };
		}

		// Read last maxBytes
		const buffer = Buffer.alloc(maxBytes);
		const fh = await fs.open(logPath, "r");
		try {
			const startOffset = fileSize - maxBytes;
			await fh.read(buffer, 0, maxBytes, startOffset);
			const content = buffer.toString("utf-8");

			// Find the first complete line (skip partial line at start)
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
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return { content: "", offset: 0, truncated: false };
		}
		logger.error({ error: err, logsDir }, "Failed to read log tail");
		throw err;
	}
}

/**
 * Read log file starting from a given offset.
 */
export async function readLogFromOffset(
	logsDir: string,
	offset: number,
): Promise<{ content: string; nextOffset: number }> {
	const logPath = getLogFilePath(logsDir);

	try {
		const stats = await fs.stat(logPath);
		const fileSize = stats.size;

		if (offset >= fileSize) {
			return { content: "", nextOffset: fileSize };
		}

		const fh = await fs.open(logPath, "r");
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
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return { content: "", nextOffset: 0 };
		}
		throw err;
	}
}

/**
 * Extract the last relevant error line from docker logs.
 * Used for error messages in the UI.
 */
export async function extractLastErrorLine(
	logsDir: string,
): Promise<string | null> {
	try {
		const { content } = await readLogTail(logsDir, 64000);
		if (!content) {
			return null;
		}

		const lines = content
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && l.length < 300)
			.filter((l) => !l.startsWith("[host")); // Skip host markers unless no other lines

		// Strong error patterns
		const errorPatterns = [
			/error/i,
			/failed/i,
			/failure/i,
			/fatal/i,
			/panic/i,
			/cannot/i,
			/permission denied/i,
			/address already in use/i,
			/no such file/i,
			/not found/i,
			/exited with code/i,
			/exit code/i,
			/healthcheck/i,
			/unhealthy/i,
		];

		// Look for strong error lines (newest to oldest)
		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i];
			if (line && errorPatterns.some((p) => p.test(line))) {
				return truncateLine(line);
			}
		}

		// Fallback to useful signal patterns
		const signalPatterns = [
			/warning/i,
			/deprecated/i,
			/listening/i,
			/ready/i,
			/started/i,
			/building/i,
			/pulling/i,
			/created/i,
			/recreated/i,
			/restarting/i,
		];

		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i];
			if (line && signalPatterns.some((p) => p.test(line))) {
				return truncateLine(line);
			}
		}

		// Last resort: newest non-empty line
		const lastLine = lines[lines.length - 1];
		return lastLine ? truncateLine(lastLine) : null;
	} catch {
		return null;
	}
}

function truncateLine(line: string): string {
	if (line.length <= 200) {
		return line;
	}
	return `${line.slice(0, 197)}...`;
}

/**
 * Check if containers are running for a project by running docker compose ps.
 */
async function checkContainersRunning(
	source: ContainerLogSource,
): Promise<boolean> {
	try {
		const projectName = getComposeProjectName(source);
		const composeCmd = getComposeCmd().join(" ");
		const result = await runCommand(
			`${composeCmd} --project-name ${projectName} ps --format json`,
			{
				cwd: source.projectPath,
				timeout: 10_000,
			},
		);

		if (!result.success || !result.stdout) {
			return false;
		}

		// Parse the JSON output - each line is a container
		const lines = result.stdout
			.trim()
			.split("\n")
			.filter((l) => l.trim());
		for (const line of lines) {
			try {
				const container = JSON.parse(line) as { State?: string };
				if (container.State === "running") {
					return true;
				}
			} catch {
				// Ignore parse errors for individual lines
			}
		}
		return false;
	} catch (err) {
		logger.debug(
			{
				error: err,
				projectId: source.projectId,
				kind: source.kind,
				productionHash: source.productionHash,
			},
			"Failed to check if containers are running",
		);
		return false;
	}
}

/**
 * Ensure log streaming is active for a project.
 * Creates logs directory if needed, and starts streaming if containers are running.
 * This is idempotent - safe to call multiple times.
 *
 * @returns Object indicating whether streaming was started and if containers are running
 */
export async function ensureLogStreaming(
	source: ContainerLogSource,
): Promise<{ streamingStarted: boolean; containersRunning: boolean }> {
	const logsDir = path.join(source.projectPath, "logs");

	// Ensure logs directory exists
	await ensureLogsDir(logsDir);

	// Check if streaming is already active
	if (isStreamingActive(source)) {
		return { streamingStarted: false, containersRunning: true };
	}

	// Check if containers are running
	const containersRunning = await checkContainersRunning(source);
	if (!containersRunning) {
		return { streamingStarted: false, containersRunning: false };
	}

	// Containers are running but streaming is not active - start streaming
	logger.info(
		{
			projectId: source.projectId,
			kind: source.kind,
			productionHash: source.productionHash,
		},
		"Containers running but log streaming not active, starting streaming",
	);
	streamContainerLogs(source);

	return { streamingStarted: true, containersRunning: true };
}
