import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Effect } from "effect";
import { ProjectError, type RescheduleError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import {
	checkDockerContainerReady,
	checkHttpServerReady,
} from "@/server/health/checkHealthEndpoint";
import { logger } from "@/server/logger";
import { cleanupOldProductionVersions } from "@/server/productions/cleanup";
import {
	getPreviousReleaseHash,
	updateProductionStatus,
} from "@/server/productions/productions.model";
import {
	getProductionCurrentSymlink,
	getProductionPath,
} from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { parsePayload } from "../types";

const WAIT_TIMEOUT_MS = 300_000;
const POLL_DELAY_MS = 1_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export function handleProductionWaitReady(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError | RescheduleError> {
	return Effect.gen(function* () {
		const payload = parsePayload("production.waitReady", ctx.job.payloadJson);

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
				"Project not found for production.waitReady",
			);
			return;
		}

		if (project.status === "deleting") {
			logger.info(
				{ projectId: project.id },
				"Skipping production.waitReady for deleting project",
			);
			return;
		}

		logger.info(
			{ projectId: project.id, jobId: ctx.job.id, attempts: ctx.job.attempts },
			"production.waitReady handler started",
		);

		yield* ctx.throwIfCancelRequested();

		const elapsed = Date.now() - payload.startedAt;

		if (elapsed > WAIT_TIMEOUT_MS) {
			const errorMsg = `Timed out waiting for production server to be ready (${Math.round(elapsed / 1000)}s of ${WAIT_TIMEOUT_MS / 1000}s allowed)`;
			logger.error(
				{ projectId: project.id, elapsed, maxWait: WAIT_TIMEOUT_MS },
				errorMsg,
			);

			yield* rollbackOrFail(project.id, payload.productionHash, errorMsg);
			return;
		}

		const httpReady = yield* Effect.tryPromise({
			try: () =>
				checkHttpServerReady(payload.productionPort, HEALTH_CHECK_TIMEOUT_MS),
			catch: () => false,
		}).pipe(Effect.orElse(() => Effect.succeed(false)));

		const containerName = `doce-prod-${project.id}`;
		const dockerReady = yield* Effect.tryPromise({
			try: () => checkDockerContainerReady(containerName),
			catch: () => false,
		}).pipe(Effect.orElse(() => Effect.succeed(false)));
		const productionReady = httpReady || dockerReady;

		logger.info(
			{
				projectId: project.id,
				productionPort: payload.productionPort,
				httpReady,
				dockerReady,
				containerName,
				productionReady,
				elapsed,
				attempts: ctx.job.attempts,
			},
			"Health check complete",
		);

		if (productionReady) {
			yield* promoteRelease(project.id, payload.productionHash);

			const productionUrl = `http://localhost:${payload.productionPort}`;
			yield* Effect.tryPromise({
				try: () =>
					updateProductionStatus(project.id, "running", {
						productionUrl,
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
				try: () => cleanupOldProductionVersions(project.id, 2),
				catch: (error) => {
					logger.warn(
						{ projectId: project.id, error },
						"Failed to cleanup old production versions",
					);
					return null;
				},
			});

			logger.info(
				{
					projectId: project.id,
					productionUrl,
					elapsed,
					attempts: ctx.job.attempts,
				},
				"Production server is ready and promoted",
			);

			return;
		}

		logger.debug(
			{
				projectId: project.id,
				elapsed,
				attempts: ctx.job.attempts,
				nextRetryIn: POLL_DELAY_MS,
			},
			"Production server not ready, rescheduling",
		);

		ctx.reschedule(POLL_DELAY_MS);
	});
}

function rollbackOrFail(
	projectId: string,
	failedHash: string,
	errorMsg: string,
): Effect.Effect<void, ProjectError> {
	return Effect.gen(function* () {
		const previousHash = yield* Effect.tryPromise({
			try: () => getPreviousReleaseHash(projectId, failedHash),
			catch: () => null,
		}).pipe(Effect.orElse(() => Effect.succeed(null)));

		if (!previousHash) {
			yield* Effect.tryPromise({
				try: () =>
					updateProductionStatus(projectId, "failed", {
						productionError: errorMsg,
					}),
				catch: (error) =>
					new ProjectError({
						projectId,
						operation: "updateProductionStatus",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
			return;
		}

		yield* promoteRelease(projectId, previousHash);
		yield* Effect.tryPromise({
			try: () =>
				updateProductionStatus(projectId, "running", {
					productionHash: previousHash,
					productionError: `Rolled back to ${previousHash} after: ${errorMsg}`,
				}),
			catch: (error) =>
				new ProjectError({
					projectId,
					operation: "updateProductionStatus",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.info(
			{ projectId, failedHash, previousHash },
			"Rolled back to previous release after timeout",
		);
	});
}

function promoteRelease(
	projectId: string,
	productionHash: string,
): Effect.Effect<void, ProjectError> {
	return Effect.gen(function* () {
		const symlinkPath = getProductionCurrentSymlink(projectId);
		yield* Effect.tryPromise({
			try: () => fs.mkdir(path.dirname(symlinkPath), { recursive: true }),
			catch: (error) =>
				new ProjectError({
					projectId,
					operation: "mkdir",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		const hashPath = getProductionPath(projectId, productionHash);
		const tempSymlink = `${symlinkPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		yield* Effect.tryPromise({
			try: () => fs.unlink(tempSymlink).catch(() => {}),
			catch: () => null,
		});
		yield* Effect.tryPromise({
			try: () => fs.symlink(hashPath, tempSymlink),
			catch: (error) =>
				new ProjectError({
					projectId,
					operation: "symlink",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});
		yield* Effect.tryPromise({
			try: () => fs.rename(tempSymlink, symlinkPath),
			catch: (error) =>
				new ProjectError({
					projectId,
					operation: "rename",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.info(
			{ projectId, symlinkPath, target: hashPath },
			"Promoted release: current symlink updated",
		);
	});
}
