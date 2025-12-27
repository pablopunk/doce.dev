import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { randomBytes } from "node:crypto";
import { getProjectsByUserId } from "@/server/projects/projects.model";
import {
	enqueueDockerStop,
	enqueueProductionStop,
} from "@/server/queue/enqueue";
import {
	cancelQueuedJob,
	deleteJob,
	deleteJobsByState,
	forceUnlock,
	getJobById,
	requestCancel,
	retryJob,
	runNow,
	setConcurrency,
	setQueuePaused,
} from "@/server/queue/queue.model";

export const queue = {
	stopAll: defineAction({
		handler: async (_input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			const userProjects = await getProjectsByUserId(user.id);

			const jobs = [];
			for (const project of userProjects) {
				const dockerStopJob = await enqueueDockerStop({
					projectId: project.id,
					reason: "user",
				});
				jobs.push(dockerStopJob);

				const prodStopJob = await enqueueProductionStop(project.id);
				jobs.push(prodStopJob);
			}

			return { success: true, jobsEnqueued: jobs.length };
		},
	}),

	cancel: defineAction({
		input: z.object({
			jobId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			const job = await getJobById(input.jobId);
			if (!job) {
				throw new ActionError({
					code: "NOT_FOUND",
					message: "Job not found",
				});
			}

			if (job.state === "queued") {
				await cancelQueuedJob(job.id);
				return { success: true, state: "cancelled" };
			}

			await requestCancel(job.id);
			return { success: true, state: "cancelling" };
		},
	}),

	retry: defineAction({
		input: z.object({
			jobId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			const newJobId = randomBytes(16).toString("hex");
			const newJob = await retryJob(input.jobId, newJobId);
			return { success: true, jobId: newJob.id };
		},
	}),

	runNow: defineAction({
		input: z.object({
			jobId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			const updated = await runNow(input.jobId);
			if (!updated) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Job is not queued",
				});
			}

			return { success: true };
		},
	}),

	pause: defineAction({
		handler: async (_input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			await setQueuePaused(true);
			return { success: true };
		},
	}),

	resume: defineAction({
		handler: async (_input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			await setQueuePaused(false);
			return { success: true };
		},
	}),

	forceUnlock: defineAction({
		input: z.object({
			jobId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			const updated = await forceUnlock(input.jobId);
			if (!updated) {
				throw new ActionError({
					code: "NOT_FOUND",
					message: "Job not found",
				});
			}

			return { success: true };
		},
	}),

	deleteJob: defineAction({
		input: z.object({
			jobId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			const deleted = await deleteJob(input.jobId);
			if (deleted === 0) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message:
						"Job not found or not in terminal state (can only delete succeeded, failed, or cancelled jobs)",
				});
			}

			return { success: true };
		},
	}),

	deleteByState: defineAction({
		input: z.object({
			state: z.enum(["succeeded", "failed", "cancelled"]),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			const deleted = await deleteJobsByState(input.state);
			return { success: true, deleted };
		},
	}),

	setConcurrency: defineAction({
		input: z.object({
			concurrency: z.number().int().min(1).max(20),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to manage the queue",
				});
			}

			await setConcurrency(input.concurrency);
			return { success: true };
		},
	}),
};
