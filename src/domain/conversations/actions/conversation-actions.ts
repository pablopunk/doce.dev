import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
	Conversation,
	type ConversationModel,
} from "@/domain/conversations/models/conversation";
import { Project } from "@/domain/projects/models/project";

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
				const history = await Conversation.getHistory(projectId);
				const project = await Project.getById(projectId);
				return {
					...history,
					initialPrompt:
						project?.initialPrompt ?? history.initialPrompt ?? null,
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

	/**
	 * Message deletion previously manipulated the local DB transcript.
	 * Now that the chat history is owned entirely by OpenCode, this
	 * action becomes a no-op kept only for UI backward compatibility.
	 */
	deleteMessage: defineAction({
		input: z.object({
			projectId: z.string(),
			messageId: z.string(),
		}),
		handler: async () => {
			return { success: true };
		},
	}),
};
