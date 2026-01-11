import { spawn } from "node:child_process";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { normalizeProjectPath } from "@/server/projects/paths";
import { runCommand } from "@/server/utils/execAsync";
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
 * Uses async detection to avoid blocking the event loop.
 */
export async function detectComposeCommand(): Promise<string[]> {
	if (composeCommand) {
		return composeCommand;
	}

	// Try `docker compose version` first
	let result = await runCommand("docker compose version", { timeout: 5000 });
	if (result.success) {
		composeCommand = ["docker", "compose"];
		logger.info("Using 'docker compose' command");
		return composeCommand;
	}

	// Fall back to `docker-compose version`
	result = await runCommand("docker-compose version", { timeout: 5000 });
	if (result.success) {
		composeCommand = ["docker-compose"];
		logger.info("Using 'docker-compose' command");
		return composeCommand;
	}

	logger.error("Neither 'docker compose' nor 'docker-compose' found");
	throw new Error("Docker Compose not found. Please install Docker.");
}

/**
 * Get the project name for docker compose (prevents collisions).
 */
function getProjectName(projectId: string): string {
	return `doce_${projectId}`;
}

/**
 * Get the production project name for docker compose (completely separate from dev).
 * If hash is provided, includes it in the project name for complete isolation between versions.
 */
function getProductionProjectName(projectId: string, hash?: string): string {
	if (hash) {
		return `doce_prod_${projectId.slice(0, 8)}_${hash}`;
	}
	return `doce_prod_${projectId}`;
}

/**
 * Build the base compose command with project name and ANSI disabled.
 */
function buildComposeArgs(projectId: string): string[] {
	return ["--project-name", getProjectName(projectId), "--ansi", "never"];
}

/**
 * Build the base compose command for production with separate project name.
 * If hash is provided, includes it in the project name for isolation.
 */
