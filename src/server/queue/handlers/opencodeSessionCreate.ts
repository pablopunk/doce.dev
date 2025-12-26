import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import {
	getProjectByIdIncludeDeleted,
	updateBootstrapSessionId,
} from "@/server/projects/projects.model";
import { enqueueOpencodeSessionInit } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

export async function handleOpencodeSessionCreate(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("opencode.sessionCreate", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
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

	// If already has a session, skip (idempotent)
	if (project.bootstrapSessionId) {
		logger.info(
			{ projectId: project.id },
			"Session already created, skipping session create",
		);
		return;
	}

	try {
		await ctx.throwIfCancelRequested();

		// Create opencode client (v2 SDK)
		const client = createOpencodeClient(project.opencodePort);

		// Create a new session
		const sessionResponse = await client.session.create();
		const sessionData = sessionResponse.data as { id?: string } | undefined;
		const sessionId = sessionData?.id;

		if (!sessionId) {
			throw new Error("Failed to create session: no session ID returned");
		}

		logger.info(
			{ projectId: project.id, sessionId },
			"Created opencode session",
		);

		// Store the session ID in the project
		await updateBootstrapSessionId(project.id, sessionId);

		await ctx.throwIfCancelRequested();

		// Enqueue next step: initialize session with agent
		await enqueueOpencodeSessionInit({ projectId: project.id });
		logger.debug({ projectId: project.id }, "Enqueued opencode.sessionInit");
	} catch (error) {
		throw error;
	}
}
