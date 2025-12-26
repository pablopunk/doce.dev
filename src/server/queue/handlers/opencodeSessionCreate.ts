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
			modelID: "google/gemini-2.5-flash",
		};

		if (config?.model) {
			const parsed = parseModelString(config.model);
			if (parsed) {
				modelInfo = parsed;
				logger.debug(
					{ projectId: project.id, model: config.model },
					"Loaded model from opencode.json",
				);
			}
		}

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
			{ projectId: project.id, sessionId, model: modelInfo },
			"Created opencode session",
		);

		// Store the session ID in the project
		await updateBootstrapSessionId(project.id, sessionId);

		// Store the initial model configuration
		await storeProjectModel(project.id, modelInfo);
		logger.debug(
			{ projectId: project.id, modelInfo },
			"Stored initial model configuration",
		);

		await ctx.throwIfCancelRequested();

		// Initialize the session in the background (fire-and-forget)
		// This sets up the OpenCode environment to process prompts
		// We don't wait for it to complete - it can run in parallel with the user prompt
		const initMessageId = `msg_init_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		// Fire and forget - don't await
		void (
			client.session.init({
				sessionID: sessionId,
				model: {
					providerID: modelInfo.providerID,
					modelID: modelInfo.modelID,
				},
				messageID: initMessageId,
			}) as Promise<unknown>
		)
			.then(() => {
				logger.debug(
					{ projectId: project.id, sessionId },
					"Session initialization completed",
				);
			})
			.catch((error: unknown) => {
				logger.warn(
					{ projectId: project.id, sessionId, error: String(error) },
					"Session initialization failed (non-fatal)",
				);
			});

		// Enqueue next step: send user prompt
		// This will run while session.init() is still processing in the background
		await enqueueOpencodeSendUserPrompt({ projectId: project.id });
		logger.debug({ projectId: project.id }, "Enqueued opencode.sendUserPrompt");
	} catch (error) {
		throw error;
	}
}
