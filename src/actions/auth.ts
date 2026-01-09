import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/server/auth/password";
import { createSession, invalidateSession } from "@/server/auth/sessions";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { logger } from "@/server/logger";

const SESSION_COOKIE_NAME = "doce_session";

export const auth = {
	login: defineAction({
		accept: "json",
		input: z.object({
			username: z.string().min(1, "Username is required"),
			password: z.string().min(1, "Password is required"),
		}),
		handler: async (input, context) => {
			try {
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
				let isValid = false;
				try {
					isValid = await verifyPassword(input.password, user.passwordHash);
				} catch (_error) {
					// Password verification failed (crypto error, invalid hash format, etc.)
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "Invalid username or password",
					});
				}

				if (!isValid) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "Invalid username or password",
					});
				}

				// Create session and set cookie
				const sessionToken = await createSession(user.id);
				// Only set secure flag if request is over HTTPS, not just based on PROD
				const isSecure = context.request.url.startsWith("https://");
				context.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
					path: "/",
					httpOnly: true,
					sameSite: "lax",
					secure: isSecure,
					maxAge: 60 * 60 * 24 * 30, // 30 days
				});

				return { success: true };
			} catch (error) {
				// Log the actual error for debugging
				const errorMsg = error instanceof Error ? error.message : String(error);
				const errorStack = error instanceof Error ? error.stack : "no stack";
				logger.error(`[auth.login] Error caught: ${errorMsg}`);
				logger.error(`[auth.login] Error stack: ${errorStack}`);
				logger.error(
					`[auth.login] Error type: ${typeof error}, constructor: ${error?.constructor?.name}`,
				);

				// Check if error is already an ActionError by checking for code and message properties
				if (
					error &&
					typeof error === "object" &&
					"code" in error &&
					"message" in error &&
					typeof (error as Record<string, unknown>).message === "string"
				) {
					logger.error("[auth.login] Re-throwing ActionError");
					throw error;
				}
				// Unexpected error - wrap in ActionError
				logger.error("[auth.login] Wrapping unexpected error in ActionError");
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Login failed",
				});
			}
		},
	}),

	logout: defineAction({
		accept: "json",
		handler: async (_input, context) => {
			const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
			if (sessionToken) {
				await invalidateSession(sessionToken);
				context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
			}
			return { success: true };
		},
	}),
};
