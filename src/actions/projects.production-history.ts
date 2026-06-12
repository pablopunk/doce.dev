import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";

export const getProductionHistory = defineAction({
	input: z.object({
		projectId: z.string(),
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

		const project = await getProjectById(input.projectId);
		if (!project) {
			throw new ActionError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		const { getProductionVersions } = await import(
			"@/server/productions/cleanup"
		);

		const { getProjectRuntimeUrls } = await import(
			"@/server/projects/projectUrls"
		);
		const versions = await getProductionVersions(input.projectId);
		const productionPort = project.productionPort;
		const urls = await getProjectRuntimeUrls(project);

		return {
			productionPort,
			baseUrl: urls.production.preferred,
			versions: versions.map((v) => {
				return {
					hash: v.hash,
					isActive: v.isActive,
					createdAt: v.mtimeIso,
					url: v.isActive
						? (urls.production.preferred ?? undefined)
						: undefined,
					baseUrl: urls.production.local,
					previewUrl: urls.production.tailscale ?? undefined,
					productionPort,
				};
			}),
		};
	},
});
