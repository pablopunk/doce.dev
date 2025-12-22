import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db/client";
import { users, userSettings } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, invalidateSession } from "@/server/auth/sessions";
import {
	validateOpenRouterApiKey,
	AVAILABLE_MODELS,
	DEFAULT_MODEL,
} from "@/server/settings/openrouter";
import {
	enqueueDeleteAllProjectsForUser,
	enqueueDockerStop,
	enqueueProjectCreate,
	enqueueProjectDelete,
} from "@/server/queue/enqueue";
import {
	cancelQueuedJob,
	forceUnlock,
	getJobById,
	retryJob,
	runNow,
	requestCancel,
	setQueuePaused,
	setConcurrency,
	deleteJob,
	deleteJobsByState,
} from "@/server/queue/queue.model";
import {
	getProjectsByUserId,
	getProjectById,
	isProjectOwnedByUser,
	updateProjectModel,
	updateOpencodeJsonModel,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { eq } from "drizzle-orm";

const SESSION_COOKIE_NAME = "doce_session";

export const server = {
	setup: {
		createAdmin: defineAction({
			accept: "form",
			input: z.object({
				username: z.string().min(1, "Username is required"),
				password: z.string().min(1, "Password is required"),
				confirmPassword: z.string(),
				openrouterApiKey: z.string().min(1, "OpenRouter API key is required"),
				defaultModel: z.string().default(DEFAULT_MODEL),
			}),
			handler: async (input, context) => {
				// Check if admin already exists
				const existingUsers = await db.select().from(users).limit(1);
				if (existingUsers.length > 0) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "Admin user already exists",
					});
				}

				// Validate passwords match
				if (input.password !== input.confirmPassword) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Passwords do not match",
					});
				}

				// Validate OpenRouter API key
				const validation = await validateOpenRouterApiKey(
					input.openrouterApiKey,
				);
				if (!validation.valid) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: validation.error ?? "Invalid OpenRouter API key",
					});
				}

				// Create admin user
				const userId = randomBytes(16).toString("hex");
				const passwordHash = await hashPassword(input.password);
				const now = new Date();

				await db.insert(users).values({
					id: userId,
					username: input.username,
					createdAt: now,
					passwordHash,
				});

				// Create user settings
				await db.insert(userSettings).values({
					userId,
					openrouterApiKey: input.openrouterApiKey,
					defaultModel: input.defaultModel,
					updatedAt: now,
				});

				// Create session and set cookie
				const sessionToken = await createSession(userId);
				context.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
					path: "/",
					httpOnly: true,
					sameSite: "lax",
					secure: import.meta.env.PROD,
					maxAge: 60 * 60 * 24 * 30, // 30 days
				});

				return { success: true };
			},
		}),
	},

	auth: {
		login: defineAction({
			accept: "form",
			input: z.object({
				username: z.string().min(1, "Username is required"),
				password: z.string().min(1, "Password is required"),
			}),
			handler: async (input, context) => {
				// Get the user by username
				const foundUsers = await db
					.select()
					.from(users)
					.where(eq(users.username, input.username))
					.limit(1);
				const user = foundUsers[0];

				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "Invalid username or password",
					});
				}

				// Verify password
				const isValid = await verifyPassword(
					input.password,
					user.passwordHash,
				);
				if (!isValid) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "Invalid username or password",
					});
				}

				// Create session and set cookie
				const sessionToken = await createSession(user.id);
				context.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
					path: "/",
					httpOnly: true,
					sameSite: "lax",
					secure: import.meta.env.PROD,
					maxAge: 60 * 60 * 24 * 30, // 30 days
				});

				return { success: true };
			},
		}),

		logout: defineAction({
			handler: async (_input, context) => {
				const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
				if (sessionToken) {
					await invalidateSession(sessionToken);
					context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
				}
				return { success: true };
			},
		}),
	},

	settings: {
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
				const validation = await validateOpenRouterApiKey(
					input.openrouterApiKey,
				);
				if (!validation.valid) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: validation.error ?? "Invalid OpenRouter API key",
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
	},

	projects: {
		create: defineAction({
			accept: "form",
			input: z.object({
				prompt: z.string().min(1, "Please describe your website"),
				model: z.string().optional(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to create a project",
					});
				}

				// Get user settings to verify API key exists
				const settings = await db
					.select()
					.from(userSettings)
					.where(eq(userSettings.userId, user.id))
					.limit(1);

				const userSettingsData = settings[0];
				if (!userSettingsData?.openrouterApiKey) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Please configure your OpenRouter API key in settings",
					});
				}

				// Generate project ID upfront so we can return it immediately
				const projectId = randomBytes(12).toString("hex");

				// Enqueue the project creation job asynchronously
				// Don't await - return immediately to the user
				enqueueProjectCreate({
					projectId,
					ownerUserId: user.id,
					prompt: input.prompt,
					model: input.model ?? userSettingsData.defaultModel ?? null,
				}).catch((err) => {
					console.error("Failed to enqueue project creation:", err);
				});

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

				// Verify ownership
				const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
				if (!isOwner) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "You don't have access to this project",
					});
				}

				try {
					await updateProjectStatus(input.projectId, "deleting");
				} catch {
					// ignore
				}

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

				// Update database
				await updateProjectModel(input.projectId, input.model);
				
				// Also update opencode.json on disk for file-based persistence
				if (input.model) {
					try {
						await updateOpencodeJsonModel(input.projectId, input.model);
					} catch (error) {
						// Log warning but don't fail - DB is already updated
						console.warn(
							"Updated model in database but failed to update opencode.json. Next OpenCode session may not reflect model change until file is manually synced."
						);
					}
				}
				
				return { success: true };
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
	},

	queue: {
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
						message: "Job not found or not in terminal state (can only delete succeeded, failed, or cancelled jobs)",
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
	},
};
