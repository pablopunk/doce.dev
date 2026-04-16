import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getConfigValue } from "@/server/config";
import { checkOpencodeServerReady } from "@/server/health/checkHealthEndpoint";
import { logger } from "@/server/logger";
import { ensureGlobalOpencodeConfig } from "@/server/opencode/config";
import { getDataPath } from "@/server/projects/paths";
import { spawnCommand } from "@/server/utils/execAsync";

const START_TIMEOUT_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 250;

declare global {
	// eslint-disable-next-line no-var
	var __DOCE_OPENCODE_PROCESS__: ChildProcess | undefined;
	// eslint-disable-next-line no-var
	var __DOCE_OPENCODE_START_PROMISE__: Promise<void> | undefined;
}

function getOpencodePort(): number {
	// Use config system, fallback to env for backwards compatibility
	try {
		return getConfigValue("DOCE_OPENCODE_PORT");
	} catch {
		// Config not initialized yet, use env directly
		const configured = process.env.DOCE_OPENCODE_PORT;
		if (!configured) {
			return 4096;
		}
		const parsed = Number.parseInt(configured, 10);
		return Number.isFinite(parsed) ? parsed : 4096;
	}
}

function getOpencodeBaseUrl(): string {
	return `http://127.0.0.1:${getOpencodePort()}`;
}

function getOpencodeCommand(): string {
	// Use config system, fallback to env for backwards compatibility
	try {
		return getConfigValue("OPENCODE_BIN");
	} catch {
		// Config not initialized yet, use env directly
		return process.env.OPENCODE_BIN || "opencode";
	}
}

function getRequiredOpencodeVersionFilePath(): string {
	return path.join(process.cwd(), ".opencode-version");
}

async function readRequiredOpencodeVersion(): Promise<string | null> {
	try {
		const content = await fs.readFile(
			getRequiredOpencodeVersionFilePath(),
			"utf-8",
		);
		const version = content.trim();
		return version || null;
	} catch (error) {
		const isMissingFile =
			error instanceof Error && "code" in error && error.code === "ENOENT";
		if (isMissingFile) {
			logger.warn(
				{ path: getRequiredOpencodeVersionFilePath() },
				"OpenCode version file not found; skipping runtime version check",
			);
			return null;
		}

		throw error;
	}
}

async function getInstalledOpencodeVersion(): Promise<string> {
	const command = getOpencodeCommand();
	const result = await spawnCommand(command, ["--version"], { timeout: 5_000 });
	if (!result.success) {
		throw new Error(
			`Failed to read OpenCode version from ${command}: ${result.stderr || result.stdout || "unknown error"}`,
		);
	}

	const version = result.stdout.trim() || result.stderr.trim();
	if (!version) {
		throw new Error(
			`OpenCode version command returned empty output for ${command}`,
		);
	}

	return version;
}

async function ensureRequiredOpencodeVersion(): Promise<void> {
	const requiredVersion = await readRequiredOpencodeVersion();
	if (!requiredVersion) {
		return;
	}

	const installedVersion = await getInstalledOpencodeVersion();
	if (installedVersion !== requiredVersion) {
		throw new Error(
			`OpenCode version mismatch: required ${requiredVersion} from ${getRequiredOpencodeVersionFilePath()}, but ${getOpencodeCommand()} reports ${installedVersion}`,
		);
	}
}

async function ensureOpencodeDirectories(): Promise<void> {
	const dataPath = getDataPath();
	await fs.mkdir(dataPath, { recursive: true });
	await fs.mkdir(`${dataPath}/opencode`, { recursive: true });
	await fs.mkdir(`${dataPath}/cache`, { recursive: true });
	await ensureGlobalOpencodeConfig();
}

function pickEnvironmentVariables(
	keys: string[],
	environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
	const picked: NodeJS.ProcessEnv = {};

	for (const key of keys) {
		const value = environment[key];
		if (value !== undefined) {
			picked[key] = value;
		}
	}

	return picked;
}

function getOpencodeEnvironment(): NodeJS.ProcessEnv {
	const dataPath = getDataPath();
	const safeEnvironment = pickEnvironmentVariables(
		[
			"PATH",
			"SHELL",
			"LANG",
			"LC_ALL",
			"LC_CTYPE",
			"TERM",
			"TERM_PROGRAM",
			"TERM_PROGRAM_VERSION",
			"COLORTERM",
			"TMPDIR",
			"TMP",
			"TEMP",
			"TZ",
			"USER",
			"LOGNAME",
			"SSH_AUTH_SOCK",
		],
		process.env,
	);

	return {
		...safeEnvironment,
		HOME: dataPath,
		XDG_CONFIG_HOME: dataPath,
		XDG_DATA_HOME: dataPath,
		XDG_STATE_HOME: dataPath,
		XDG_CACHE_HOME: `${dataPath}/cache`,
	};
}

