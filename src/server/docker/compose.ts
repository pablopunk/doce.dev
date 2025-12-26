import { execSync, spawn } from "node:child_process";
import * as path from "node:path";
import { logger } from "@/server/logger";
import {
	appendDockerLog,
	stopStreamingContainerLogs,
	streamContainerLogs,
	writeHostMarker,
} from "./logs";

// Cache the detected compose command
let composeCommand: string[] | null = null;

/**
 * Detect whether to use `docker compose` or `docker-compose`.
 */
export function detectComposeCommand(): string[] {
	if (composeCommand) {
		return composeCommand;
	}

	try {
		execSync("docker compose version", { stdio: "ignore" });
		composeCommand = ["docker", "compose"];
		logger.info("Using 'docker compose' command");
		return composeCommand;
	} catch {
		try {
			execSync("docker-compose version", { stdio: "ignore" });
			composeCommand = ["docker-compose"];
			logger.info("Using 'docker-compose' command");
			return composeCommand;
		} catch {
			logger.error("Neither 'docker compose' nor 'docker-compose' found");
			throw new Error("Docker Compose not found. Please install Docker.");
		}
	}
}

/**
 * Get the project name for docker compose (prevents collisions).
 */
function getProjectName(projectId: string): string {
	return `doce_${projectId}`;
}

/**
 * Build the base compose command with project name and ANSI disabled.
 */
function buildComposeArgs(projectId: string): string[] {
	return ["--project-name", getProjectName(projectId), "--ansi", "never"];
}

export interface ComposeResult {
	success: boolean;
	exitCode: number;
	stdout: string;
	stderr: string;
}

/**
 * Run a docker compose command and capture output.
 * @param profile Optional profile name. Must come before the subcommand in Docker Compose.
 * @param filePath Optional compose file path. Must come before the subcommand in Docker Compose.
 */
async function runComposeCommand(
	projectId: string,
	projectPath: string,
	args: string[],
	profile?: string,
	filePath?: string,
): Promise<ComposeResult> {
	const compose = detectComposeCommand();
	const baseArgs = buildComposeArgs(projectId);

	// Build args with optional profile and file flags (both must come BEFORE the subcommand)
	let fullArgs = [...compose.slice(1), ...baseArgs];
	if (filePath) {
		fullArgs.push("-f", filePath);
	}
	if (profile) {
		fullArgs.push("--profile", profile);
	}
	fullArgs.push(...args);

	const command = compose[0] ?? "docker";

	logger.debug(
		{ command, args: fullArgs, cwd: projectPath },
		"Running compose command",
	);

	return new Promise((resolve) => {
		const proc = spawn(command, fullArgs, {
			cwd: projectPath,
		});

		let stdout = "";
		let stderr = "";

		proc.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString();
		});

		proc.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on("close", (code: number | null) => {
			const exitCode = code ?? 1;
			const success = exitCode === 0;

			logger.debug(
				{
					exitCode,
					stdout: stdout.slice(0, 500),
					stderr: stderr.slice(0, 500),
				},
				"Compose command completed",
			);

			resolve({ success, exitCode, stdout, stderr });
		});

		proc.on("error", (err: Error) => {
			logger.error({ error: err }, "Compose command failed to spawn");
			resolve({
				success: false,
				exitCode: 1,
				stdout: "",
				stderr: err.message,
			});
		});
	});
}

/**
 * Start containers for a project.
 * Idempotent - safe to call when already running.
 * @param preserveProduction If true, don't remove orphan containers (preserves production if running separately)
 */
export async function composeUp(
	projectId: string,
	projectPath: string,
	preserveProduction: boolean = true,
): Promise<ComposeResult> {
	const logsDir = path.join(projectPath, "logs");

	// Don't use --remove-orphans when production might be running with a separate compose file
	const args = preserveProduction
		? ["up", "-d"]
		: ["up", "-d", "--remove-orphans"];

	await writeHostMarker(logsDir, `docker compose ${args.join(" ")}`);

	const result = await runComposeCommand(projectId, projectPath, args);

	// Log output with stream markers
	if (result.stdout) {
		await appendDockerLog(logsDir, result.stdout, false);
	}
	if (result.stderr) {
		await appendDockerLog(logsDir, result.stderr, true);
	}
	await writeHostMarker(logsDir, `exit=${result.exitCode}`);

	// Start streaming container logs (e.g., pnpm dev output) after containers start
	if (result.success) {
		// Wait a bit for containers to start outputting logs
		await new Promise((resolve) => setTimeout(resolve, 2000));
		streamContainerLogs(projectId, projectPath);
	}

	return result;
}

/**
 * Start production container for a project using docker-compose.production.yml.
 * Allocates port and updates .env with PRODUCTION_PORT.
 * Idempotent - safe to call when already running.
 */
