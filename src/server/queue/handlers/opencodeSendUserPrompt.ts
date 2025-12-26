import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import {
	getProjectByIdIncludeDeleted,
	markInitialPromptSent,
	updateUserPromptMessageId,
} from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { type ImageAttachment, parsePayload } from "../types";

/**
 * Handler for sending the user's actual project prompt.
 * This is called after session.init completes (which triggers AGENTS.md generation).
 *
 * Flow:
 * 1. Send the user's prompt via prompt_async
 * 2. Wait briefly for the message to be created
 * 3. Fetch messages and capture the user prompt message ID
 * 4. Mark the initial prompt as sent
 */
export async function handleOpencodeSendUserPrompt(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("opencode.sendUserPrompt", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
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

	// If already sent, skip
	if (project.initialPromptSent) {
		logger.info(
			{ projectId: project.id },
			"User prompt already sent, skipping",
		);
		return;
	}

	try {
		const sessionId = project.bootstrapSessionId;
		if (!sessionId) {
			throw new Error("No bootstrap session ID found - session not created?");
		}

		await ctx.throwIfCancelRequested();

		// Read images from temp file if it exists
		const imagesPath = path.join(
			process.cwd(),
			project.pathOnDisk,
			".doce-images.json",
		);
		let images: ImageAttachment[] = [];
		try {
			const imagesContent = await fs.readFile(imagesPath, "utf-8");
			images = JSON.parse(imagesContent);
			// Delete the temp file after reading
			await fs.unlink(imagesPath).catch(() => {});
			logger.debug(
				{ projectId: project.id, imageCount: images.length },
				"Loaded images for initial prompt",
			);
		} catch {
			// No images file - that's fine
		}

		// Build parts array: text first, then images as file parts (OpenCode pattern)
		const parts: Array<
			| { type: "text"; text: string }
			| { type: "file"; mime: string; url: string; filename?: string }
		> = [{ type: "text", text: project.prompt }];

		// Add images as file parts
		for (const img of images) {
			parts.push({
				type: "file",
				mime: img.mime,
				url: img.dataUrl,
				filename: img.filename,
			});
		}

		// Create SDK client for this project
		const client = createOpencodeClient(project.opencodePort);

		// Send the user's prompt via SDK (prompt_async)
		await client.session.promptAsync({
			sessionID: sessionId,
			parts,
		});

		logger.info({ projectId: project.id, sessionId }, "Sent user prompt");

		await ctx.throwIfCancelRequested();

		// Wait a moment for the message to be created, then capture its ID
		// Use a longer delay to ensure the user message is created before we fetch
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Fetch messages via SDK
		const messagesResponse = await client.session.messages({
			sessionID: sessionId,
		});
		const messagesData = messagesResponse.data as
			| Array<{
					info?: { id?: string; role?: string };
					parts?: Array<{ type?: string; text?: string }>;
			  }>
			| undefined;
		const messages = messagesData ?? [];

		// We need to find the user message with the project prompt
		// Since prompt_async is async, the message might not exist yet or might be the last one
		// Strategy: look for a user message that matches the project prompt text

		let userMsgId: string | undefined;

		// First pass: find user message with matching text
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg?.info?.role === "user" && msg.info.id) {
				// Check all parts for text content
				const msgText =
					msg.parts
						?.filter((p) => p.type === "text")
						.map((p) => p.text || "")
						.join("")
						.toLowerCase() || "";

				const promptText = project.prompt.toLowerCase();

				// Check if message contains at least the first 30 characters of prompt
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

		// If no match found, use the last user message (fallback)
		if (!userMsgId) {
			for (let i = messages.length - 1; i >= 0; i--) {
				const msg = messages[i];
				if (msg?.info?.role === "user" && msg.info.id) {
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
			await updateUserPromptMessageId(project.id, userMsgId);
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

		// Mark initial prompt as sent (legacy flag for backward compatibility)
		await markInitialPromptSent(project.id);

		logger.debug(
			{ projectId: project.id },
			"User prompt sent, completion will be detected by event handler",
		);
	} catch (error) {
		throw error;
	}
}
