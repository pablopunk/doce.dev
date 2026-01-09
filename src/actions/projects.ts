import { ActionError, defineAction } from "astro:actions";
import { randomBytes } from "node:crypto";
import { z } from "astro/zod";
import { listConnectedProviderIds } from "@/server/opencode/authFile";

import {
	getProjectById,
	getProjectsByUserId,
	isProjectOwnedByUser,
	updateOpencodeJsonModel,
	updateProjectModel,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import {
	enqueueDeleteAllProjectsForUser,
	enqueueDockerStop,
	enqueueProductionBuild,
	enqueueProductionStop,
	enqueueProjectCreate,
	enqueueProjectDelete,
} from "@/server/queue/enqueue";

export const projects = {
	create: defineAction({
		accept: "json",
		input: z.object({
			prompt: z.string().min(1, "Please describe your website"),
			model: z.string().optional(),
			images: z.string().optional(),
		}),
		handler: async (input, context) => {
			console.log("Projects create handler called", {
				input,
				contextLocals: !!context.locals,
			});
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to create a project",
				});
			}

			const connectedProviderIds = await listConnectedProviderIds();
			if (connectedProviderIds.length === 0) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Please connect at least one provider in Settings",
				});
			}

			let images:
				| Array<{ filename: string; mime: string; dataUrl: string }>
				| undefined;
			if (input.images) {
				try {
					images = JSON.parse(input.images);
				} catch {}
			}

			const projectId = randomBytes(12).toString("hex");

			try {
				await enqueueProjectCreate({
					projectId,
					ownerUserId: user.id,
					prompt: input.prompt,
					model: input.model ?? null,
					images,
				});
			} catch (err) {
				console.error("Failed to enqueue project creation:", err);
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
	}),

	list: defineAction({
		handler: async (_input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to list projects",
				});
			}

			const projects = await getProjectsByUserId(user.id);
			return { projects };
		},
	}),

	get: defineAction({
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
	}),

	delete: defineAction({
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
				await updateProjectStatus(input.projectId, "deleting");
			} catch {}

			const job = await enqueueProjectDelete({
				projectId: input.projectId,
				requestedByUserId: user.id,
			});

			return { success: true, jobId: job.id };
		},
	}),

	stop: defineAction({
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
	}),

	deploy: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to deploy a project",
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

			if (project.status !== "running") {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: `Cannot deploy project while it's ${project.status}`,
				});
			}

			const job = await enqueueProductionBuild({
				projectId: input.projectId,
			});

			return { success: true, jobId: job.id };
		},
	}),

	stopProduction: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to stop production",
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

			const job = await enqueueProductionStop(input.projectId);

			return { success: true, jobId: job.id };
		},
	}),

	deleteAll: defineAction({
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
	}),

	updateModel: defineAction({
		input: z.object({
			projectId: z.string(),
			model: z.string().nullable(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to update a project",
				});
			}

			const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
			if (!isOwner) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			await updateProjectModel(input.projectId, input.model);

			if (input.model) {
				try {
					await updateOpencodeJsonModel(input.projectId, input.model);
				} catch (error) {
					console.warn(
						"Updated model in database but failed to update opencode.json.",
					);
				}
			}

			return { success: true };
		},
	}),
};
