import { ActionError, defineAction } from "astro:actions";
import { randomBytes } from "node:crypto";
import { z } from "astro/zod";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/sessions";
import { DEFAULT_MODEL } from "@/server/config/models";
import { db } from "@/server/db/client";
import { userSettings, users } from "@/server/db/schema";
import { logger } from "@/server/logger";

const SESSION_COOKIE_NAME = "doce_session";

export const setup = {
	createAdmin: defineAction({
		accept: "form",
		input: z.object({
			username: z.string().min(1, "Username is required"),
			password: z.string().min(1, "Password is required"),
			confirmPassword: z.string(),
		}),
		handler: async (input, context) => {
			try {
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

				// Create admin user
				const userId = randomBytes(16).toString("hex");
				let passwordHash: string;
				try {
					passwordHash = await hashPassword(input.password);
				} catch (error) {
					// Password hashing failed (crypto error, invalid password, etc.)
					throw new ActionError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to create admin user",
					});
				}

				const now = new Date();

				await db.insert(users).values({
					id: userId,
					username: input.username,
					createdAt: now,
					passwordHash,
				});

				// Create user settings (no provider credentials required at setup)
				await db.insert(userSettings).values({
					userId,
					defaultModel: DEFAULT_MODEL,
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
			} catch (error) {
				// Log the actual error for debugging
				const errorMsg = error instanceof Error ? error.message : String(error);
				const errorStack = error instanceof Error ? error.stack : "no stack";
				logger.error(`[setup.createAdmin] Error caught: ${errorMsg}`);
				logger.error(`[setup.createAdmin] Error stack: ${errorStack}`);
				logger.error(
					`[setup.createAdmin] Error type: ${typeof error}, constructor: ${error?.constructor?.name}`,
				);

				// Check if error is already an ActionError by checking for code and message properties
				if (
					error &&
					typeof error === "object" &&
					"code" in error &&
					"message" in error &&
					typeof (error as Record<string, unknown>).message === "string"
				) {
					logger.error("[setup.createAdmin] Re-throwing ActionError");
					throw error;
				}

				// Unexpected error - wrap in ActionError
				logger.error(
					"[setup.createAdmin] Wrapping unexpected error in ActionError",
				);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create admin user",
				});
			}
		},
	}),
};
