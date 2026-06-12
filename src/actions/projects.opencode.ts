import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { logger } from "@/server/logger";
import { restartGlobalOpencode } from "@/server/opencode/runtime";
import { isProjectOwnedByUser } from "@/server/projects/projects.model";

export const restartOpencode = defineAction({
	accept: "json",
	input: z.object({
		projectId: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to restart the agent",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		try {
			logger.info(
				{ projectId: input.projectId, userId: user.id },
				"Restarting OpenCode agent",
			);
			await restartGlobalOpencode();
			return { success: true };
		} catch (error) {
			logger.error(
				{ error, projectId: input.projectId },
				"Failed to restart OpenCode agent",
			);
			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message:
					error instanceof Error ? error.message : "Failed to restart agent",
			});
		}
	},
});
