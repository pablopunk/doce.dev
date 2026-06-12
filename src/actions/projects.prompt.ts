import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	isProjectOwnedByUser,
	markInitialPromptCompleted as markInitialPromptCompletedModel,
	markInitialPromptSent as markInitialPromptSentModel,
} from "@/server/projects/projects.model";

export const markInitialPromptSent = defineAction({
	input: z.object({
		projectId: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		await markInitialPromptSentModel(input.projectId);
		return { success: true };
	},
});

export const markInitialPromptCompleted = defineAction({
	input: z.object({
		projectId: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		await markInitialPromptCompletedModel(input.projectId);
		return { success: true };
	},
});
