import { Effect } from "effect";
import { pushAuthToContainer } from "@/server/docker/pushAuth";
import {
	ContainerTimeoutError,
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
const MAX_RESCHEDULE_ATTEMPTS = 10;

type Project = NonNullable<
	Awaited<ReturnType<typeof getProjectByIdIncludeDeleted>>
>;

const checkTimeout = (
	startedAt: number,
	timeoutMs: number,
	projectId: string,
): Effect.Effect<void, ContainerTimeoutError> =>
	Effect.gen(function* () {
		const elapsed = Date.now() - startedAt;
		if (elapsed > timeoutMs) {
			return yield* Effect.fail(
				new ContainerTimeoutError({
					projectId,
					timeoutMs,
					waitedMs: elapsed,
				}),
			);
		}
	});

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

const waitForContainersHealthy = (
	projectId: string,
	projectPath: string,
): Effect.Effect<boolean, DockerOperationError, DockerService> =>
	Effect.gen(function* () {
		const docker = yield* DockerService;
		return yield* docker.waitForHealthy(
			projectId,
			projectPath,
			WAIT_TIMEOUT_MS,
		);
	});

const handleServicesReady = (
	project: Project,
	elapsed: number,
	attempts: number,
): Effect.Effect<void, never> =>
	Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => pushAuthToContainer(project.id),
			catch: () => {
				logger.warn(
					{ projectId: project.id },
					"Failed to push auth.json to container (non-fatal)",
				);
			},
		}).pipe(Effect.orElse(() => Effect.void));

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

const handleMaxAttemptsExceeded = (
	projectId: string,
	attempts: number,
	elapsed: number,
): Effect.Effect<never, RescheduleError, never> =>
	Effect.gen(function* () {
		const errorMsg = `Services failed to become ready after ${attempts} polling attempts (${elapsed}ms elapsed)`;
		logger.error({ projectId, attempts, elapsed }, errorMsg);

		yield* Effect.tryPromise({
			try: () => updateProjectStatus(projectId, "error"),
			catch: () => {},
		}).pipe(Effect.orElse(() => Effect.void));

		return yield* Effect.fail(
			new RescheduleError({
				jobId: projectId,
				delayMs: POLL_DELAY_MS,
				reason: `Max attempts exceeded: ${errorMsg}`,
			}),
		);
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

		yield* checkTimeout(payload.startedAt, WAIT_TIMEOUT_MS, project.id).pipe(
			Effect.catchTag("ContainerTimeoutError", (error) => {
				const errorMsg = `Timed out waiting for services to be ready (${error.waitedMs}ms of ${error.timeoutMs}ms allowed)`;
				logger.error(
					{
						projectId: project.id,
						elapsed: error.waitedMs,
						maxWait: error.timeoutMs,
					},
					errorMsg,
				);
				return Effect.tryPromise({
					try: () => updateProjectStatus(project.id, "error"),
					catch: () => {},
				}).pipe(Effect.orElse(() => Effect.void));
			}),
		);

		const projectPath = getProjectPath(project.id);
		const isHealthy = yield* waitForContainersHealthy(project.id, projectPath);

		const elapsed = Date.now() - payload.startedAt;

		logger.info(
			{ projectId: project.id, isHealthy, elapsed, attempts: ctx.job.attempts },
			"Health check complete",
		);

		if (isHealthy) {
			yield* handleServicesReady(project, elapsed, ctx.job.attempts);
			return;
		}

		if (ctx.job.attempts >= MAX_RESCHEDULE_ATTEMPTS) {
			return yield* handleMaxAttemptsExceeded(
				project.id,
				ctx.job.attempts,
				elapsed,
			);
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
