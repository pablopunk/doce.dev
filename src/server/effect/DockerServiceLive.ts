import { Effect, Layer } from "effect";
import type { ContainerStatus as DockerContainerStatus } from "@/server/docker/compose";
import {
	composeDown,
	composeDownProduction,
	composeDownWithVolumes,
	composePs,
	composeStart,
	composeStop,
	composeUp,
	composeUpProduction,
	ensureDoceSharedNetwork,
	ensureProjectDataVolume,
	parseComposePs,
} from "@/server/docker/compose";
import {
	stopStreamingContainerLogs,
	streamContainerLogs,
} from "@/server/docker/logs";
import { logger } from "@/server/logger";
import {
	checkOpencodeReady,
	checkPreviewReady,
} from "@/server/projects/health";
import { DockerError } from "./errors";
import type { ContainerStatus } from "./layers";
import { DockerService } from "./layers";

const toDockerError = (error: unknown, context?: Record<string, unknown>) =>
	new DockerError({
		message: error instanceof Error ? error.message : String(error),
		cause: error,
		...context,
	});

const mapContainerStatus = (
	status: DockerContainerStatus,
): ContainerStatus => ({
	name: status.name,
	service: status.service,
	state: status.state,
	...(status.health ? { health: status.health } : {}),
});

const waitForContainersHealthy = (
	projectId: string,
	_timeoutMs: number,
): Effect.Effect<boolean, never, never> =>
	Effect.gen(function* () {
		const startTime = Date.now();
		const timeoutMs = _timeoutMs;

		while (Date.now() - startTime < timeoutMs) {
			const result = yield* Effect.tryPromise({
				try: () =>
					Promise.all([checkPreviewReady(projectId), checkOpencodeReady()]),
				catch: () => null,
			}).pipe(Effect.orElse(() => Effect.succeed([false, false] as const)));

			const [previewReady, opencodeReady] = result;

			if (previewReady && opencodeReady) {
				return true;
			}

			yield* Effect.sleep(1000);
		}

		return false;
	});

export const DockerServiceLive = Layer.succeed(
	DockerService,
	DockerService.of({
		composeUp: (projectId, projectPath, preserveProduction) =>
			Effect.tryPromise({
				try: () => composeUp(projectId, projectPath, preserveProduction),
				catch: (e) => toDockerError(e, { projectId }),
			}).pipe(
				Effect.tap((result) =>
					Effect.sync(() =>
						logger.debug(
							{ projectId, exitCode: result.exitCode },
							"composeUp completed",
						),
					),
				),
			),

		composeStart: (projectId, projectPath) =>
			Effect.tryPromise({
				try: () => composeStart(projectId, projectPath),
				catch: (e) => toDockerError(e, { projectId }),
			}),

		composeStop: (projectId, projectPath) =>
			Effect.tryPromise({
				try: () => composeStop(projectId, projectPath),
				catch: (e) => toDockerError(e, { projectId }),
			}),

		composeDown: (projectId, projectPath) =>
			Effect.tryPromise({
				try: () => composeDown(projectId, projectPath),
				catch: (e) => toDockerError(e, { projectId }),
			}),

		composeDownWithVolumes: (projectId, projectPath) =>
			Effect.tryPromise({
				try: () => composeDownWithVolumes(projectId, projectPath),
				catch: (e) => toDockerError(e, { projectId }),
			}),

		composePs: (projectId, projectPath) =>
			Effect.gen(function* () {
				const result = yield* Effect.tryPromise({
					try: () => composePs(projectId, projectPath),
					catch: (e) => toDockerError(e, { projectId }),
				});

				if (!result.success) {
					return [];
				}

				return parseComposePs(result.stdout).map(mapContainerStatus);
			}),

		composeUpProduction: (
			projectId,
			productionPath,
			productionPort,
			productionHash,
		) =>
			Effect.tryPromise({
				try: () =>
					composeUpProduction(
						projectId,
						productionPath,
						productionPort,
						productionHash,
					),
				catch: (e) => toDockerError(e, { projectId }),
			}),

		composeDownProduction: (projectId, productionPath, productionHash) =>
			Effect.tryPromise({
				try: () =>
					composeDownProduction(projectId, productionPath, productionHash),
				catch: (e) => toDockerError(e, { projectId }),
			}),

		ensureDoceSharedNetwork: () =>
			Effect.tryPromise({
				try: ensureDoceSharedNetwork,
				catch: (e) => toDockerError(e),
			}).pipe(Effect.orElse(() => Effect.succeed(undefined))),

		ensureProjectDataVolume: (projectId) =>
			Effect.tryPromise({
				try: () => ensureProjectDataVolume(projectId),
				catch: (e) => toDockerError(e, { projectId }),
			}).pipe(Effect.orElse(() => Effect.succeed(undefined))),

		ensureOpencodeStorageVolume: () => Effect.succeed(undefined),

		streamContainerLogs: (projectId, projectPath) =>
			Effect.sync(() => {
				streamContainerLogs({
					kind: "preview",
					projectId,
					projectPath,
				});
			}),

		stopStreamingContainerLogs: (projectId) =>
			Effect.sync(() => {
				stopStreamingContainerLogs({
					kind: "preview",
					projectId,
					projectPath: "",
				});
			}),

		waitForHealthy: (projectId, _projectPath, timeoutMs) =>
			waitForContainersHealthy(projectId, timeoutMs),
	}),
);
