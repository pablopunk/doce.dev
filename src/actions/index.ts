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
import { createProjectFromPrompt } from "@/server/projects/create";
import {
	deleteProject,
	stopProject,
	deleteAllProjectsForUser,
} from "@/server/projects/delete";
import {
	getProjectsByUserId,
	getProjectById,
	isProjectOwnedByUser,
	updateProjectModel,
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

				// Get user settings to get the API key
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

				const result = await createProjectFromPrompt({
					prompt: input.prompt,
					model: input.model ?? userSettingsData.defaultModel,
					ownerUserId: user.id,
					openrouterApiKey: userSettingsData.openrouterApiKey,
				});

				if (!result.started && result.error) {
					// Project was created but Docker failed to start
					// We still return the project so user can see it and retry
					return {
						success: true,
						project: result.project,
						warning: result.error,
					};
				}

				return {
					success: true,
					project: result.project,
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

				const result = await deleteProject(input.projectId);
				if (!result.success) {
					throw new ActionError({
						code: "INTERNAL_SERVER_ERROR",
						message: result.error ?? "Failed to delete project",
					});
				}

				return { success: true };
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

				const result = await stopProject(input.projectId);
				if (!result.success) {
					throw new ActionError({
						code: "INTERNAL_SERVER_ERROR",
						message: result.error ?? "Failed to stop project",
					});
				}

				return { success: true };
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

				const result = await deleteAllProjectsForUser(user.id);

				if (!result.success) {
					throw new ActionError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Deleted ${result.deleted} projects, but some failed: ${result.errors.join(", ")}`,
					});
				}

				return { success: true, deleted: result.deleted };
			},
		}),
	},
};
