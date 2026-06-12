import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	getProjectById,
	getProjectsByUserId,
} from "@/server/projects/projects.model";

export const list = defineAction({
	handler: async (_input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to list projects",
			});
		}

		const { getProjectRuntimeUrls } = await import(
			"@/server/projects/projectUrls"
		);
		const projects = await getProjectsByUserId(user.id);
		const projectsWithUrls = await Promise.all(
			projects.map(async (project) => {
				const urls = await getProjectRuntimeUrls(project);
				return {
					...project,
					previewUrl: urls.preview.preferred,
					previewUrls: urls.preview,
					productionUrls: urls.production,
				};
			}),
		);
		return { projects: projectsWithUrls };
	},
});

export const get = defineAction({
	input: z.object({
		projectId: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to view a project",
			});
		}

		const project = await getProjectById(input.projectId);
		if (!project) {
			throw new ActionError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		if (project.ownerUserId !== user.id) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		return { project };
	},
});
