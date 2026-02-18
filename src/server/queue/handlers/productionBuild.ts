import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Effect } from "effect";
import { ProductionBuildError, ProjectError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { hashDistFolder } from "@/server/productions/hash";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProjectProductionPath } from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { spawnCommand } from "@/server/utils/execAsync";
import { enqueueProductionStart } from "../enqueue";
import { parsePayload } from "../types";

function getPreviewContainerName(projectId: string): string {
	return `doce_${projectId}-preview-1`;
}

export function handleProductionBuild(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError | ProductionBuildError> {
	return Effect.gen(function* () {
		const payload = parsePayload("production.build", ctx.job.payloadJson);

		const project = yield* Effect.tryPromise({
			try: () => getProjectByIdIncludeDeleted(payload.projectId),
			catch: (error) =>
				new ProjectError({
					projectId: payload.projectId,
					operation: "getProjectByIdIncludeDeleted",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		if (!project) {
			logger.warn(
				{ projectId: payload.projectId },
				"Project not found for production.build",
			);
			return;
		}

		if (project.status === "deleting") {
			logger.info(
				{ projectId: project.id },
				"Skipping production.build for deleting project",
			);
			return;
		}

		yield* Effect.tryPromise({
			try: () => updateProductionStatus(project.id, "building"),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "updateProductionStatus",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		yield* ctx.throwIfCancelRequested();

		const containerName = getPreviewContainerName(project.id);
		logger.info(
			{ projectId: project.id, containerName },
			"Starting production build inside preview container",
		);

		const result = yield* Effect.tryPromise({
			try: () =>
				spawnCommand(
					"docker",
					["exec", containerName, "pnpm", "run", "build"],
					{
						timeout: 5 * 60 * 1000,
					},
				),
			catch: (error) =>
				new ProductionBuildError({
					projectId: project.id,
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		if (!result.success) {
			const errorMsg = result.stderr || result.stdout || "Build failed";
			logger.error(
				{ projectId: project.id, error: errorMsg.slice(0, 500) },
				"Production build failed",
			);
			yield* Effect.tryPromise({
				try: () =>
					updateProductionStatus(project.id, "failed", {
						productionError: errorMsg.slice(0, 500),
					}),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "updateProductionStatus",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
			return yield* new ProductionBuildError({
				projectId: project.id,
				message: `Build failed: ${errorMsg.slice(0, 200)}`,
			});
		}

		logger.info({ projectId: project.id }, "Production build succeeded");

		const tempDistPath = path.join(
			os.tmpdir(),
			`doce-dist-${project.id}-${Date.now()}`,
		);

		yield* Effect.acquireRelease(Effect.succeed(tempDistPath), (tempPath) =>
			Effect.tryPromise({
				try: () =>
					fs.rm(tempPath, { recursive: true, force: true }).catch(() => {}),
				catch: () => null,
			}),
		);

		const productionHash = yield* extractAndHashDist(
			containerName,
			tempDistPath,
			project.id,
		);

		yield* ctx.throwIfCancelRequested();

		const productionPath = getProjectProductionPath(project.id, productionHash);
		yield* Effect.tryPromise({
			try: () => fs.mkdir(productionPath, { recursive: true }),
			catch: (error) =>
				new ProductionBuildError({
					projectId: project.id,
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		yield* extractFilesFromContainer(containerName, productionPath, project.id);

		logger.debug(
			{ projectId: project.id, productionHash, productionPath },
			"Production version files copied",
		);

		yield* Effect.tryPromise({
			try: () =>
				enqueueProductionStart({
					projectId: project.id,
					productionHash,
				}),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "enqueueProductionStart",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.debug(
			{ projectId: project.id, productionHash },
			"Enqueued production.start",
		);
	}).pipe(
		Effect.tapError((error) =>
			Effect.sync(() => {
				logger.error(
					{
						projectId: error.projectId,
						error: error.message,
					},
					"production.build handler failed",
				);
			}),
		),
	);
}

function extractAndHashDist(
	containerName: string,
	tempDistPath: string,
	projectId: string,
): Effect.Effect<string, ProductionBuildError> {
	return Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => fs.rm(tempDistPath, { recursive: true, force: true }),
			catch: () => null,
		});

		const cpResult = yield* Effect.tryPromise({
			try: () =>
				spawnCommand("docker", [
					"cp",
					`${containerName}:/app/dist`,
					tempDistPath,
				]),
			catch: (error) =>
				new ProductionBuildError({
					projectId,
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		if (!cpResult.success) {
			return yield* new ProductionBuildError({
				projectId,
				message: `Failed to extract dist from container: ${cpResult.stderr}`,
			});
		}

		const productionHash = yield* Effect.tryPromise({
			try: () => hashDistFolder(tempDistPath),
			catch: (error) =>
				new ProductionBuildError({
					projectId,
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.debug({ projectId, productionHash }, "Calculated production hash");
		return productionHash;
	});
}

function extractFilesFromContainer(
	containerName: string,
	productionPath: string,
	projectId: string,
): Effect.Effect<void, ProductionBuildError> {
	return Effect.gen(function* () {
		const files = [
			"package.json",
			"pnpm-lock.yaml",
			"Dockerfile.prod",
			"astro.config.mjs",
			"tsconfig.json",
		];

		for (const file of files) {
			const result = yield* Effect.tryPromise({
				try: () =>
					spawnCommand("docker", [
						"cp",
						`${containerName}:/app/${file}`,
						path.join(productionPath, file),
					]),
				catch: (error) =>
					new ProductionBuildError({
						projectId,
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
			if (!result.success) {
				return yield* new ProductionBuildError({
					projectId,
					message: `Failed to extract ${file} from container: ${result.stderr}`,
				});
			}
		}

		const srcResult = yield* Effect.tryPromise({
			try: () =>
				spawnCommand("docker", [
					"cp",
					`${containerName}:/app/src`,
					path.join(productionPath, "src"),
				]),
			catch: (error) =>
				new ProductionBuildError({
					projectId,
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});
		if (!srcResult.success) {
			return yield* new ProductionBuildError({
				projectId,
				message: `Failed to extract src from container: ${srcResult.stderr}`,
			});
		}

		const publicResult = yield* Effect.tryPromise({
			try: () =>
				spawnCommand("docker", [
					"cp",
					`${containerName}:/app/public`,
					path.join(productionPath, "public"),
				]),
			catch: (error) =>
				new ProductionBuildError({
					projectId,
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});
		if (!publicResult.success) {
			logger.debug({ projectId }, "public folder not found (optional)");
		}
	});
}
