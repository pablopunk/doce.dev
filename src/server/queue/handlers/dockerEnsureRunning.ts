import { Effect } from "effect";
import {
	composeUp,
	ensureDoceSharedNetwork,
	ensureGlobalPnpmVolume,
} from "@/server/docker/compose";
import { ProjectError, type RescheduleError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { getProjectPreviewPath } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { enqueueDockerWaitReady } from "../enqueue";
import { parsePayload } from "../types";

export function handleDockerEnsureRunning(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError | RescheduleError> {
	return Effect.gen(function* () {
		const payload = parsePayload("docker.ensureRunning", ctx.job.payloadJson);

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
			return;
		}

		if (project.status === "deleting") {
			return;
		}

		yield* Effect.tryPromise({
			try: () => updateProjectStatus(project.id, "starting"),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "updateProjectStatus",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		yield* ctx.throwIfCancelRequested();

		yield* Effect.tryPromise({
			try: ensureDoceSharedNetwork,
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "ensureDoceSharedNetwork",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		yield* Effect.tryPromise({
			try: ensureGlobalPnpmVolume,
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "ensureGlobalPnpmVolume",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		const previewPath = getProjectPreviewPath(project.id);
		const result = yield* Effect.tryPromise({
			try: () => composeUp(project.id, previewPath, true, true),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "composeUp",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		if (!result.success) {
			yield* Effect.tryPromise({
				try: () => updateProjectStatus(project.id, "error"),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "updateProjectStatus",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
			return yield* new ProjectError({
				projectId: project.id,
				operation: "composeUp",
				message: `compose up failed: ${result.stderr.slice(0, 500)}`,
			});
		}

		// Delegate health-check polling to docker.waitReady (up to 5 min)
		// which will then enqueue sessionCreate -> sendUserPrompt as needed
		yield* Effect.tryPromise({
			try: () =>
				enqueueDockerWaitReady({
					projectId: project.id,
					startedAt: Date.now(),
					rescheduleCount: 0,
				}),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "enqueueDockerWaitReady",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.info(
			{ projectId: project.id },
			"Enqueued docker.waitReady after ensureRunning compose-up",
		);
	});
}
