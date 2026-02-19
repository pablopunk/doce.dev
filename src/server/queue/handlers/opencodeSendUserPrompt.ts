import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Effect } from "effect";
import { FALLBACK_MODEL } from "@/server/config/models";
import { OpenCodeError, ProjectError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import { normalizeProjectPath } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	loadOpencodeConfig,
	markInitialPromptSent,
	parseModelString,
	updateUserPromptMessageId,
} from "@/server/projects/projects.model";
import { type ImageAttachment, parsePayload } from "../types";

export function handleOpencodeSendUserPrompt(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError | OpenCodeError> {
	return Effect.gen(function* () {
		const payload = parsePayload(
			"opencode.sendUserPrompt",
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
				"Project not found for opencode.sendUserPrompt",
			);
			return;
		}

		if (project.status === "deleting") {
			logger.info(
				{ projectId: project.id },
				"Skipping opencode.sendUserPrompt for deleting project",
			);
			return;
		}

		if (project.initialPromptSent) {
			logger.info(
				{ projectId: project.id },
				"User prompt already sent, skipping",
			);
			return;
		}

		logger.info(
			{ projectId: project.id },
			"opencode.sendUserPrompt handler started",
		);

		const sessionId = project.bootstrapSessionId;
		if (!sessionId) {
			return yield* new OpenCodeError({
				projectId: project.id,
				operation: "sendUserPrompt",
				message: "No bootstrap session ID found - session not created?",
			});
		}

		logger.info(
			{ projectId: project.id, sessionId },
			"Bootstrap session ID found, proceeding with prompt send",
		);

		yield* ctx.throwIfCancelRequested();

		const normalizedProjectPath = normalizeProjectPath(project.pathOnDisk);
		const imagesPath = path.join(normalizedProjectPath, ".doce-images.json");
		let images: ImageAttachment[] = [];

		const imagesContent = yield* Effect.tryPromise({
			try: () => fs.readFile(imagesPath, "utf-8"),
			catch: () => null,
		});

		if (imagesContent) {
			images = yield* Effect.tryPromise({
				try: () =>
					Promise.resolve(JSON.parse(imagesContent) as ImageAttachment[]),
				catch: () => [],
			});
			yield* Effect.tryPromise({
				try: () => fs.unlink(imagesPath).catch(() => Promise.resolve()),
				catch: () => null,
			});
			logger.debug(
				{ projectId: project.id, imageCount: images.length },
				"Loaded images for initial prompt",
			);
		}

		const parts: Array<
			| { type: "text"; text: string }
			| { type: "file"; mime: string; url: string; filename?: string }
		> = [{ type: "text", text: project.prompt }];

		for (const img of images) {
			parts.push({
				type: "file",
				mime: img.mime,
				url: img.dataUrl,
				filename: img.filename,
			});
		}

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

		const modelString = config?.model || FALLBACK_MODEL;
		const modelInfo = parseModelString(modelString);
		if (!modelInfo) {
			return yield* new OpenCodeError({
				projectId: project.id,
				operation: "parseModelString",
				message: `Invalid model string: ${modelString}`,
			});
		}

		const client = createOpencodeClient(project.id, project.opencodePort);

		const promptResponse = yield* Effect.tryPromise({
			try: () =>
				client.session.promptAsync({
					sessionID: sessionId,
					model: {
						providerID: modelInfo.providerID,
						modelID: modelInfo.modelID,
					},
					parts,
				}),
			catch: (error) =>
				new OpenCodeError({
					projectId: project.id,
					operation: "promptAsync",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		if (!promptResponse) {
			return yield* new OpenCodeError({
				projectId: project.id,
				operation: "promptAsync",
				message: "No response received from promptAsync",
			});
		}

		logger.info(
			{ projectId: project.id, sessionId, modelInfo },
			"Sent user prompt with model",
		);

		yield* ctx.throwIfCancelRequested();
		yield* Effect.sleep(1000);

		let messages: Array<{
			info?: { id?: string; role?: string };
			parts?: Array<{ type?: string; text?: string }>;
		}> = [];

		const messagesResponse = yield* Effect.tryPromise({
			try: () => client.session.messages({ sessionID: sessionId }),
			catch: (error) => {
				logger.warn(
					{
						projectId: project.id,
						sessionId,
						error: error instanceof Error ? error.message : String(error),
					},
					"Failed to fetch messages after prompt",
				);
				return null;
			},
		});

		if (messagesResponse) {
			logger.info(
				{
					projectId: project.id,
					sessionId,
					responseData: JSON.stringify(messagesResponse),
				},
				"Messages response received",
			);

			if (!messagesResponse.data) {
				logger.warn(
					{ projectId: project.id, sessionId },
					"No messages data in response",
				);
			} else if (!Array.isArray(messagesResponse.data)) {
				logger.warn(
					{
						projectId: project.id,
						sessionId,
						dataType: typeof messagesResponse.data,
					},
					"Messages response is not an array",
				);
			} else {
				messages = messagesResponse.data as Array<{
					info?: { id?: string; role?: string };
					parts?: Array<{ type?: string; text?: string }>;
				}>;
				logger.debug(
					{
						projectId: project.id,
						sessionId,
						messageCount: messages.length,
					},
					"Messages fetched successfully",
				);
			}
		}

		let userMsgId: string | undefined;

		logger.info(
			{
				projectId: project.id,
				totalMessages: messages.length,
				promptLength: project.prompt.length,
			},
			"Starting message search",
		);

		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg?.info?.role === "user" && msg?.info?.id) {
				const msgText =
					msg.parts
						?.filter((p) => p.type === "text")
						.map((p) => p.text || "")
						.join("")
						.toLowerCase() || "";

				const promptText = project.prompt.toLowerCase();

				logger.debug(
					{
						projectId: project.id,
						messageIndex: i,
						msgId: msg.info.id,
						msgTextLength: msgText.length,
						promptTextLength: promptText.length,
						firstCharsMatch: msgText.startsWith(
							promptText.slice(0, Math.min(30, promptText.length)),
						),
					},
					"Checking message for match",
				);

				if (
					msgText.includes(promptText.slice(0, Math.min(30, promptText.length)))
				) {
					userMsgId = msg.info.id;
					logger.debug(
						{ projectId: project.id, msgId: msg.info.id },
						"Found user message matching prompt text",
					);
					break;
				}
			}
		}

		if (!userMsgId) {
			logger.debug(
				{ projectId: project.id },
				"No text match found, looking for fallback",
			);
			for (let i = messages.length - 1; i >= 0; i--) {
				const msg = messages[i];
				if (msg?.info?.role === "user" && msg?.info?.id) {
					userMsgId = msg.info.id;
					logger.warn(
						{ projectId: project.id, msgId: msg.info.id, fallback: true },
						"Using last user message as fallback (no text match)",
					);
					break;
				}
			}
		}

		if (userMsgId) {
			yield* Effect.tryPromise({
				try: () => updateUserPromptMessageId(project.id, userMsgId),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "updateUserPromptMessageId",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
			logger.info(
				{ projectId: project.id, userMsgId },
				"Stored user prompt message ID",
			);
		} else {
			logger.warn(
				{ projectId: project.id, messageCount: messages.length },
				"Could not find user message after sending prompt",
			);
		}

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

		logger.info(
			{ projectId: project.id },
			"Marked initial prompt as sent in database",
		);

		logger.info(
			{ projectId: project.id },
			"opencode.sendUserPrompt handler completed successfully",
		);
	}).pipe(
		Effect.tapError((error) =>
			Effect.sync(() => {
				logger.error(
					{
						error: error.message,
						cause: error.cause,
					},
					"opencode.sendUserPrompt handler failed",
				);
			}),
		),
	);
}
