import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";

export const chat = {
	revertToMessage: defineAction({
		accept: "json",
		input: z.object({
			projectId: z.string(),
			messageId: z.string(),
		}),
		handler: async ({ projectId, messageId }, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in",
				});
			}

			const owned = await isProjectOwnedByUser(projectId, user.id);
			if (!owned) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			const project = await getProjectById(projectId);
			const sessionId = project?.bootstrapSessionId;
			if (!sessionId) {
				throw new ActionError({
					code: "NOT_FOUND",
					message: "No active session for this project",
				});
			}

			const client = createOpencodeClient();
			await client.session.revert({
				sessionID: sessionId,
				messageID: messageId,
			});

			logger.debug(
				{ projectId, sessionId, messageId },
				"Reverted session to message",
			);

			return { success: true as const, revertMessageId: messageId };
		},
	}),
};