async function waitForOpencodeReady(): Promise<void> {
	const startedAt = Date.now();

	while (Date.now() - startedAt < START_TIMEOUT_MS) {
		if (await checkOpencodeServerReady(getOpencodePort(), 1_000)) {
			return;
		}

		await new Promise((resolve) =>
			setTimeout(resolve, HEALTH_POLL_INTERVAL_MS),
		);
	}

	throw new Error("Timed out waiting for central OpenCode runtime");
}

async function startOpencodeProcess(): Promise<void> {
	await ensureRequiredOpencodeVersion();

	if (await checkOpencodeServerReady(getOpencodePort(), 1_000)) {
		logger.info(
			{
				baseUrl: getOpencodeBaseUrl(),
				version: await getInstalledOpencodeVersion(),
			},
			"Central OpenCode runtime already available; reusing existing process",
		);
		return;
	}

	await ensureOpencodeDirectories();

	const child = spawn(
		getOpencodeCommand(),
		["serve", "--hostname", "127.0.0.1", "--port", String(getOpencodePort())],
		{
			cwd: getDataPath(),
			env: getOpencodeEnvironment(),
			stdio: ["ignore", "pipe", "pipe"],
		},
	);

	globalThis.__DOCE_OPENCODE_PROCESS__ = child;

	const startupError = new Promise<never>((_, reject) => {
		child.once("error", reject);
	});

	child.stdout.on("data", (data: Buffer) => {
		logger.debug(
			{ service: "opencode", output: data.toString().trim() },
			"OpenCode stdout",
		);
	});

	child.stderr.on("data", (data: Buffer) => {
		logger.warn(
			{ service: "opencode", output: data.toString().trim() },
			"OpenCode stderr",
		);
	});

	child.on("exit", (code, signal) => {
		logger.warn({ code, signal }, "Central OpenCode runtime exited");
		if (globalThis.__DOCE_OPENCODE_PROCESS__ === child) {
			globalThis.__DOCE_OPENCODE_PROCESS__ = undefined;
		}
	});

	child.on("error", (error) => {
		logger.error({ error }, "Failed to start central OpenCode runtime");
	});

	await Promise.race([waitForOpencodeReady(), startupError]);
	logger.info(
		{ baseUrl: getOpencodeBaseUrl() },
		"Central OpenCode runtime ready",
	);
}

export async function ensureGlobalOpencodeStarted(): Promise<void> {
	const existing = globalThis.__DOCE_OPENCODE_PROCESS__;
	if (existing && existing.exitCode === null && !existing.killed) {
		if (await checkOpencodeServerReady(getOpencodePort(), 1_000)) {
			return;
		}
	}

	if (!globalThis.__DOCE_OPENCODE_START_PROMISE__) {
		globalThis.__DOCE_OPENCODE_START_PROMISE__ = startOpencodeProcess().finally(
			() => {
				globalThis.__DOCE_OPENCODE_START_PROMISE__ = undefined;
			},
		);
	}

	return globalThis.__DOCE_OPENCODE_START_PROMISE__;
}

export async function isGlobalOpencodeHealthy(): Promise<boolean> {
	return checkOpencodeServerReady(getOpencodePort(), 1_000);
}

/**
 * Kill the existing OpenCode process and start a new one
 */
export async function restartGlobalOpencode(): Promise<void> {
	const existing = globalThis.__DOCE_OPENCODE_PROCESS__;

	// Kill existing process if it exists
	if (existing && existing.exitCode === null && !existing.killed) {
		logger.info("Killing existing OpenCode process for restart");
		existing.kill("SIGTERM");

		// Wait for process to exit (max 5 seconds)
		await new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				logger.warn("OpenCode process did not exit gracefully, forcing kill");
				existing.kill("SIGKILL");
				resolve();
			}, 5_000);

			existing.once("exit", () => {
				clearTimeout(timeout);
				resolve();
			});
		});
	}

	// Clear the global reference
	globalThis.__DOCE_OPENCODE_PROCESS__ = undefined;
	globalThis.__DOCE_OPENCODE_START_PROMISE__ = undefined;

	// Start new process
	logger.info("Starting new OpenCode process");
	await ensureGlobalOpencodeStarted();
}

export { getOpencodeBaseUrl, getOpencodePort };
