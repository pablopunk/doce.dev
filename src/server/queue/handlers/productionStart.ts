import { Effect } from "effect";
import { ProductionDeployError, ProjectError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProductionPath } from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { spawnCommand } from "@/server/utils/execAsync";
import { enqueueProductionWaitReady } from "../enqueue";
import { parsePayload } from "../types";

export function handleProductionStart(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError | ProductionDeployError> {
	return Effect.gen(function* () {
		const payload = parsePayload("production.start", ctx.job.payloadJson);

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
				"Project not found for production.start",
			);
			return;
		}

		if (project.status === "deleting") {
			logger.info(
				{ projectId: project.id },
				"Skipping production.start for deleting project",
			);
			return;
		}

		if (!project.productionPort) {
			logger.warn(
				{ projectId: project.id },
				"Project has no productionPort, skipping deployment",
			);
			return;
		}

		const productionPath = getProductionPath(
			project.id,
			payload.productionHash,
		);
		const productionPort = project.productionPort;

		yield* ctx.throwIfCancelRequested();

		yield* stopProductionContainer(project.id);

		const imageName = `doce-prod-${project.id}-${payload.productionHash}`;
		logger.info(
			{ projectId: project.id, imageName },
			"Building production Docker image",
		);

		const buildResult = yield* Effect.tryPromise({
			try: () =>
				spawnCommand(
					"docker",
					["build", "-t", imageName, "-f", "Dockerfile.prod", "."],
					{ cwd: productionPath },
				),
			catch: (error) =>
				new ProductionDeployError({
					projectId: project.id,
					hash: payload.productionHash,
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		if (!buildResult.success) {
			const errorMsg = `Docker build failed: ${buildResult.stderr.slice(0, 500)}`;
			logger.error(
				{ projectId: project.id, error: errorMsg },
				"Docker build failed",
			);
			yield* Effect.tryPromise({
				try: () =>
					updateProductionStatus(project.id, "failed", {
						productionError: errorMsg,
					}),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "updateProductionStatus",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
			return yield* new ProductionDeployError({
				projectId: project.id,
				hash: payload.productionHash,
				message: errorMsg,
			});
		}

		logger.info(
			{ projectId: project.id, imageName },
			"Docker image built successfully",
		);

		yield* ctx.throwIfCancelRequested();

		const containerName = `doce-prod-${project.id}`;
		logger.info(
			{ projectId: project.id, containerName, productionPort },
			"Starting production container",
		);

		const runResult = yield* Effect.tryPromise({
			try: () =>
				spawnCommand("docker", [
					"run",
					"-d",
					"--name",
					containerName,
					"-p",
					`${productionPort}:3000`,
					"-e",
					"PORT=3000",
					"-e",
					"HOST=0.0.0.0",
					"--restart",
					"unless-stopped",
					imageName,
				]),
			catch: (error) =>
				new ProductionDeployError({
					projectId: project.id,
					hash: payload.productionHash,
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		if (!runResult.success) {
			const errorMsg = `Docker run failed: ${runResult.stderr.slice(0, 500)}`;
			logger.error(
				{ projectId: project.id, error: errorMsg },
				"Docker run failed",
			);
			yield* Effect.tryPromise({
				try: () =>
					updateProductionStatus(project.id, "failed", {
						productionError: errorMsg,
					}),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "updateProductionStatus",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
			return yield* new ProductionDeployError({
				projectId: project.id,
				hash: payload.productionHash,
				message: errorMsg,
			});
		}

		logger.info(
			{
				projectId: project.id,
				containerName,
				productionPort,
			},
			"Production container started",
		);

		yield* Effect.tryPromise({
			try: () =>
				updateProductionStatus(project.id, "building", {
					productionStartedAt: new Date(),
					productionHash: payload.productionHash,
				}),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "updateProductionStatus",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		yield* Effect.tryPromise({
			try: () =>
				enqueueProductionWaitReady({
					projectId: project.id,
					productionPort,
					productionHash: payload.productionHash,
					startedAt: Date.now(),
					rescheduleCount: 0,
				}),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "enqueueProductionWaitReady",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.debug(
			{
				projectId: project.id,
				productionPort,
				hash: payload.productionHash.slice(0, 8),
			},
			"Enqueued production.waitReady",
		);
	}).pipe(
		Effect.tapError((error) =>
			Effect.sync(() => {
				logger.error(
					{
						projectId: error.projectId,
						error: error.message,
					},
					"production.start handler failed",
				);
			}),
		),
	);
}

function stopProductionContainer(
	projectId: string,
): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const containerName = `doce-prod-${projectId}`;

		yield* Effect.tryPromise({
			try: () => spawnCommand("docker", ["stop", containerName]),
			catch: () => null,
		});

		yield* Effect.tryPromise({
			try: () => spawnCommand("docker", ["rm", containerName]),
			catch: () => null,
		});

		logger.debug(
			{ projectId, containerName },
			"Stopped and removed production container",
		);
	}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
}
