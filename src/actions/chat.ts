import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";

async function authorizeSession(projectId: string, userId: string) {
	const owned = await isProjectOwnedByUser(projectId, userId);
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
	return sessionId;
}

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

			const sessionId = await authorizeSession(projectId, user.id);
			const client = createOpencodeClient();

			// Match opencode web UI: abort any in-flight generation before reverting
			// so streaming events can't race the revert and reattach to the rolled-back message.
			await client.session.abort({ sessionID: sessionId }).catch(() => {});

			await client.session.revert({
				sessionID: sessionId,
				messageID: messageId,
			});

			let serverRevertMessageId: string | null = messageId;
			try {
				const info = await client.session.get({ sessionID: sessionId });
				const data = (info as { data?: { revert?: { messageID?: string } } })
					.data;
				serverRevertMessageId = data?.revert?.messageID ?? messageId;
			} catch (error) {
				logger.debug({ error }, "Failed to refetch session after revert");
			}

			logger.debug(
				{ projectId, sessionId, messageId, serverRevertMessageId },
				"Reverted session to message",
			);

			return {
				success: true as const,
				revertMessageId: serverRevertMessageId,
			};
		},
	}),

	unrevertSession: defineAction({
		accept: "json",
		input: z.object({
			projectId: z.string(),
		}),
		handler: async ({ projectId }, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in",
				});
			}

			const sessionId = await authorizeSession(projectId, user.id);
			const client = createOpencodeClient();

			await client.session.abort({ sessionID: sessionId }).catch(() => {});
			await client.session.unrevert({ sessionID: sessionId });

			logger.debug({ projectId, sessionId }, "Unreverted session");
			return { success: true as const };
		},
	}),
};
