/**
 * Effect-based Docker Compose operations
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Effect, Option, Ref } from "effect";
import type { Scope } from "effect/Scope";
import {
	DockerComposeError,
	DockerNotAvailableError,
} from "@/server/effect/errors";
import { logger } from "@/server/logger";
import { normalizeProjectPath } from "@/server/projects/paths";
import { runCommand } from "@/server/utils/execAsync";
import {
	appendDockerLog,
	stopStreamingContainerLogs,
	streamContainerLogs,
	writeHostMarker,
} from "./logs";

export interface ComposeResult {
	success: boolean;
	exitCode: number;
	stdout: string;
	stderr: string;
}

export interface ContainerStatus {
	name: string;
	service: string;
	state: string;
	health: string | undefined;
}

const composeCommandRef = Ref.unsafeMake<Option.Option<string[]>>(
	Option.none(),
);

export function detectComposeCommand(): Effect.Effect<
	string[],
	DockerNotAvailableError
> {
	return Effect.gen(function* () {
		const cached = yield* Ref.get(composeCommandRef);

		if (Option.isSome(cached)) {
			return cached.value;
		}

		let result = yield* Effect.tryPromise({
			try: () => runCommand("docker compose version", { timeout: 5000 }),
			catch: (error) =>
				new DockerNotAvailableError({
					reason: `Failed to check docker compose: ${String(error)}`,
				}),
		});

		if (result.success) {
			const command = ["docker", "compose"];
			yield* Ref.set(composeCommandRef, Option.some(command));
			logger.info("Using 'docker compose' command");
			return command;
		}

		result = yield* Effect.tryPromise({
			try: () => runCommand("docker-compose version", { timeout: 5000 }),
			catch: (error) =>
				new DockerNotAvailableError({
					reason: `Failed to check docker-compose: ${String(error)}`,
				}),
		});

		if (result.success) {
			const command = ["docker-compose"];
			yield* Ref.set(composeCommandRef, Option.some(command));
			logger.info("Using 'docker-compose' command");
			return command;
		}

		logger.error("Neither 'docker compose' nor 'docker-compose' found");
		return yield* new DockerNotAvailableError({
			reason: "Docker Compose not found. Please install Docker.",
		});
	});
}

interface ProjectEnv {
	readonly [key: string]: string;
}

function loadProjectEnvFile(
	envFilePath: string,
): Effect.Effect<ProjectEnv, never> {
	return Effect.tryPromise({
		try: async () => {
			const content = await fs.readFile(envFilePath, "utf-8");
			const env: Record<string, string> = {};

			for (const rawLine of content.split("\n")) {
				const line = rawLine.trim();
				if (!line || line.startsWith("#")) {
					continue;
				}

				const separator = line.indexOf("=");
				if (separator <= 0) {
					continue;
				}

				const key = line.slice(0, separator).trim();
				const value = line.slice(separator + 1).trim();
				env[key] = value;
			}

			return env;
		},
		catch: (): ProjectEnv => ({}),
	}).pipe(Effect.orElse(() => Effect.succeed({})));
}

function getProjectName(projectId: string): string {
	return `doce_${projectId}`;
}

function getProductionProjectName(projectId: string, hash?: string): string {
	if (hash) {
		return `doce_prod_${projectId.slice(0, 8)}_${hash}`;
	}
	return `doce_prod_${projectId}`;
}

function buildComposeArgs(projectId: string): string[] {
	return ["--project-name", getProjectName(projectId), "--ansi", "never"];
}

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

interface ProcessResources {
	readonly stdout: string;
	readonly stderr: string;
	readonly exitCode: number;
}

function spawnComposeProcess(
	command: string,
	args: string[],
	options: {
		cwd: string;
		env: NodeJS.ProcessEnv;
	},
): Effect.Effect<ProcessResources, never, Scope> {
	return Effect.acquireRelease(
		Effect.sync(() =>
			spawn(command, args, {
				cwd: options.cwd,
				env: options.env,
			}),
		),
		(proc) =>
			Effect.sync(() => {
				if (!proc.killed) {
					proc.kill("SIGTERM");
				}
			}),
	).pipe(
		Effect.flatMap((proc) =>
			Effect.async<ProcessResources, never>((resume) => {
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
					resume(
						Effect.succeed({
							stdout,
							stderr,
							exitCode,
						}),
					);
				});

				proc.on("error", (err: Error) => {
					logger.error({ error: err }, "Compose command failed to spawn");
					resume(
						Effect.succeed({
							stdout: "",
							stderr: err.message,
							exitCode: 1,
						}),
					);
				});
			}),
		),
	);
}

export function runComposeCommand(
	projectId: string,
	projectPath: string,
	args: string[],
	profile?: string,
	filePath?: string,
): Effect.Effect<
	ComposeResult,
	DockerComposeError | DockerNotAvailableError,
	Scope
> {
	return Effect.gen(function* () {
		const compose = yield* detectComposeCommand();
		const baseArgs = buildComposeArgs(projectId);

		const fullArgs = [...compose.slice(1), ...baseArgs];

		const envFilePath = path.resolve(path.join(projectPath, "..", ".env"));
		fullArgs.push("--env-file", envFilePath);

		if (filePath) {
			fullArgs.push("-f", filePath);
		}
		if (profile) {
			fullArgs.push("--profile", profile);
		}
		fullArgs.push(...args);

		const command = compose[0] ?? "docker";
		const projectEnv = yield* loadProjectEnvFile(envFilePath);

		logger.debug(
			{ command, args: fullArgs, cwd: projectPath },
			"Running compose command",
		);

		const doceNetwork = process.env.DOCE_NETWORK || "doce-shared";

		const result = yield* spawnComposeProcess(command, fullArgs, {
			cwd: projectPath,
			env: {
				...process.env,
				...projectEnv,
				PROJECT_ID: projectId,
				DOCE_NETWORK: doceNetwork,
			},
		});

		const success = result.exitCode === 0;

		logger.debug(
			{
				exitCode: result.exitCode,
				stdout: result.stdout.slice(0, 500),
				stderr: result.stderr.slice(0, 500),
			},
			"Compose command completed",
		);

		return {
			success,
			exitCode: result.exitCode,
			stdout: result.stdout,
			stderr: result.stderr,
		};
	});
}

export function runComposeCommandProduction(
	projectId: string,
	productionPath: string,
	args: string[],
	filePath?: string,
	hash?: string,
): Effect.Effect<
	ComposeResult,
	DockerComposeError | DockerNotAvailableError,
	Scope
> {
	return Effect.gen(function* () {
		const compose = yield* detectComposeCommand();
		const baseArgs = buildComposeArgsProduction(projectId, hash);

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

		const doceNetwork = process.env.DOCE_NETWORK || "doce-shared";

		const result = yield* spawnComposeProcess(command, fullArgs, {
			cwd: productionPath,
			env: {
				...process.env,
				PROJECT_ID: projectId,
				DOCE_NETWORK: doceNetwork,
			},
		});

		const success = result.exitCode === 0;

		logger.debug(
			{
				exitCode: result.exitCode,
				stdout: result.stdout.slice(0, 500),
				stderr: result.stderr.slice(0, 500),
			},
			"Production compose command completed",
		);

		return {
			success,
			exitCode: result.exitCode,
			stdout: result.stdout,
			stderr: result.stderr,
		};
	});
}

export function composeUp(
	projectId: string,
	projectPath: string,
	preserveProduction = true,
): Effect.Effect<
	ComposeResult,
	DockerComposeError | DockerNotAvailableError,
	Scope
> {
	return Effect.gen(function* () {
		const normalizedProjectPath = normalizeProjectPath(projectPath);
		const logsDir = path.join(normalizedProjectPath, "logs");

		yield* ensureProjectDataVolume(projectId);

		const args = preserveProduction
			? ["up", "-d", "--build"]
			: ["up", "-d", "--remove-orphans", "--build"];

		yield* Effect.tryPromise({
			try: () =>
				writeHostMarker(
					logsDir,
					`docker compose ${args.join(" ")} (project=${getProjectName(projectId)})`,
				),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		const result = yield* runComposeCommand(
			projectId,
			normalizedProjectPath,
			args,
		);

		if (result.stdout) {
			yield* Effect.tryPromise({
				try: () => appendDockerLog(logsDir, result.stdout, false),
				catch: () => undefined,
			}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
		}
		if (result.stderr) {
			yield* Effect.tryPromise({
				try: () => appendDockerLog(logsDir, result.stderr, true),
				catch: () => undefined,
			}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
		}
		yield* Effect.tryPromise({
			try: () => writeHostMarker(logsDir, `exit=${result.exitCode}`),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		if (result.success) {
			yield* Effect.sleep("2 seconds");
			streamContainerLogs(projectId, normalizedProjectPath);
		}

		return result;
	});
}

export function composeUpProduction(
	projectId: string,
	productionPath: string,
	productionPort: number,
	productionHash?: string,
): Effect.Effect<
	ComposeResult,
	DockerComposeError | DockerNotAvailableError,
	Scope
> {
	return Effect.gen(function* () {
		const logsDir = path.join(productionPath, "logs");

		yield* Effect.tryPromise({
			try: () => fs.mkdir(logsDir, { recursive: true }).then(() => undefined),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		yield* Effect.tryPromise({
			try: () =>
				writeHostMarker(
					logsDir,
					`docker compose -f docker-compose.production.yml up -d --build (PRODUCTION_PORT=${productionPort}, project=${getProductionProjectName(projectId, productionHash)})`,
				),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		const result = yield* runComposeCommandProduction(
			projectId,
			productionPath,
			["up", "-d", "--build"],
			"docker-compose.production.yml",
			productionHash,
		);

		if (result.stdout) {
			yield* Effect.tryPromise({
				try: () => appendDockerLog(logsDir, result.stdout, false),
				catch: () => undefined,
			}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
		}
		if (result.stderr) {
			yield* Effect.tryPromise({
				try: () => appendDockerLog(logsDir, result.stderr, true),
				catch: () => undefined,
			}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
		}
		yield* Effect.tryPromise({
			try: () => writeHostMarker(logsDir, `exit=${result.exitCode}`),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		if (result.success) {
			yield* Effect.sleep("2 seconds");
			streamContainerLogs(projectId, productionPath);
		}

		return result;
	});
}

export function composeDown(
	projectId: string,
	projectPath: string,
): Effect.Effect<
	ComposeResult,
	DockerComposeError | DockerNotAvailableError,
	Scope
> {
	return Effect.gen(function* () {
		const normalizedProjectPath = normalizeProjectPath(projectPath);
		const logsDir = path.join(normalizedProjectPath, "logs");

		yield* Effect.tryPromise({
			try: () =>
				writeHostMarker(logsDir, "docker compose down --remove-orphans"),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		stopStreamingContainerLogs(projectId);

		const result = yield* runComposeCommand(projectId, normalizedProjectPath, [
			"down",
			"--remove-orphans",
		]);

		if (result.stdout) {
			yield* Effect.tryPromise({
				try: () => appendDockerLog(logsDir, result.stdout, false),
				catch: () => undefined,
			}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
		}
		if (result.stderr) {
			yield* Effect.tryPromise({
				try: () => appendDockerLog(logsDir, result.stderr, true),
				catch: () => undefined,
			}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
		}
		yield* Effect.tryPromise({
			try: () => writeHostMarker(logsDir, `exit=${result.exitCode}`),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		return result;
	});
}

export function composeDownProduction(
	projectId: string,
	productionPath: string,
	productionHash?: string,
): Effect.Effect<
	ComposeResult,
	DockerComposeError | DockerNotAvailableError,
	Scope
> {
	return Effect.gen(function* () {
		const logsDir = path.join(productionPath, "logs");

		yield* Effect.tryPromise({
			try: () =>
				writeHostMarker(
					logsDir,
					`docker compose -f docker-compose.production.yml down (project=${getProductionProjectName(projectId, productionHash)})`,
				),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		stopStreamingContainerLogs(projectId);

		const result = yield* runComposeCommandProduction(
			projectId,
			productionPath,
			["down"],
			"docker-compose.production.yml",
			productionHash,
		);

		if (result.stdout) {
			yield* Effect.tryPromise({
				try: () => appendDockerLog(logsDir, result.stdout, false),
				catch: () => undefined,
			}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
		}
		if (result.stderr) {
			yield* Effect.tryPromise({
				try: () => appendDockerLog(logsDir, result.stderr, true),
				catch: () => undefined,
			}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
		}
		yield* Effect.tryPromise({
			try: () => writeHostMarker(logsDir, `exit=${result.exitCode}`),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		return result;
	});
}

export function composeDownWithVolumes(
	projectId: string,
	projectPath: string,
): Effect.Effect<
	ComposeResult,
	DockerComposeError | DockerNotAvailableError,
	Scope
> {
	return Effect.gen(function* () {
		const normalizedProjectPath = normalizeProjectPath(projectPath);
		const logsDir = path.join(normalizedProjectPath, "logs");

		yield* Effect.tryPromise({
			try: () =>
				writeHostMarker(
					logsDir,
					"docker compose down --remove-orphans --volumes",
				),
			catch: () => undefined,
		}).pipe(Effect.orElse(() => Effect.succeed(undefined)));

		const result = yield* runComposeCommand(projectId, normalizedProjectPath, [
			"down",
			"--remove-orphans",
			"--volumes",
		]);

		return result;
	});
}

export function composePs(
	projectId: string,
	projectPath: string,
): Effect.Effect<
	ContainerStatus[],
	DockerComposeError | DockerNotAvailableError,
	Scope
> {
	return Effect.gen(function* () {
		const normalizedProjectPath = normalizeProjectPath(projectPath);
		const result = yield* runComposeCommand(projectId, normalizedProjectPath, [
			"ps",
			"--format",
			"json",
		]);

		if (!result.success) {
			return yield* new DockerComposeError({
				projectId,
				command: "ps",
				exitCode: result.exitCode,
				stdout: result.stdout,
				stderr: result.stderr,
			});
		}

		return parseComposePs(result.stdout);
	});
}

export function parseComposePs(output: string): ContainerStatus[] {
	if (!output.trim()) {
		return [];
	}

	try {
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

export function ensureDoceSharedNetwork(): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const networkName = process.env.DOCE_NETWORK || "doce-shared";

		const result = yield* Effect.tryPromise({
			try: () =>
				runCommand(`docker network create ${networkName}`, {
					timeout: 5000,
				}),
			catch: () => ({
				success: false,
				stderr: "",
				stdout: "",
				exitCode: 1,
			}),
		}).pipe(
			Effect.orElse(() =>
				Effect.succeed({
					success: false,
					stderr: "",
					stdout: "",
					exitCode: 1,
				}),
			),
		);

		if (result.success) {
			logger.debug({ networkName }, "Shared network ensured");
		} else if (result.stderr.includes("already exists")) {
			return;
		} else {
			logger.warn(
				{ error: result.stderr, networkName },
				"Failed to ensure shared network",
			);
		}
	});
}

export function ensureGlobalPnpmVolume(): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const volumeName = "doce-global-pnpm-store";

		const result = yield* Effect.tryPromise({
			try: () =>
				runCommand(`docker volume create ${volumeName}`, {
					timeout: 5000,
				}),
			catch: () => ({
				success: false,
				stderr: "",
				stdout: "",
				exitCode: 1,
			}),
		}).pipe(
			Effect.orElse(() =>
				Effect.succeed({
					success: false,
					stderr: "",
					stdout: "",
					exitCode: 1,
				}),
			),
		);

		if (result.success) {
			logger.debug({ volumeName }, "Global pnpm volume ensured");
		} else {
			logger.warn(
				{ error: result.stderr, volumeName },
				"Failed to ensure global pnpm volume",
			);
		}
	});
}

export function ensureProjectDataVolume(
	projectId: string,
): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const volumeName = `doce_${projectId}_data`;

		const result = yield* Effect.tryPromise({
			try: () =>
				runCommand(`docker volume create ${volumeName}`, {
					timeout: 5000,
				}),
			catch: () => ({
				success: false,
				stderr: "",
				stdout: "",
				exitCode: 1,
			}),
		}).pipe(
			Effect.orElse(() =>
				Effect.succeed({
					success: false,
					stderr: "",
					stdout: "",
					exitCode: 1,
				}),
			),
		);

		if (result.success) {
			logger.debug({ projectId, volumeName }, "Project data volume ensured");
		} else {
			logger.warn(
				{ error: result.stderr, projectId, volumeName },
				"Failed to ensure project data volume",
			);
		}
	});
}

export function ensureOpencodeStorageVolume(
	projectId: string,
): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const volumeName = `doce_${projectId}_opencode_storage`;

		const result = yield* Effect.tryPromise({
			try: () =>
				runCommand(`docker volume create ${volumeName}`, {
					timeout: 5000,
				}),
			catch: () => ({
				success: false,
				stderr: "",
				stdout: "",
				exitCode: 1,
			}),
		}).pipe(
			Effect.orElse(() =>
				Effect.succeed({
					success: false,
					stderr: "",
					stdout: "",
					exitCode: 1,
				}),
			),
		);

		if (result.success) {
			logger.debug(
				{ projectId, volumeName },
				"Opencode storage volume ensured",
			);
		} else {
			logger.warn(
				{ error: result.stderr, projectId, volumeName },
				"Failed to ensure opencode storage volume",
			);
		}
	});
}
