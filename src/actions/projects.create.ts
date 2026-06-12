import { ActionError, defineAction } from "astro:actions";
import { randomBytes } from "node:crypto";
import { z } from "astro/zod";
import { logger } from "@/server/logger";
import { getAvailableModels } from "@/server/opencode/models";
import { enqueueProjectCreate } from "@/server/queue/enqueue";

export const create = defineAction({
	accept: "json",
	input: z.object({
		prompt: z.string().min(1, "Please describe your website"),
		model: z.string().optional(),
		attachments: z.string().optional(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to create a project",
			});
		}

		const availableModels = await getAvailableModels();
		if (availableModels.length === 0) {
			throw new ActionError({
				code: "BAD_REQUEST",
				message: "No models available. Please check your provider settings.",
			});
		}

		let attachments:
			| Array<{
					filename: string;
					mime: string;
					dataUrl: string;
					kind?: "image" | "text";
					textContent?: string;
			  }>
			| undefined;
		if (input.attachments) {
			try {
				const parsed = JSON.parse(input.attachments);
				if (!Array.isArray(parsed)) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Invalid attachments format",
					});
				}
				attachments = parsed;
			} catch (err) {
				if (err instanceof ActionError) throw err;
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Invalid attachments JSON",
				});
			}
		}

		const projectId = randomBytes(12).toString("hex");

		try {
			await enqueueProjectCreate({
				projectId,
				ownerUserId: user.id,
				prompt: input.prompt,
				model: input.model ?? null,
				attachments,
			});
		} catch (err) {
			logger.error({ err }, "Failed to enqueue project creation");
			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to start project creation",
			});
		}

		return {
			success: true,
			projectId,
		};
	},
});
