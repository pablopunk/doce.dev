import { Effect } from "effect";
import {
	type DockerOperationError,
	ProjectNotFoundError,
	RescheduleError,
} from "@/server/effect/errors";
import { DockerService } from "@/server/effect/layers";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { getProjectPath } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { enqueueOpencodeSessionCreate } from "../enqueue";
import { parsePayload } from "../types";

const WAIT_TIMEOUT_MS = 300_000; // 5 minutes max wait
const POLL_DELAY_MS = 1_000; // 1 second between polls

type Project = NonNullable<
	Awaited<ReturnType<typeof getProjectByIdIncludeDeleted>>
>;

const getProjectOrFail = (
	projectId: string,
): Effect.Effect<Project, ProjectNotFoundError> =>
	Effect.gen(function* () {
		const project = yield* Effect.tryPromise({
			try: () => getProjectByIdIncludeDeleted(projectId),
			catch: () => new ProjectNotFoundError({ projectId }),
		});

		if (!project) {
			return yield* Effect.fail(new ProjectNotFoundError({ projectId }));
		}

		return project;
	});

const shouldSkipDeletedProject = (
	project: Project,
): Effect.Effect<boolean, never> =>
	Effect.sync(() => {
		if (project.status === "deleting") {
			logger.info(
				{ projectId: project.id },
				"Skipping docker.waitReady for deleting project",
			);
			return true;
		}
		return false;
	});

const checkContainersHealthy = (
	projectId: string,
	projectPath: string,
): Effect.Effect<boolean, DockerOperationError, DockerService> =>
	Effect.gen(function* () {
		const docker = yield* DockerService;
		return yield* docker.waitForHealthy(projectId, projectPath, POLL_DELAY_MS);
	});

const handleServicesReady = (
	project: Project,
	elapsed: number,
	attempts: number,
): Effect.Effect<void, never> =>
	Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => updateProjectStatus(project.id, "running"),
			catch: (error) => {
				logger.error(
					{ projectId: project.id, error },
					"Failed to update project status to running",
				);
			},
		}).pipe(Effect.orElse(() => Effect.void));

		logger.info(
			{ projectId: project.id, elapsed, attempts },
			"Services are ready",
		);

		if (!project.initialPromptSent) {
			yield* Effect.tryPromise({
				try: () => enqueueOpencodeSessionCreate({ projectId: project.id }),
				catch: (error) => {
					logger.error(
						{ projectId: project.id, error },
						"Failed to enqueue opencode.sessionCreate",
					);
				},
			}).pipe(Effect.orElse(() => Effect.void));
			logger.info({ projectId: project.id }, "Enqueued opencode.sessionCreate");
		}
	});

const handleNotReady = (
	projectId: string,
	elapsed: number,
	attempts: number,
): Effect.Effect<never, RescheduleError, never> =>
	Effect.gen(function* () {
		logger.info(
			{ projectId, elapsed, attempts, nextRetryIn: POLL_DELAY_MS },
			"Services not ready, rescheduling",
		);

		return yield* Effect.fail(
			new RescheduleError({
				jobId: projectId,
				delayMs: POLL_DELAY_MS,
				reason: "Services not ready yet",
			}),
		);
	});

export const handleDockerWaitReady = (
	ctx: QueueJobContext,
): Effect.Effect<void, unknown, DockerService> =>
	Effect.gen(function* () {
		const payload = parsePayload("docker.waitReady", ctx.job.payloadJson);

		const project = yield* getProjectOrFail(payload.projectId).pipe(
			Effect.catchTag("ProjectNotFoundError", () => {
				logger.warn(
					{ projectId: payload.projectId },
					"Project not found for docker.waitReady",
				);
				return Effect.succeed(null);
			}),
		);

		if (!project) {
			return;
		}

		const shouldSkip = yield* shouldSkipDeletedProject(project);
		if (shouldSkip) {
			return;
		}

		logger.info(
			{ projectId: project.id, jobId: ctx.job.id, attempts: ctx.job.attempts },
			"docker.waitReady handler started",
		);

		yield* ctx.throwIfCancelRequested();

		const elapsed = Date.now() - payload.startedAt;
		if (elapsed > WAIT_TIMEOUT_MS) {
			const errorMsg = `Timed out waiting for services to be ready (${elapsed}ms of ${WAIT_TIMEOUT_MS}ms allowed)`;
			logger.error(
				{
					projectId: project.id,
					elapsed,
					maxWait: WAIT_TIMEOUT_MS,
				},
				errorMsg,
			);
			yield* Effect.tryPromise({
				try: () => updateProjectStatus(project.id, "error"),
				catch: () => {},
			}).pipe(Effect.orElse(() => Effect.void));
			return;
		}

		const projectPath = getProjectPath(project.id);
		const isHealthy = yield* checkContainersHealthy(project.id, projectPath);

		logger.info(
			{ projectId: project.id, isHealthy, elapsed, attempts: ctx.job.attempts },
			"Health check complete",
		);

		if (isHealthy) {
			yield* handleServicesReady(project, elapsed, ctx.job.attempts);
			return;
		}

		return yield* handleNotReady(project.id, elapsed, ctx.job.attempts);
	}).pipe(
		Effect.catchAll((error) => {
			if (error instanceof RescheduleError) {
				return Effect.fail(error);
			}
			logger.warn(
				{ jobId: ctx.job.id, error: String(error) },
				"Docker wait failed, rescheduling",
			);
			return Effect.fail(
				new RescheduleError({
					jobId: ctx.job.id,
					delayMs: POLL_DELAY_MS,
					reason: `Docker operation failed: ${String(error)}`,
				}),
			);
		}),
	);
