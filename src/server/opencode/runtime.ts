import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { checkOpencodeServerReady } from "@/server/health/checkHealthEndpoint";
import { logger } from "@/server/logger";
import { ensureGlobalOpencodeConfig } from "@/server/opencode/config";
import { getDataPath } from "@/server/projects/paths";

const DEFAULT_OPENCODE_PORT = 4096;
const START_TIMEOUT_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 250;

declare global {
	// eslint-disable-next-line no-var
	var __DOCE_OPENCODE_PROCESS__: ChildProcess | undefined;
	// eslint-disable-next-line no-var
	var __DOCE_OPENCODE_START_PROMISE__: Promise<void> | undefined;
}

function getOpencodePort(): number {
	const configured = process.env.DOCE_OPENCODE_PORT;
	if (!configured) {
		return DEFAULT_OPENCODE_PORT;
	}

	const parsed = Number.parseInt(configured, 10);
	return Number.isFinite(parsed) ? parsed : DEFAULT_OPENCODE_PORT;
}

function getOpencodeBaseUrl(): string {
	return `http://127.0.0.1:${getOpencodePort()}`;
}

function getOpencodeCommand(): string {
	return process.env.OPENCODE_BIN || "opencode";
}

async function ensureOpencodeDirectories(): Promise<void> {
	const dataPath = getDataPath();
	await fs.mkdir(dataPath, { recursive: true });
	await fs.mkdir(`${dataPath}/opencode`, { recursive: true });
	await fs.mkdir(`${dataPath}/cache`, { recursive: true });
	await ensureGlobalOpencodeConfig();
}

function getOpencodeEnvironment(): NodeJS.ProcessEnv {
	const dataPath = getDataPath();
	return {
		...process.env,
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
	if (await checkOpencodeServerReady(getOpencodePort(), 1_000)) {
		logger.debug("Central OpenCode runtime already healthy");
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

export { getOpencodeBaseUrl, getOpencodePort };
