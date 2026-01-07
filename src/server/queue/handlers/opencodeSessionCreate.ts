import * as path from "node:path";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import {
	getProjectByIdIncludeDeleted,
	loadOpencodeConfig,
	parseModelString,
	storeProjectModel,
	updateBootstrapSessionId,
} from "@/server/projects/projects.model";
import { enqueueOpencodeSendUserPrompt } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { FALLBACK_MODEL } from "@/server/config/models";

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

		// Load model configuration from opencode.json
		const projectPath = path.join(process.cwd(), project.pathOnDisk);
		const config = await loadOpencodeConfig(projectPath);
		let modelInfo = {
			providerID: "openrouter",
			modelID: FALLBACK_MODEL.split("/").slice(1).join("/"),
		};

		if (config?.model) {
			const modelStr = config.model; // e.g., "openrouter/google/gemini-3-flash"
			const parsed = parseModelString(modelStr);
			if (parsed) {
				modelInfo = parsed;
				logger.debug(
					{ projectId: project.id, model: modelStr },
					"Loaded model from opencode.json",
				);
			}
		}

		// Create opencode client (v2 SDK)
		const client = createOpencodeClient(project.opencodePort);

		// Create a new session
		let sessionId: string;
		try {
			const sessionResponse = await client.session.create();

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
				},
				"Failed to create OpenCode session",
			);
			throw error;
		}

		logger.info(
			{ projectId: project.id, sessionId, model: modelInfo },
			"Created opencode session",
		);

		// Store the session ID in the project
		await updateBootstrapSessionId(project.id, sessionId);

		// Store the initial model configuration
		await storeProjectModel(project.id, config?.model || FALLBACK_MODEL);
		logger.debug(
			{
				projectId: project.id,
				model: config?.model || FALLBACK_MODEL,
			},
			"Stored initial model configuration",
		);

		await ctx.throwIfCancelRequested();

		// Enqueue next step: send user prompt
		await enqueueOpencodeSendUserPrompt({ projectId: project.id });
		logger.debug({ projectId: project.id }, "Enqueued opencode.sendUserPrompt");
	} catch (error) {
		throw error;
	}
}