function buildComposeArgsProduction(
	projectId: string,
	hash?: string,
): string[] {
	return [
		"--project-name",
		getProductionProjectName(projectId, hash),
		"--ansi",
		"never",
	];
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
	const compose = await detectComposeCommand();
	const baseArgs = buildComposeArgs(projectId);

	// Build args with optional profile and file flags (both must come BEFORE the subcommand)
	const fullArgs = [...compose.slice(1), ...baseArgs];
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
		// Determine the shared network name for this deployment
		// In container environments, DOCE_NETWORK is set by docker-compose
		// In local development, use a default network name
		const docceNetwork = process.env.DOCE_NETWORK || "doce-shared";

		const proc = spawn(command, fullArgs, {
			cwd: projectPath,
			env: {
				...process.env,
				PROJECT_ID: projectId,
				DOCE_NETWORK: docceNetwork,
				DOCE_DATA_DIR: process.env.DOCE_DATA_DIR || "/app/data",
			},
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
 * Run a docker compose command for production with separate project name.
 * @param filePath Optional compose file path. Must come before the subcommand in Docker Compose.
 */
async function runComposeCommandProduction(
	projectId: string,
	productionPath: string,
	args: string[],
	filePath?: string,
	hash?: string,
): Promise<ComposeResult> {
	const compose = await detectComposeCommand();
	const baseArgs = buildComposeArgsProduction(projectId, hash);

	// Build args with file flags (must come BEFORE the subcommand)
	const fullArgs = [...compose.slice(1), ...baseArgs];
	if (filePath) {
		fullArgs.push("-f", filePath);
	}
	fullArgs.push(...args);

	const command = compose[0] ?? "docker";

	logger.debug(
		{ command, args: fullArgs, cwd: productionPath },
		"Running production compose command",
	);

	return new Promise((resolve) => {
		// Determine the shared network name for this deployment
		// In container environments, DOCE_NETWORK is set by docker-compose
		// In local development, use a default network name
		const docceNetwork = process.env.DOCE_NETWORK || "doce-shared";

		const proc = spawn(command, fullArgs, {
			cwd: productionPath,
			env: {
				...process.env,
				PROJECT_ID: projectId,
				DOCE_NETWORK: docceNetwork,
				DOCE_DATA_DIR: process.env.DOCE_DATA_DIR || "/app/data",
			},
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
				"Production compose command completed",
			);

			resolve({ success, exitCode, stdout, stderr });
		});

		proc.on("error", (err: Error) => {
			logger.error(
				{ error: err },
				"Production compose command failed to spawn",
			);
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
	const normalizedProjectPath = normalizeProjectPath(projectPath);
	const logsDir = path.join(normalizedProjectPath, "logs");

	// Ensure the project data volume exists before starting containers
	await ensureProjectDataVolume(projectId);

	// Don't use --remove-orphans when production might be running with a separate compose file
	// Always rebuild to ensure Dockerfile changes are applied (layer caching still applies)
	const args = preserveProduction
		? ["up", "-d", "--build"]
		: ["up", "-d", "--remove-orphans", "--build"];

	await writeHostMarker(
		logsDir,
		`docker compose ${args.join(" ")} (project=${getProjectName(projectId)})`,
	);

	const result = await runComposeCommand(
		projectId,
		normalizedProjectPath,
		args,
	);

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
		streamContainerLogs(projectId, normalizedProjectPath);
	}

	return result;
}

/**
 * Start production container for a project using docker-compose.production.yml.
 * Uses separate project name for complete isolation from dev containers.
 * Includes hash in project name for multi-version isolation.
 * Idempotent - safe to call when already running.
 * @param projectId The project ID
 * @param productionPath Path to the production directory (data/production/{projectId}/{hash}/)
 * @param productionPort Port number for the production server
 * @param productionHash Hash of the dist folder for versioning
 */
export async function composeUpProduction(
	projectId: string,
	productionPath: string,
	productionPort: number,
	productionHash?: string,
): Promise<ComposeResult> {
	const logsDir = path.join(productionPath, "logs");
	await import("node:fs/promises").then((fs) =>
		fs.mkdir(logsDir, { recursive: true }),
	);

	await writeHostMarker(
		logsDir,
		`docker compose -f docker-compose.production.yml up -d --build (PRODUCTION_PORT=${productionPort}, project=${getProductionProjectName(projectId, productionHash)})`,
	);

	const result = await runComposeCommandProduction(
		projectId,
		productionPath,
		["up", "-d", "--build"],
		"docker-compose.production.yml",
		productionHash,
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
		streamContainerLogs(projectId, productionPath);
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
	const normalizedProjectPath = normalizeProjectPath(projectPath);
	const logsDir = path.join(normalizedProjectPath, "logs");
	await writeHostMarker(logsDir, "docker compose down --remove-orphans");

	// Stop streaming container logs before stopping containers
	stopStreamingContainerLogs(projectId);

	const result = await runComposeCommand(projectId, normalizedProjectPath, [
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
 * Uses separate project name to ensure dev containers are never affected.
 * @param projectId The project ID
 * @param productionPath Path to the production directory (data/production/{projectId}/{hash}/)
 * @param productionHash Hash of the dist folder (optional, for multiple versions)
 */
export async function composeDownProduction(
	projectId: string,
	productionPath: string,
	productionHash?: string,
): Promise<ComposeResult> {
	const logsDir = path.join(productionPath, "logs");
	await writeHostMarker(
		logsDir,
		`docker compose -f docker-compose.production.yml down (project=${getProductionProjectName(projectId, productionHash)})`,
	);

	// Stop streaming container logs before stopping containers
	stopStreamingContainerLogs(projectId);

	const result = await runComposeCommandProduction(
		projectId,
		productionPath,
		["down"],
		"docker-compose.production.yml",
		productionHash,
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
	const normalizedProjectPath = normalizeProjectPath(projectPath);
	const logsDir = path.join(normalizedProjectPath, "logs");
	await writeHostMarker(
		logsDir,
		"docker compose down --remove-orphans --volumes",
	);

	const result = await runComposeCommand(projectId, normalizedProjectPath, [
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
	const normalizedProjectPath = normalizeProjectPath(projectPath);
	return runComposeCommand(projectId, normalizedProjectPath, [
		"ps",
		"--format",
		"json",
	]);
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
		const result = await runCommand(`docker volume create ${volumeName}`, {
			timeout: 5000,
		});
		if (result.success) {
			logger.debug({ volumeName }, "Global pnpm volume ensured");
		} else {
			logger.warn(
				{ error: result.stderr, volumeName },
				"Failed to ensure global pnpm volume",
			);
		}
	} catch (err) {
		// Log but don't throw - if Docker is unavailable, it will fail later anyway
		logger.warn(
			{ error: err, volumeName },
			"Failed to ensure global pnpm volume",
		);
	}
}

/**
 * Ensure a project-specific data volume exists.
 * Idempotent - safe to call multiple times, no errors if already exists.
 * @param projectId The project ID
 */
export async function ensureProjectDataVolume(
	projectId: string,
): Promise<void> {
	const volumeName = `doce_${projectId}_data`;

	try {
		// Try to create the volume - Docker silently ignores if it already exists
		const result = await runCommand(`docker volume create ${volumeName}`, {
			timeout: 5000,
		});
		if (result.success) {
			logger.debug({ projectId, volumeName }, "Project data volume ensured");
		} else {
			logger.warn(
				{ error: result.stderr, projectId, volumeName },
				"Failed to ensure project data volume",
			);
		}
	} catch (err) {
		// Log but don't throw - if Docker is unavailable, it will fail later anyway
		logger.warn(
			{ error: err, projectId, volumeName },
			"Failed to ensure project data volume",
		);
	}
}
