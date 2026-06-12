import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { isProjectOwnedByUser } from "@/server/projects/projects.model";
import { enqueueDockerStop } from "@/server/queue/enqueue";

export const stop = defineAction({
	input: z.object({
		projectId: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to stop a project",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		const job = await enqueueDockerStop({
			projectId: input.projectId,
			reason: "user",
		});

		return { success: true, jobId: job.id };
	},
});

export const restart = defineAction({
	input: z.object({
		projectId: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to restart a project",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		const { getProjectById } = await import("@/server/projects/projects.model");
		const project = await getProjectById(input.projectId);
		if (!project) {
			throw new ActionError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		const { enqueueDockerEnsureRunning } = await import(
			"@/server/queue/enqueue"
		);

		const { updateProjectStatus } = await import(
			"@/server/projects/projects.model"
		);

		await updateProjectStatus(input.projectId, "starting");

		const job = await enqueueDockerEnsureRunning({
			projectId: input.projectId,
			reason: "user",
		});

		return { success: true, jobId: job.id };
	},
});
