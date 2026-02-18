import { Effect } from "effect";
import { ensureGlobalPnpmVolume } from "@/server/docker/compose";
import { ProjectNotFoundError } from "@/server/effect/errors";
import { DockerService } from "@/server/effect/layers";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { getProjectPreviewPath } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { enqueueDockerWaitReady } from "../enqueue";
import { parsePayload } from "../types";

const fetchProjectById = (projectId: string) =>
	Effect.tryPromise({
		try: () => getProjectByIdIncludeDeleted(projectId),
		catch: () => new ProjectNotFoundError({ projectId }),
	});

const setProjectStatus = (projectId: string, status: "starting" | "error") =>
	Effect.tryPromise({
		try: () => updateProjectStatus(projectId, status),
		catch: (error) => new Error(`Failed to update project status: ${error}`),
	});

const setupGlobalPnpmVolume = () =>
	Effect.tryPromise({
		try: ensureGlobalPnpmVolume,
		catch: (error) =>
			new Error(`Failed to ensure global pnpm volume: ${error}`),
	});

const scheduleDockerWaitReady = (input: {
	projectId: string;
	startedAt: number;
	rescheduleCount: number;
}) =>
	Effect.tryPromise({
		try: () => enqueueDockerWaitReady(input),
		catch: (error) => new Error(`Failed to enqueue docker.waitReady: ${error}`),
	});

const logInfo = (msg: string, obj?: Record<string, unknown>) =>
	Effect.sync(() => {
		if (obj) {
			logger.info(obj, msg);
		} else {
			logger.info(msg);
		}
	});

const logDebug = (msg: string, obj?: Record<string, unknown>) =>
	Effect.sync(() => {
		if (obj) {
			logger.debug(obj, msg);
		} else {
			logger.debug(msg);
		}
	});

export const handleDockerComposeUp = (
	ctx: QueueJobContext,
): Effect.Effect<void, never, DockerService> =>
	Effect.gen(function* () {
		const payload = parsePayload("docker.composeUp", ctx.job.payloadJson);

		const project = yield* fetchProjectById(payload.projectId);

		if (!project) {
			yield* logInfo("Project not found for docker.composeUp", {
				projectId: payload.projectId,
			});
			return;
		}

		if (project.status === "deleting") {
			yield* logInfo("Skipping docker.composeUp for deleting project", {
				projectId: project.id,
			});
			return;
		}

		yield* setProjectStatus(project.id, "starting");

		yield* ctx.throwIfCancelRequested();

		const docker = yield* DockerService;

		yield* docker.ensureDoceSharedNetwork();
		yield* setupGlobalPnpmVolume();
		yield* docker.ensureProjectDataVolume(project.id);
		yield* docker.ensureOpencodeStorageVolume(project.id);

		const previewPath = getProjectPreviewPath(project.id);
		const result = yield* docker.composeUp(project.id, previewPath);

		if (!result.success) {
			const errorMsg = `compose up failed: ${result.stderr.slice(0, 500)}`;
			yield* setProjectStatus(project.id, "error");
			yield* Effect.fail(new Error(errorMsg));
			return;
		}

		yield* logInfo("Docker compose up succeeded", { projectId: project.id });

		yield* scheduleDockerWaitReady({
			projectId: project.id,
			startedAt: Date.now(),
			rescheduleCount: 0,
		});

		yield* logDebug("Enqueued docker.waitReady", { projectId: project.id });
	});
