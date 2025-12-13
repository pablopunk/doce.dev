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
import { eq } from "drizzle-orm";

const SESSION_COOKIE_NAME = "doce_session";

export const server = {
	setup: {
		createAdmin: defineAction({
			accept: "form",
			input: z.object({
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
				password: z.string().min(1, "Password is required"),
			}),
			handler: async (input, context) => {
				// Get the admin user
				const adminUsers = await db.select().from(users).limit(1);
				const admin = adminUsers[0];

				if (!admin) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "No admin user found. Please run setup first.",
					});
				}

				// Verify password
				const isValid = await verifyPassword(
					input.password,
					admin.passwordHash,
				);
				if (!isValid) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "Invalid password",
					});
				}

				// Create session and set cookie
				const sessionToken = await createSession(admin.id);
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
};
