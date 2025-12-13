import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
	Conversation,
	type ConversationModel,
} from "@/domain/conversations/models/conversation";
import { DEFAULT_AI_MODEL } from "@/domain/llms/models/ai-models";
import { Project } from "@/domain/projects/models/project";

export const server = {
	/**
	 * Get chat history for a project.
	 * Returns initial prompt even if OpenCode server isn't ready yet.
	 * Also returns hasExistingSession to indicate if the project has been generated before.
	 */
	getHistory: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async ({ projectId }) => {
			const project = await Project.getById(projectId);
			if (!project) {
				throw new ActionError({
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			const conversation = Conversation.getByProjectId(projectId);
			// If there's an opencodeSessionId, this project has been generated before
			const hasExistingSession = !!conversation?.opencodeSessionId;

			try {
				const history = await Conversation.getHistory(projectId);
				return {
					...history,
					initialPrompt: project.initialPrompt ?? history.initialPrompt ?? null,
					hasExistingSession,
				};
			} catch (error) {
				// If OpenCode isn't ready, return empty messages with initial prompt
				// so the UI can display the user's request
				console.error("Failed to get chat history:", error);
				return {
					messages: [],
					model: conversation?.model || DEFAULT_AI_MODEL,
					initialPrompt: project.initialPrompt ?? null,
					hasExistingSession,
				};
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
