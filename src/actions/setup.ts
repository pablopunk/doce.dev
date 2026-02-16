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

type SetupActionContext = {
	request: Request;
	cookies: {
		set: (
			name: string,
			value: string,
			options: {
				path: string;
				httpOnly: boolean;
				sameSite: "lax" | "strict" | "none";
				secure: boolean;
				maxAge: number;
			},
		) => void;
	};
};

async function doCreateAdmin(
	input: { username: string; password: string; confirmPassword: string },
	context: SetupActionContext,
) {
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
	} catch (_error) {
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
}

export const setup = {
	createAdmin: defineAction({
		accept: "json",
		input: z.object({
			username: z.string().min(1, "Username is required"),
			password: z.string().min(1, "Password is required"),
			confirmPassword: z.string(),
		}),
		handler: async (input, context) => {
			try {
				return await doCreateAdmin(input, context);
			} catch (error) {
				logger.error(`[setup.createAdmin] Caught error: ${error}`);

				// Check if it's already an ActionError
				if (error instanceof ActionError) {
					logger.error("[setup.createAdmin] Throwing ActionError");
					throw error;
				}

				// If it's any other error, wrap it
				logger.error(
					`[setup.createAdmin] Wrapping error in ActionError: ${String(error)}`,
				);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create admin user",
				});
			}
		},
	}),
};
