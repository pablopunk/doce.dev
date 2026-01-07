import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { eq } from "drizzle-orm";
import { DEFAULT_MODEL } from "@/server/config/models";
import { db } from "@/server/db/client";
import { userSettings } from "@/server/db/schema";

export const settings = {
	save: defineAction({
		accept: "form",
		input: z.object({
			defaultModel: z.string().default(DEFAULT_MODEL),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to save settings",
				});
			}

			await db
				.update(userSettings)
				.set({
					defaultModel: input.defaultModel,
					updatedAt: new Date(),
				})
				.where(eq(userSettings.userId, user.id));

			return { success: true };
		},
	}),

	get: defineAction({
		handler: async (_input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to get settings",
				});
			}

			const settings = await db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, user.id))
				.limit(1);

			return {
				settings: settings[0] ?? null,
			};
		},
	}),
};

export { providers } from "@/actions/providers";
