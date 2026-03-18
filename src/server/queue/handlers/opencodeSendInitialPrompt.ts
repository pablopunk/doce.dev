import { Effect } from "effect";
import { OpenCodeError, ProjectError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import { getProjectPreviewPathFromRoot } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	markInitialPromptSent,
} from "@/server/projects/projects.model";
import { parsePayload } from "../types";

export function handleOpencodeSendInitialPrompt(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError | OpenCodeError> {
	return Effect.gen(function* () {
		const payload = parsePayload(
			"opencode.sendInitialPrompt",
			ctx.job.payloadJson,
		);

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
				"Project not found for opencode.sendInitialPrompt",
			);
			return;
		}

		if (project.status === "deleting") {
			logger.info(
				{ projectId: project.id },
				"Skipping opencode.sendInitialPrompt for deleting project",
			);
			return;
		}

		// If already sent, skip
		if (project.initialPromptSent) {
			logger.info(
				{ projectId: project.id },
				"Initial prompt already sent, skipping",
			);
			return;
		}

		const sessionId = project.bootstrapSessionId;
		if (!sessionId) {
			return yield* new OpenCodeError({
				projectId: project.id,
				operation: "sendInitialPrompt",
				message: "No bootstrap session ID found - session not created?",
			});
		}

		yield* ctx.throwIfCancelRequested();

		const client = createOpencodeClient(
			getProjectPreviewPathFromRoot(project.pathOnDisk),
		);
		const projectDirectory = getProjectPreviewPathFromRoot(project.pathOnDisk);

		yield* Effect.tryPromise({
			try: () =>
				client.session.promptAsync({
					directory: projectDirectory,
					sessionID: sessionId,
					parts: [{ type: "text", text: project.prompt }],
				}),
			catch: (error) =>
				new OpenCodeError({
					projectId: project.id,
					operation: "promptAsync",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		logger.info({ projectId: project.id, sessionId }, "Sent initial prompt");

		yield* Effect.tryPromise({
			try: () => markInitialPromptSent(project.id),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "markInitialPromptSent",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		yield* ctx.throwIfCancelRequested();

		logger.debug(
			{ projectId: project.id },
			"Initial prompt sent, completion will be detected by presence system",
		);
	});
}
