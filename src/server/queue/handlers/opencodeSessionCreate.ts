import { FALLBACK_MODEL } from "@/server/config/models";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import {
	getProjectByIdIncludeDeleted,
	loadOpencodeConfig,
	parseModelString,
	updateBootstrapSessionId,
} from "@/server/projects/projects.model";
import { enqueueOpencodeSendUserPrompt } from "../enqueue";
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
		logger.info(
			{ projectId: project.id },
			"opencode.sessionCreate handler started",
		);

		await ctx.throwIfCancelRequested();

		const config = await loadOpencodeConfig(project.id);
		let modelInfo = {
			providerID: "openrouter",
			modelID: FALLBACK_MODEL.split("/").slice(1).join("/"),
		};

		if (config?.model) {
			const modelStr = config.model; // e.g., "openrouter/google/gemini-3-flash"
			const parsed = parseModelString(modelStr);
			if (parsed) {
				modelInfo = parsed;
				logger.info(
					{ projectId: project.id, model: modelStr },
					"Loaded model from opencode.json",
				);
			}
		}

		// Create opencode client (v2 SDK)
		// Pass projectId and opencodePort to connect via container hostname (Docker) or localhost (dev)
		logger.info(
			{ projectId: project.id, opencodePort: project.opencodePort },
			"Creating OpenCode client for container communication",
		);
		const client = createOpencodeClient(project.id, project.opencodePort);

		// Create a new session
		let sessionId: string;
		try {
			logger.info({ projectId: project.id }, "Calling client.session.create()");
			const sessionResponse = await client.session.create();

			logger.info(
				{
					projectId: project.id,
					responseOk: sessionResponse.response?.ok,
					hasData: !!sessionResponse.data,
				},
				"Received session creation response",
			);

			// Type-safe extraction of session ID
			if (!sessionResponse.data || typeof sessionResponse.data !== "object") {
				throw new Error("Invalid session response structure");
			}

			const responseData = sessionResponse.data as Record<string, unknown>;
			sessionId = responseData.id as string;

			if (!sessionId || typeof sessionId !== "string") {
				throw new Error("Session response missing or invalid id field");
			}
		} catch (error) {
			logger.error(
				{
					projectId: project.id,
					error: error instanceof Error ? error.message : String(error),
					errorStack: error instanceof Error ? error.stack : undefined,
				},
				"Failed to create OpenCode session",
			);
			throw error;
		}

		logger.info(
			{ projectId: project.id, sessionId, model: modelInfo },
			"Created opencode session successfully",
		);

		// Store the session ID in the project
		await updateBootstrapSessionId(project.id, sessionId);
		logger.info(
			{ projectId: project.id, sessionId },
			"Updated bootstrap session ID in database",
		);

		await ctx.throwIfCancelRequested();

		// Enqueue next step: send user prompt
		await enqueueOpencodeSendUserPrompt({ projectId: project.id });
		logger.info(
			{ projectId: project.id },
			"Enqueued opencode.sendUserPrompt job",
		);
	} catch (error) {
		logger.error(
			{
				projectId: project.id,
				error: error instanceof Error ? error.message : String(error),
				errorStack: error instanceof Error ? error.stack : undefined,
			},
			"opencode.sessionCreate handler failed",
		);
		throw error;
	}
}
