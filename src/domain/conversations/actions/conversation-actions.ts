import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import {
	Conversation,
	type ConversationModel,
} from "@/domain/conversations/models/conversation";

export const server = {
	/**
	 * Get chat history for a project
	 */
	getHistory: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async ({ projectId }) => {
			try {
				const history = Conversation.getHistory(projectId);
				return history;
			} catch (error) {
				console.error("Failed to get chat history:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get chat history",
				});
			}
		},
	}),

	/**
	 * Delete a message and all messages after it
	 */
	deleteMessage: defineAction({
		input: z.object({
			projectId: z.string(),
			messageId: z.string(),
		}),
		handler: async ({ projectId, messageId }) => {
			try {
				Conversation.deleteMessage(projectId, messageId);
				return { success: true };
			} catch (error) {
				if (error instanceof Error) {
					if (error.message === "Conversation not found") {
						throw new ActionError({
							code: "NOT_FOUND",
							message: "Conversation not found",
						});
					}
					if (error.message === "Message not found") {
						throw new ActionError({
							code: "NOT_FOUND",
							message: "Message not found",
						});
					}
				}

				console.error("Failed to delete message:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete message",
				});
			}
		},
	}),
};