export async function composeUpProduction(
	projectId: string,
	projectPath: string,
	productionPort: number,
): Promise<ComposeResult> {
	const logsDir = path.join(projectPath, "logs");

	// Update .env with the allocated production port
	const fs = await import("node:fs/promises");
	const envPath = path.join(projectPath, ".env");
	const envContent = await fs.readFile(envPath, "utf-8");

	// Check if PRODUCTION_PORT already exists, if not add it
	let updatedEnv: string;
	if (envContent.includes("PRODUCTION_PORT=")) {
		// Update existing PRODUCTION_PORT line
		updatedEnv = envContent
			.split("\n")
			.map((line) =>
				line.startsWith("PRODUCTION_PORT=")
					? `PRODUCTION_PORT=${productionPort}`
					: line,
			)
			.join("\n");
	} else {
		// Add PRODUCTION_PORT if it doesn't exist
		updatedEnv = `${envContent.trimEnd()}\nPRODUCTION_PORT=${productionPort}\n`;
	}

	await fs.writeFile(envPath, updatedEnv);

	await writeHostMarker(
		logsDir,
		`docker compose -f docker-compose.production.yml up -d --remove-orphans (PRODUCTION_PORT=${productionPort})`,
	);

	const result = await runComposeCommand(
		projectId,
		projectPath,
		["up", "-d", "--remove-orphans"],
		undefined,
		"docker-compose.production.yml",
	);

	// Log output with stream markers
	if (result.stdout) {
		await appendDockerLog(logsDir, result.stdout, false);
	}
	if (result.stderr) {
		await appendDockerLog(logsDir, result.stderr, true);
	}
	await writeHostMarker(logsDir, `exit=${result.exitCode}`);

	// Start streaming container logs after containers start
	if (result.success) {
		await new Promise((resolve) => setTimeout(resolve, 2000));
		streamContainerLogs(projectId, projectPath);
	}

	return result;
}

/**
 * Stop containers for a project (preserves volumes).
 */
export async function composeDown(
	projectId: string,
	projectPath: string,
): Promise<ComposeResult> {
	const logsDir = path.join(projectPath, "logs");
	await writeHostMarker(logsDir, "docker compose down --remove-orphans");

	// Stop streaming container logs before stopping containers
	stopStreamingContainerLogs(projectId);

	const result = await runComposeCommand(projectId, projectPath, [
		"down",
		"--remove-orphans",
	]);

	if (result.stdout) {
		await appendDockerLog(logsDir, result.stdout, false);
	}
	if (result.stderr) {
		await appendDockerLog(logsDir, result.stderr, true);
	}
	await writeHostMarker(logsDir, `exit=${result.exitCode}`);

	return result;
}

/**
 * Stop only the production container using docker-compose.production.yml
 * This preserves the preview and opencode containers.
 */
export async function composeDownProduction(
	projectId: string,
	projectPath: string,
): Promise<ComposeResult> {
	const logsDir = path.join(projectPath, "logs");
	await writeHostMarker(
		logsDir,
		"docker compose -f docker-compose.production.yml down --remove-orphans",
	);

	// Stop streaming container logs before stopping containers
	stopStreamingContainerLogs(projectId);

	const result = await runComposeCommand(
		projectId,
		projectPath,
		["down", "--remove-orphans"],
		undefined,
		"docker-compose.production.yml",
	);

	if (result.stdout) {
		await appendDockerLog(logsDir, result.stdout, false);
	}
	if (result.stderr) {
		await appendDockerLog(logsDir, result.stderr, true);
	}
	await writeHostMarker(logsDir, `exit=${result.exitCode}`);

	return result;
}

/**
 * Stop and remove containers + volumes for a project (destructive).
 */
export async function composeDownWithVolumes(
	projectId: string,
	projectPath: string,
): Promise<ComposeResult> {
	const logsDir = path.join(projectPath, "logs");
	await writeHostMarker(
		logsDir,
		"docker compose down --remove-orphans --volumes",
	);

	const result = await runComposeCommand(projectId, projectPath, [
		"down",
		"--remove-orphans",
		"--volumes",
	]);

	return result;
}

/**
 * Get the status of containers for a project.
 */
export async function composePs(
	projectId: string,
	projectPath: string,
): Promise<ComposeResult> {
	return runComposeCommand(projectId, projectPath, ["ps", "--format", "json"]);
}

export interface ContainerStatus {
	name: string;
	service: string;
	state: string;
	health: string | undefined;
}

/**
 * Parse compose ps JSON output to get container statuses.
 */
export function parseComposePs(output: string): ContainerStatus[] {
	if (!output.trim()) {
		return [];
	}

	try {
		// Docker compose ps --format json outputs one JSON object per line
		const lines = output.trim().split("\n");
		return lines
			.filter((line) => line.trim())
			.map((line) => {
				const container = JSON.parse(line) as {
					Name: string;
					Service: string;
					State: string;
					Health?: string;
				};
				return {
					name: container.Name,
					service: container.Service,
					state: container.State,
					health: container.Health,
				};
			});
	} catch (err) {
		logger.warn(
			{ error: err, output: output.slice(0, 200) },
			"Failed to parse compose ps output",
		);
		return [];
	}
}

/**
 * Ensure the global pnpm cache volume exists.
 * Idempotent - safe to call multiple times, no errors if already exists.
 */
export async function ensureGlobalPnpmVolume(): Promise<void> {
	const volumeName = "doce-global-pnpm-store";

	try {
		// Try to create the volume - Docker silently ignores if it already exists
		execSync(`docker volume create ${volumeName}`, { stdio: "ignore" });
		logger.debug({ volumeName }, "Global pnpm volume ensured");
	} catch (err) {
		// Log but don't throw - if Docker is unavailable, it will fail later anyway
		logger.warn(
			{ error: err, volumeName },
			"Failed to ensure global pnpm volume",
		);
	}
}
