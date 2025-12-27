import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { userSettings } from "@/server/db/schema";
import {
	AVAILABLE_MODELS,
	DEFAULT_MODEL,
	validateOpenRouterApiKey,
} from "@/server/settings/openrouter";

export const settings = {
	save: defineAction({
		accept: "form",
		input: z.object({
			openrouterApiKey: z.string().min(1, "OpenRouter API key is required"),
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

			// Validate OpenRouter API key
			try {
				await validateOpenRouterApiKey(input.openrouterApiKey);
			} catch {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Invalid OpenRouter API key",
				});
			}

			// Update user settings
			await db
				.update(userSettings)
				.set({
					openrouterApiKey: input.openrouterApiKey,
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
				availableModels: AVAILABLE_MODELS,
			};
		},
	}),
};
