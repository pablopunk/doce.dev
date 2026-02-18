import * as fs from "node:fs/promises";
import { Effect } from "effect";
import { composeDownWithVolumes } from "@/server/docker/compose";
import {
	DockerError,
	FilesystemError,
	ProjectError,
} from "@/server/effect/errors";
import { logger } from "@/server/logger";
import {
	getProjectPreviewPath,
	normalizeProjectPath,
} from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	hardDeleteProject,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { spawnCommand } from "@/server/utils/execAsync";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

interface ProjectDeleteState {
	projectId: string;
	projectDir: string;
	cleanupPerformed: boolean;
}

/**
 * Delete a project asynchronously via the queue system.
 *
 * Deletion steps (in order):
 * 1. Mark status as "deleting" to prevent new operations
 * 2. Stop and remove Docker containers + volumes (best-effort)
 * 3. Delete project files from disk (best-effort)
 * 4. Hard-delete from database (critical, must succeed)
 *
 * Each step can be cancelled via ctx.throwIfCancelRequested().
 * Best-effort steps continue on failure. The DB deletion is critical
 * and will cause job failure if it fails, triggering retries.
 */
export async function handleProjectDelete(ctx: QueueJobContext): Promise<void> {
	const effect = Effect.gen(function* () {
		const payload = parsePayload("project.delete", ctx.job.payloadJson);

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
			logger.info(
				{ projectId: payload.projectId },
				"Project not found, skipping delete",
			);
			return;
		}

		yield* Effect.tryPromise({
			try: () => ctx.throwIfCancelRequested(),
			catch: () => new Error("cancel_requested"),
		});

		const projectDir = normalizeProjectPath(project.pathOnDisk);
		const state: ProjectDeleteState = {
			projectId: project.id,
			projectDir,
			cleanupPerformed: false,
		};

		const deletionEffect = Effect.acquireRelease(
			Effect.sync(() => state),
			(finalState) =>
				Effect.sync(() => {
					if (!finalState.cleanupPerformed) {
						logger.debug(
							{ projectId: finalState.projectId },
							"Cleanup release triggered",
						);
					}
				}),
		);

		yield* deletionEffect.pipe(
			Effect.flatMap((deleteState) =>
				Effect.gen(function* () {
					yield* Effect.gen(function* () {
						yield* Effect.tryPromise({
							try: () => updateProjectStatus(project.id, "deleting"),
							catch: (error) =>
								new ProjectError({
									projectId: project.id,
									operation: "updateProjectStatus",
									message:
										error instanceof Error ? error.message : String(error),
									cause: error,
								}),
						});

						logger.debug(
							{ projectId: project.id },
							"Project marked as deleting",
						);
					}).pipe(
						Effect.catchAll((error) =>
							Effect.sync(() => {
								logger.warn(
									{ error, projectId: project.id },
									"Failed to update project status to deleting",
								);
							}),
						),
					);

					yield* Effect.tryPromise({
						try: () => ctx.throwIfCancelRequested(),
						catch: () => new Error("cancel_requested"),
					});

					// Step 2: Stop and remove Docker containers (best-effort)
					yield* Effect.gen(function* () {
						// Stop dev containers (preview + opencode)
						const previewPath = getProjectPreviewPath(project.id);

						yield* Effect.tryPromise({
							try: () => composeDownWithVolumes(project.id, previewPath),
							catch: (error) =>
								new DockerError({
									projectId: project.id,
									message:
										error instanceof Error ? error.message : String(error),
									cause: error,
								}),
						});

						logger.debug(
							{ projectId: project.id },
							"Dev containers stopped (preview + opencode)",
						);

						// Stop production container
						const containerName = `doce-prod-${project.id}`;

						const stopResult = yield* Effect.tryPromise({
							try: () => spawnCommand("docker", ["stop", containerName]),
							catch: () => ({
								success: false,
								stdout: "",
								stderr: "",
								exitCode: 1,
							}),
						});

						const removeResult = yield* Effect.tryPromise({
							try: () => spawnCommand("docker", ["rm", containerName]),
							catch: () => ({
								success: false,
								stdout: "",
								stderr: "",
								exitCode: 1,
							}),
						});

						if (stopResult.success && removeResult.success) {
							logger.debug(
								{ projectId: project.id, containerName },
								"Production container stopped and removed",
							);
						}

						// Clean up Docker images (best-effort)
						const imagePrefix = `doce-prod-${project.id}-`;

						const listResult = yield* Effect.tryPromise({
							try: () =>
								spawnCommand("docker", [
									"images",
									imagePrefix,
									"--format",
									"{{.Repository}}:{{.Tag}}",
								]),
							catch: () => ({
								success: false,
								stdout: "",
								stderr: "",
								exitCode: 1,
							}),
						});

						if (listResult.success && listResult.stdout) {
							const images = listResult.stdout
								.trim()
								.split("\n")
								.filter(Boolean);

							for (const image of images) {
								yield* Effect.tryPromise({
									try: () => spawnCommand("docker", ["rmi", image]),
									catch: () => ({
										success: false,
										stdout: "",
										stderr: "",
										exitCode: 1,
									}),
								});

								logger.debug(
									{ projectId: project.id, image },
									"Removed Docker image",
								);
							}
						}
					}).pipe(
						Effect.catchAll((error) =>
							Effect.sync(() => {
								logger.warn(
									{ error, projectId: project.id },
									"Failed to stop Docker containers or remove images",
								);
							}),
						),
					);

					yield* Effect.tryPromise({
						try: () => ctx.throwIfCancelRequested(),
						catch: () => new Error("cancel_requested"),
					});

					// Step 3: Delete project files from disk (best-effort)
					yield* Effect.gen(function* () {
						yield* Effect.tryPromise({
							try: () =>
								fs.rm(deleteState.projectDir, {
									recursive: true,
									force: true,
								}),
							catch: (error) =>
								new FilesystemError({
									path: deleteState.projectDir,
									operation: "delete",
									message:
										error instanceof Error ? error.message : String(error),
									cause: error,
								}),
						});

						logger.debug(
							{ projectId: project.id },
							"Deleted project directory",
						);
					}).pipe(
						Effect.catchAll((error) =>
							Effect.sync(() => {
								logger.warn(
									{ error, projectId: project.id },
									"Failed to delete project directory from disk",
								);
							}),
						),
					);

					yield* Effect.tryPromise({
						try: () => ctx.throwIfCancelRequested(),
						catch: () => new Error("cancel_requested"),
					});

					// Step 4: Hard-delete from database (CRITICAL - must succeed)
					yield* Effect.gen(function* () {
						yield* Effect.tryPromise({
							try: () => hardDeleteProject(project.id),
							catch: (error) =>
								new ProjectError({
									projectId: project.id,
									operation: "hardDeleteProject",
									message:
										error instanceof Error ? error.message : String(error),
									cause: error,
								}),
						});

						logger.info(
							{ projectId: project.id },
							"Project hard-deleted from database",
						);
					});

					deleteState.cleanupPerformed = true;
				}),
			),
		);
	});

	return Effect.runPromise(effect);
}
