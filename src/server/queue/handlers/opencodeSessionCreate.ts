import { Effect } from "effect";
import { FALLBACK_MODEL } from "@/server/config/models";
import { OpenCodeSessionError, ProjectError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import {
	getProjectByIdIncludeDeleted,
	loadOpencodeConfig,
	parseModelString,
	resetPromptStateForSessionRecovery,
	updateBootstrapSessionId,
} from "@/server/projects/projects.model";
import { isRunningInDocker } from "@/server/utils/docker";
import { enqueueOpencodeSendUserPrompt } from "../enqueue";
import { parsePayload } from "../types";

export function handleOpencodeSessionCreate(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError | OpenCodeSessionError> {
	return Effect.gen(function* () {
		const payload = parsePayload("opencode.sessionCreate", ctx.job.payloadJson);

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
				"Project not found for opencode.sessionCreate",
			);
			return;
		}

		if (project.status === "deleting") {
			logger.info(
				{ projectId: project.id },
				"Skipping opencode.sessionCreate for deleting project",
			);
			return;
		}

		let isSessionRecovery = false;

		if (project.bootstrapSessionId) {
			const baseUrl = isRunningInDocker()
				? `http://doce_${project.id}-opencode-1:3000`
				: `http://localhost:${project.opencodePort}`;

			const hasExistingSession = yield* Effect.tryPromise({
				try: async () => {
					const response = await fetch(`${baseUrl}/session`);
					if (!response.ok) return false;

					const sessions = (await response.json()) as unknown;
					if (!Array.isArray(sessions)) return false;

					return sessions.some((entry) => {
						if (typeof entry === "string") {
							return entry === project.bootstrapSessionId;
						}
						if (typeof entry === "object" && entry !== null && "id" in entry) {
							const sessionId = (entry as { id?: unknown }).id;
							return (
								typeof sessionId === "string" &&
								sessionId === project.bootstrapSessionId
							);
						}
						return false;
					});
				},
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "validateBootstrapSession",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});

			if (hasExistingSession) {
				logger.info(
					{ projectId: project.id, sessionId: project.bootstrapSessionId },
					"Bootstrap session exists, skipping session create",
				);
				return;
			}

			isSessionRecovery = true;
			logger.warn(
				{ projectId: project.id, sessionId: project.bootstrapSessionId },
				"Stored bootstrap session missing in runtime, recreating and reseeding",
			);

			yield* Effect.tryPromise({
				try: () => resetPromptStateForSessionRecovery(project.id),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "resetPromptStateForSessionRecovery",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
		}

		logger.info(
			{ projectId: project.id },
			"opencode.sessionCreate handler started",
		);

		yield* ctx.throwIfCancelRequested();

		const config = yield* Effect.tryPromise({
			try: () => loadOpencodeConfig(project.id),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "loadOpencodeConfig",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		let modelInfo = {
			providerID: "openrouter",
			modelID: FALLBACK_MODEL.split("/").slice(1).join("/"),
		};

		if (config?.model) {
			const modelStr = config.model;
			const parsed = parseModelString(modelStr);
			if (parsed) {
				modelInfo = parsed;
				logger.info(
					{ projectId: project.id, model: modelStr },
					"Loaded model from opencode.json",
				);
			}
		}

		logger.info(
			{ projectId: project.id, opencodePort: project.opencodePort },
			"Creating OpenCode client for container communication",
		);
		const client = createOpencodeClient(project.id, project.opencodePort);

		logger.info({ projectId: project.id }, "Calling client.session.create()");
		const result = yield* Effect.tryPromise({
			try: () => client.session.create(),
			catch: (error) =>
				new OpenCodeSessionError({
					projectId: project.id,
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.info(
			{
				projectId: project.id,
				hasData: !!result.data,
				hasError: !!result.error,
			},
			"Received session creation response",
		);

		if (result.error) {
			return yield* new OpenCodeSessionError({
				projectId: project.id,
				message: `Session creation failed: ${String(result.error)}`,
			});
		}

		if (!result.data || typeof result.data !== "object") {
			return yield* new OpenCodeSessionError({
				projectId: project.id,
				message: "Invalid session response structure",
			});
		}

		const sessionId = result.data.id;

		if (!sessionId || typeof sessionId !== "string") {
			return yield* new OpenCodeSessionError({
				projectId: project.id,
				message: "Session response missing or invalid id field",
			});
		}

		logger.info(
			{ projectId: project.id, sessionId, model: modelInfo },
			"Created opencode session successfully",
		);

		yield* Effect.tryPromise({
			try: () => updateBootstrapSessionId(project.id, sessionId),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "updateBootstrapSessionId",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.info(
			{ projectId: project.id, sessionId },
			"Updated bootstrap session ID in database",
		);

		yield* ctx.throwIfCancelRequested();

		yield* Effect.tryPromise({
			try: () => enqueueOpencodeSendUserPrompt({ projectId: project.id }),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "enqueueOpencodeSendUserPrompt",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.info(
			{ projectId: project.id, isSessionRecovery },
			"Enqueued opencode.sendUserPrompt job",
		);
	}).pipe(
		Effect.tapError((error) =>
			Effect.sync(() => {
				logger.error(
					{
						error: error.message,
						cause: error.cause,
					},
					"opencode.sessionCreate handler failed",
				);
			}),
		),
	);
}
