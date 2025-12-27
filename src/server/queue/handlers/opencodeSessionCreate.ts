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
		await storeProjectModel(project.id, modelInfo);
		logger.debug(
			{ projectId: project.id, modelInfo },
			"Stored initial model configuration",
		);

		await ctx.throwIfCancelRequested();

		// Initialize the session in the background (fire-and-forget)
		// This sets up the OpenCode environment to process prompts
		// We don't wait for it to complete - it can run in parallel with the user prompt

		// Fire-and-forget with proper error handling
		void initializeSessionWithRetry(
			client,
			sessionId,
			modelInfo,
			project.id,
		).catch((error: unknown) => {
			logger.error(
				{
					projectId: project.id,
					sessionId,
					error: error instanceof Error ? error.message : String(error),
				},
				"Session initialization failed after retries",
			);
			// Non-fatal: session.init failure doesn't block user prompts
		});

		// Enqueue next step: send user prompt
		// This will run while session.init() is still processing in the background
		await enqueueOpencodeSendUserPrompt({ projectId: project.id });
		logger.debug({ projectId: project.id }, "Enqueued opencode.sendUserPrompt");
	} catch (error) {
		throw error;
	}
}

/**
 * Initialize a session with exponential backoff retry on failure.
 * Errors are logged but don't block the user prompt from being sent.
 */
async function initializeSessionWithRetry(
	client: ReturnType<typeof createOpencodeClient>,
	sessionId: string,
	modelInfo: { providerID: string; modelID: string },
	projectId: string,
	attemptNumber = 1,
	maxAttempts = 3,
): Promise<void> {
	try {
		await client.session.init({
			sessionID: sessionId,
			providerID: modelInfo.providerID,
			modelID: modelInfo.modelID,
			messageID: `msg_init_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		});

		logger.debug(
			{ projectId, sessionId, attempt: attemptNumber },
			"Session initialization completed",
		);
	} catch (error) {
		if (attemptNumber < maxAttempts) {
			const delayMs = Math.min(10000, 1000 * 2 ** (attemptNumber - 1));
			logger.warn(
				{
					projectId,
					sessionId,
					attempt: attemptNumber,
					maxAttempts,
					nextRetryMs: delayMs,
					error: error instanceof Error ? error.message : String(error),
				},
				"Session initialization failed, retrying",
			);

			await new Promise((resolve) => setTimeout(resolve, delayMs));
			return initializeSessionWithRetry(
				client,
				sessionId,
				modelInfo,
				projectId,
				attemptNumber + 1,
				maxAttempts,
			);
		}

		// Max attempts exceeded
		throw error;
	}
}
