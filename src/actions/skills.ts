import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	installSkill,
	listInstalledSkills,
	removeSkill,
	searchSkills,
} from "@/server/skills/skills.service";

function ensureAuthenticated(context: { locals: { user: unknown } }): void {
	if (!context.locals.user) {
		throw new ActionError({
			code: "UNAUTHORIZED",
			message: "You must be logged in",
		});
	}
}

export const skills = {
	list: defineAction({
		handler: async (_input, context) => {
			ensureAuthenticated(context);
			return listInstalledSkills();
		},
	}),

	search: defineAction({
		accept: "json",
		input: z.object({ query: z.string().min(1) }),
		handler: async (input, context) => {
			ensureAuthenticated(context);
			return searchSkills(input.query);
		},
	}),

	install: defineAction({
		accept: "json",
		input: z.object({
			source: z.string().min(1),
			skillName: z.string().optional(),
		}),
		handler: async (input, context) => {
			ensureAuthenticated(context);
			const result = await installSkill(input.source, input.skillName);
			if (!result.success) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: result.error ?? "Failed to install skill",
				});
			}
			return { success: true };
		},
	}),

	remove: defineAction({
		accept: "json",
		input: z.object({ skillName: z.string().min(1) }),
		handler: async (input, context) => {
			ensureAuthenticated(context);
			const result = await removeSkill(input.skillName);
			if (!result.success) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: result.error ?? "Failed to remove skill",
				});
			}
			return { success: true };
		},
	}),
};
