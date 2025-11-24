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
				console.error("Failed to get/create session:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get/create session",
				});
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
				const conversation = Conversation.getByProjectId(projectId);

				if (!conversation) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Conversation not found",
					});
				}

				await Session.sendPrompt(session.id, message, model, conversation.id);
				return { success: true };
			} catch (error) {
				console.error("Failed to send message:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to send message",
				});
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

				await Session.abortSession(conversation.opencodeSessionId);
				return { success: true };
			} catch (error) {
				console.error("Failed to abort session:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to abort session",
				});
			}
		},
	}),
};
