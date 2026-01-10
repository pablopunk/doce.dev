import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "@/server/logger";

const execAsync = promisify(exec);

export interface ExecOptions {
	cwd?: string;
	timeout?: number;
	maxBuffer?: number;
}

export interface ExecResult {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

/**
 * Execute a command asynchronously and return the result.
 * Replaces execSync to avoid blocking the event loop.
 */
export async function runCommand(
	command: string,
	options: ExecOptions = {},
): Promise<ExecResult> {
	const { cwd, timeout = 300_000, maxBuffer = 1024 * 1024 } = options;

	try {
		const { stdout, stderr } = await execAsync(command, {
			cwd,
			timeout,
			maxBuffer,
		});

		return {
			success: true,
			stdout,
			stderr,
			exitCode: 0,
		};
	} catch (error) {
		if (error instanceof Error) {
			// execAsync throws with stdout/stderr on non-zero exit
			const execError = error as any;
			return {
				success: false,
				stdout: execError.stdout || "",
				stderr: execError.stderr || error.message,
				exitCode: execError.code || 1,
			};
		}

		return {
			success: false,
			stdout: "",
			stderr: String(error),
			exitCode: 1,
		};
	}
}

export interface SpawnOptions {
	cwd?: string;
	timeout?: number;
}

/**
 * Spawn a process with output capture, similar to execSync but async.
 * Returns stdout/stderr as strings.
 */
export async function spawnCommand(
	command: string,
	args: string[],
	options: SpawnOptions = {},
): Promise<ExecResult> {
	return new Promise((resolve) => {
		const { cwd, timeout = 300_000 } = options;

		let stdout = "";
		let stderr = "";
		let timedOut = false;

		const proc = spawn(command, args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});

		// Set timeout
		const timeoutHandle = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGTERM");
		}, timeout);

		if (proc.stdout) {
			proc.stdout.on("data", (data: Buffer) => {
				stdout += data.toString();
			});
		}

		if (proc.stderr) {
			proc.stderr.on("data", (data: Buffer) => {
				stderr += data.toString();
			});
		}

		proc.on("close", (exitCode: number | null) => {
			clearTimeout(timeoutHandle);

			if (timedOut) {
				resolve({
					success: false,
					stdout,
					stderr: `Command timed out after ${timeout}ms`,
					exitCode: null,
				});
				return;
			}

			const code = exitCode ?? 1;
			resolve({
				success: code === 0,
				stdout,
				stderr,
				exitCode: code,
			});
		});

		proc.on("error", (err: Error) => {
			clearTimeout(timeoutHandle);
			logger.error({ error: err }, "Failed to spawn command");
			resolve({
				success: false,
				stdout,
				stderr: err.message,
				exitCode: 1,
			});
		});
	});
}
