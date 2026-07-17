import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	isProjectOwnedByUser,
	updateProjectDesiredStatus,
} from "@/server/projects/projects.model";
import {
	enqueueDeleteAllProjectsForUser,
	enqueueProjectDelete,
} from "@/server/queue/enqueue";

export const deleteProject = defineAction({
	input: z.object({
		projectId: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to delete a project",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		try {
			await updateProjectDesiredStatus(input.projectId, "deleting");
		} catch {}

		try {
			const { cancelActiveProductionJobs } = await import(
				"@/server/productions/productions.model"
			);
			await cancelActiveProductionJobs(input.projectId);
		} catch {}

		const job = await enqueueProjectDelete({
			projectId: input.projectId,
			requestedByUserId: user.id,
		});

		return { success: true, jobId: job.id };
	},
});

export const deleteAll = defineAction({
	handler: async (_input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to delete projects",
			});
		}

		const job = await enqueueDeleteAllProjectsForUser({ userId: user.id });

		return { success: true, jobId: job.id };
	},
});
