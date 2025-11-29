import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { Conversation } from "@/domain/conversations/models/conversation";
import { Session } from "@/domain/sessions/models/session";

export const server = {
	getOrCreate: defineAction({
		input: z.object({
			projectId: z.string(),
			model: z.string().optional(),
		}),
		handler: async ({ projectId, model }) => {
			try {
				const session = await Session.getOrCreateForProject(projectId, model);
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
				const session = await Session.getOrCreateForProject(projectId, model);

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
