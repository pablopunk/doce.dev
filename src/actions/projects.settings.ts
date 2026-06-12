import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { logger } from "@/server/logger";
import {
	isProjectOwnedByUser,
	updateOpencodeJsonModel,
	updateProjectDisplayIdentity,
	updateProjectModel,
} from "@/server/projects/projects.model";

export const updateModel = defineAction({
	input: z.object({
		projectId: z.string(),
		model: z.string().nullable(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to update a project",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		await updateProjectModel(input.projectId, input.model);

		if (input.model) {
			try {
				await updateOpencodeJsonModel(input.projectId, input.model);
			} catch (_error) {
				logger.warn(
					"Updated model in database but failed to update opencode.json",
				);
			}
		}

		return { success: true };
	},
});

export const updateIdentity = defineAction({
	accept: "json",
	input: z.object({
		projectId: z.string(),
		name: z.string().min(1).max(64),
		icon: z.string().emoji().max(4),
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
		await updateProjectDisplayIdentity(input.projectId, {
			name: input.name,
			icon: input.icon,
		});
		return { success: true };
	},
});
