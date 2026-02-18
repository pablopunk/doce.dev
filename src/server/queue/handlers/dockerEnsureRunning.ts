import { Effect } from "effect";
import {
	composeUp,
	ensureDoceSharedNetwork,
	ensureGlobalPnpmVolume,
	ensureOpencodeStorageVolume,
	ensureProjectDataVolume,
} from "@/server/docker/compose";
import { pushAuthToContainer } from "@/server/docker/pushAuth";
import { ProjectError, type RescheduleError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import {
	checkOpencodeReady,
	checkPreviewReady,
} from "@/server/projects/health";
import { getProjectPreviewPath } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { enqueueOpencodeSessionCreate } from "../enqueue";
import { parsePayload } from "../types";

const START_MAX_WAIT_MS = 30_000;

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

		yield* Effect.tryPromise({
			try: () => ensureProjectDataVolume(project.id),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "ensureProjectDataVolume",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		yield* Effect.tryPromise({
			try: () => ensureOpencodeStorageVolume(project.id),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "ensureOpencodeStorageVolume",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		const previewPath = getProjectPreviewPath(project.id);
		const result = yield* Effect.tryPromise({
			try: () => composeUp(project.id, previewPath),
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

		const startedAt = Date.now();

		while (Date.now() - startedAt < START_MAX_WAIT_MS) {
			yield* ctx.throwIfCancelRequested();

			const [previewReady, opencodeReady] = yield* Effect.tryPromise({
				try: () =>
					Promise.all([
						checkPreviewReady(project.id),
						checkOpencodeReady(project.id),
					]),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "healthCheck",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});

			if (previewReady && opencodeReady) {
				yield* Effect.tryPromise({
					try: () => pushAuthToContainer(project.id),
					catch: (error) => {
						logger.warn(
							{ error, projectId: project.id },
							"Failed to push auth to container (non-fatal)",
						);
						return null;
					},
				});

				yield* Effect.tryPromise({
					try: () => updateProjectStatus(project.id, "running"),
					catch: (error) =>
						new ProjectError({
							projectId: project.id,
							operation: "updateProjectStatus",
							message: error instanceof Error ? error.message : String(error),
							cause: error,
						}),
				});

				try {
					const isRunningInDocker = !!process.env.DOCE_NETWORK;
					const baseUrl = isRunningInDocker
						? `http://doce_${project.id}-opencode-1:3000`
						: `http://localhost:${project.opencodePort}`;
					const sessionUrl = `${baseUrl}/session`;
					const sessionsRes = yield* Effect.tryPromise({
						try: () => fetch(sessionUrl),
						catch: () => null,
					});

					if (sessionsRes?.ok) {
						const sessions = yield* Effect.tryPromise({
							try: () => sessionsRes.json() as Promise<unknown[]>,
							catch: () => [],
						});
						const sessionsArray = Array.isArray(sessions) ? sessions : [];

						if (sessionsArray.length === 0) {
							logger.info(
								{ projectId: project.id },
								"Sessions lost after restart, creating new session...",
							);
							yield* Effect.tryPromise({
								try: () =>
									enqueueOpencodeSessionCreate({ projectId: project.id }),
								catch: (error) => {
									logger.warn(
										{ error, projectId: project.id },
										"Failed to enqueue session create",
									);
									return null;
								},
							});
						}
					}
				} catch (error) {
					logger.warn(
						{ error, projectId: project.id },
						"Failed to check/restore sessions after restart",
					);
				}

				return;
			}

			yield* Effect.sleep(1000);
		}

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

		logger.warn(
			{ projectId: project.id },
			"Timed out waiting for project readiness",
		);

		return yield* new ProjectError({
			projectId: project.id,
			operation: "waitReady",
			message: "timed out waiting for preview/opencode readiness",
		});
	});
}
