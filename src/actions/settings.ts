import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { and, eq } from "drizzle-orm";
import { DEFAULT_MODEL, FAST_MODEL } from "@/server/config/models";
import { db } from "@/server/db/client";
import { modelFavorites, userSettings } from "@/server/db/schema";

export const settings = {
	save: defineAction({
		accept: "json",
		input: z.object({
			defaultModel: z.string().default(DEFAULT_MODEL),
			fastModel: z.string().default(FAST_MODEL),
			openrouterApiKey: z.string().optional(),
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
					fastModel: input.fastModel,
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

	getFavorites: defineAction({
		handler: async (_input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to get favorites",
				});
			}

			const favorites = await db
				.select()
				.from(modelFavorites)
				.where(eq(modelFavorites.userId, user.id));

			return { favorites };
		},
	}),

	addFavorite: defineAction({
		input: z.object({
			provider: z.string(),
			modelId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to add favorites",
				});
			}

			await db.insert(modelFavorites).values({
				id: crypto.randomUUID(),
				userId: user.id,
				provider: input.provider,
				modelId: input.modelId,
				createdAt: new Date(),
			});

			return { success: true };
		},
	}),

	removeFavorite: defineAction({
		input: z.object({
			provider: z.string(),
			modelId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to remove favorites",
				});
			}

			await db
				.delete(modelFavorites)
				.where(
					and(
						eq(modelFavorites.userId, user.id),
						eq(modelFavorites.provider, input.provider),
						eq(modelFavorites.modelId, input.modelId),
					),
				);

			return { success: true };
		},
	}),

	setFastModel: defineAction({
		input: z.object({
			fastModel: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to set fast model",
				});
			}

			await db
				.update(userSettings)
				.set({
					fastModel: input.fastModel,
					updatedAt: new Date(),
				})
				.where(eq(userSettings.userId, user.id));

			return { success: true };
		},
	}),
};

export { providers } from "@/actions/providers";
