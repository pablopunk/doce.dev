import { Effect } from "effect";
import {
	composePs,
	composeStart,
	composeUp,
	ensureDoceSharedNetwork,
	ensureGlobalPnpmVolume,
	parseComposePs,
} from "@/server/docker/compose";
import { ProjectError, type RescheduleError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { checkPreviewReady } from "@/server/projects/health";
import { getProjectPreviewPath } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { enqueueDockerWaitReady } from "../enqueue";
import { parsePayload } from "../types";

const startExistingPreview = (projectId: string, previewPath: string) =>
	Effect.tryPromise({
		try: () => composeStart(projectId, previewPath),
		catch: (error) =>
			new ProjectError({
				projectId,
				operation: "composeStart",
				message: error instanceof Error ? error.message : String(error),
				cause: error,
			}),
	});

const createPreview = (projectId: string, previewPath: string) =>
	Effect.tryPromise({
		try: () => composeUp(projectId, previewPath, true, true),
		catch: (error) =>
			new ProjectError({
				projectId,
				operation: "composeUp",
				message: error instanceof Error ? error.message : String(error),
				cause: error,
			}),
	});

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

		const previewAlreadyHealthy = yield* Effect.tryPromise({
			try: () => checkPreviewReady(project.id),
			catch: () => false,
		}).pipe(Effect.orElse(() => Effect.succeed(false)));

		if (previewAlreadyHealthy) {
			logger.info({ projectId: project.id }, "Preview already running");
		} else {
			const composePsResult = yield* Effect.tryPromise({
				try: () => composePs(project.id, previewPath),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "composePs",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});

			const containers = composePsResult.success
				? parseComposePs(composePsResult.stdout)
				: [];
			const hasExistingContainers = containers.length > 0;

			const result = hasExistingContainers
				? yield* startExistingPreview(project.id, previewPath)
				: yield* createPreview(project.id, previewPath);

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
					operation: hasExistingContainers ? "composeStart" : "composeUp",
					message: `${hasExistingContainers ? "compose start" : "compose up"} failed: ${result.stderr.slice(0, 500)}`,
				});
			}

			logger.info(
				{ projectId: project.id, path: hasExistingContainers ? "start" : "up" },
				hasExistingContainers
					? "Preview resumed with compose start"
					: "Preview missing, falling back to compose up",
			);
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
			"Enqueued docker.waitReady after ensureRunning",
		);
	});
}
