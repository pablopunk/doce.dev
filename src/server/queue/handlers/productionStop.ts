import * as fs from "node:fs/promises";
import { Effect } from "effect";
import { ProjectError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { updateProductionStatus } from "@/server/productions/productions.model";
import {
	getProductionContainerName,
	getProductionPath,
} from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { getTailscaleConfig } from "@/server/tailscale/config";
import { unregisterServe } from "@/server/tailscale/serve";
import { spawnCommand } from "@/server/utils/execAsync";
import { parsePayload } from "../types";

export function handleProductionStop(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError> {
	return Effect.gen(function* () {
		const payload = parsePayload("production.stop", ctx.job.payloadJson);

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
				"Project not found for production.stop",
			);
			return;
		}

		const containerName = getProductionContainerName(project.id);

		logger.info(
			{ projectId: project.id, containerName },
			"Stopping production container",
		);

		yield* stopContainer(project.id, containerName);
		yield* removeContainer(project.id, containerName);
		yield* removeDockerImages(project.id);
		yield* removeProductionArtifacts(project.id);

		// Unregister Tailscale Serve
		const tailscaleConfig = yield* Effect.tryPromise({
			try: () => getTailscaleConfig(),
			catch: () => ({ enabled: false }),
		}).pipe(Effect.orElse(() => Effect.succeed({ enabled: false })));

		if (tailscaleConfig.enabled && project.productionPort) {
			yield* Effect.tryPromise({
				try: () => unregisterServe(443),
				catch: () => undefined,
			}).pipe(
				Effect.catchAll(() =>
					Effect.sync(() => {
						logger.warn(
							{ projectId: project.id },
							"Tailscale Serve unregistration failed, continuing cleanup",
						);
					}),
				),
			);
		}

		if (project.status !== "deleting") {
			yield* Effect.tryPromise({
				try: () =>
					updateProductionStatus(project.id, "stopped", {
						productionUrl: null,
					}),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "updateProductionStatus",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
		}

		logger.info({ projectId: project.id }, "Production cleanup complete");
	}).pipe(
		Effect.tapError((error) =>
			Effect.sync(() => {
				logger.error(
					{
						projectId: error.projectId,
						error: error.message,
					},
					"production.stop handler failed",
				);
			}),
		),
	);
}

function stopContainer(
	projectId: string,
	containerName: string,
): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const result = yield* Effect.tryPromise({
			try: () => spawnCommand("docker", ["stop", containerName]),
			catch: () => null,
		});

		if (!result?.success) {
			logger.warn(
				{ projectId, stderr: result?.stderr?.slice(0, 200) },
				"Failed to stop production container (may not exist)",
			);
		}
	}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
}

function removeContainer(
	projectId: string,
	containerName: string,
): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const result = yield* Effect.tryPromise({
			try: () => spawnCommand("docker", ["rm", containerName]),
			catch: () => null,
		});

		if (!result?.success) {
			logger.warn(
				{ projectId, stderr: result?.stderr?.slice(0, 200) },
				"Failed to remove production container (may not exist)",
			);
		}
	}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
}

function removeDockerImages(projectId: string): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const imagePrefix = `${getProductionContainerName(projectId)}-`;

		const listResult = yield* Effect.tryPromise({
			try: () =>
				spawnCommand("docker", [
					"images",
					imagePrefix,
					"--format",
					"{{.Repository}}:{{.Tag}}",
				]),
			catch: () => null,
		});

		if (!listResult?.success || !listResult.stdout) return;

		const images = listResult.stdout.trim().split("\n").filter(Boolean);
		for (const image of images) {
			const rmiResult = yield* Effect.tryPromise({
				try: () => spawnCommand("docker", ["rmi", image]),
				catch: () => null,
			});
			if (rmiResult?.success) {
				logger.debug({ projectId, image }, "Removed Docker image");
			}
		}
	}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
}

function removeProductionArtifacts(
	projectId: string,
): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const productionDir = getProductionPath(projectId);
		yield* Effect.tryPromise({
			try: () => fs.rm(productionDir, { recursive: true, force: true }),
			catch: () => null,
		});
		logger.debug({ projectId, productionDir }, "Removed production artifacts");
	}).pipe(Effect.orElse(() => Effect.succeed(undefined)));
}
