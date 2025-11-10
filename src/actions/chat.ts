import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import {
	deleteMessagesFromIndex,
	getConversation,
	getMessages,
} from "@/lib/db";
import { DEFAULT_AI_MODEL } from "@/shared/config/ai-models";

export const server = {
	// GET /api/chat/[projectId]/history
	getHistory: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async ({ projectId }) => {
			try {
				const conversation = await getConversation(projectId);
				if (!conversation) {
					return { messages: [], model: DEFAULT_AI_MODEL };
				}

				const messages = await getMessages(conversation.id);

				// Format messages for the chat interface
				const formattedMessages = messages.map((msg: any) => ({
					id: msg.id,
					role: msg.role,
					content: msg.content,
				}));

				return {
					messages: formattedMessages,
					model: conversation.model || DEFAULT_AI_MODEL,
				};
			} catch (error) {
				console.error("Failed to get chat history:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get chat history",
				});
			}
		},
	}),

	// DELETE /api/chat/[projectId]/messages/[messageId]
	deleteMessage: defineAction({
		input: z.object({
			projectId: z.string(),
			messageId: z.string(),
		}),
		handler: async ({ projectId, messageId }) => {
			try {
				// Get the conversation for this project
				const conversation = await getConversation(projectId);
				if (!conversation) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Conversation not found",
					});
				}

				// Get all messages for this conversation
				const messages = await getMessages(conversation.id);

				// Find the index of the message to delete
				const messageIndex = messages.findIndex(
					(msg: any) => msg.id === messageId,
				);

				if (messageIndex === -1) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Message not found",
					});
				}

				// Delete the message and all messages after it
				await deleteMessagesFromIndex(conversation.id, messageIndex);

				return { success: true };
			} catch (error) {
				if (error instanceof ActionError) throw error;
				console.error("Failed to delete message:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete message",
				});
			}
		},
	}),
};
