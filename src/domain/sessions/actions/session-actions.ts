import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { Conversation } from "@/domain/conversations/models/conversation";
import { Session } from "@/domain/sessions/models/session";
import { createLogger } from "@/lib/logger";

const logger = createLogger("session-actions");

// Helper to check if error is retryable (server not ready)
function isRetryableError(error: unknown): boolean {
	const message = error instanceof Error ? error.message.toLowerCase() : "";
	return (
		message.includes("fetch failed") ||
		message.includes("econnrefused") ||
		message.includes("socket") ||
		message.includes("preview is not running")
	);
}

// Retry wrapper for session operations
async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries = 5,
	delayMs = 2000,
): Promise<T> {
	let lastError: unknown;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;

			if (!isRetryableError(error) || attempt === maxRetries) {
				throw error;
			}

			logger.info(
				`OpenCode not ready, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})`,
			);
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}

	throw lastError;
}

export const server = {
	getOrCreate: defineAction({
		input: z.object({
			projectId: z.string(),
			model: z.string().optional(),
		}),
		handler: async ({ projectId, model }) => {
			try {
				const session = await withRetry(() =>
					Session.getOrCreateForProject(projectId, model),
				);
				return { sessionId: session.id };
			} catch (error) {
				handleSessionError(error);
			}
		},
	}),

	sendMessage: defineAction({
		input: z.object({
			projectId: z.string(),
			message: z.string(),
			model: z.string(),
		}),
		handler: async ({ projectId, message, model }) => {
			try {
				const session = await withRetry(() =>
					Session.getOrCreateForProject(projectId, model),
				);

				await Session.sendPrompt(projectId, session.id, message, model);
				return { success: true };
			} catch (error) {
				handleSessionError(error);
			}
		},
	}),

	abort: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async ({ projectId }) => {
			try {
				const conversation = Conversation.getByProjectId(projectId);

				if (!conversation?.opencodeSessionId) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Session not found",
					});
				}

				await Session.abortSession(projectId, conversation.opencodeSessionId);
				return { success: true };
			} catch (error) {
				handleSessionError(error);
			}
		},
	}),

	getStatus: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async ({ projectId }) => {
			try {
				const conversation = Conversation.getByProjectId(projectId);

				if (!conversation?.opencodeSessionId) {
					// No session yet - return unknown
					return { status: "unknown" };
				}

				const status = await Session.getStatus(
					projectId,
					conversation.opencodeSessionId,
				);
				return status;
			} catch (error) {
				// If we can't get status, return unknown rather than throwing
				logger.warn("Failed to get session status", {
					error: error instanceof Error ? error.message : String(error),
				});
				return { status: "unknown" };
			}
		},
	}),
};

function handleSessionError(error: unknown): never {
	const message =
		error instanceof Error
			? error.message
			: "Failed to communicate with OpenCode";

	if (message.toLowerCase().includes("preview is not running")) {
		throw new ActionError({
			code: "BAD_REQUEST",
			message: "Preview is not running. Start the preview to chat.",
		});
	}

	console.error("Session error:", error);
	throw new ActionError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Failed to communicate with OpenCode",
	});
}
