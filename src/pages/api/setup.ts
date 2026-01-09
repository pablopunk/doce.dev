import { randomBytes } from "node:crypto";
import type { APIRoute } from "astro";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/sessions";
import { DEFAULT_MODEL } from "@/server/config/models";
import { db } from "@/server/db/client";
import { userSettings, users } from "@/server/db/schema";
import { logger } from "@/server/logger";

const SESSION_COOKIE_NAME = "doce_session";

export const POST: APIRoute = async (context) => {
	try {
		const body = await context.request.json();
		const { username, password, confirmPassword } = body;

		// Validate input
		if (!username || typeof username !== "string") {
			return new Response(JSON.stringify({ error: "Username is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (!password || typeof password !== "string") {
			return new Response(JSON.stringify({ error: "Password is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (!confirmPassword || typeof confirmPassword !== "string") {
			return new Response(
				JSON.stringify({ error: "Confirm password is required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		// Validate passwords match
		if (password !== confirmPassword) {
			return new Response(JSON.stringify({ error: "Passwords do not match" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Check if admin already exists
		const existingUsers = await db.select().from(users).limit(1);
		if (existingUsers.length > 0) {
			return new Response(
				JSON.stringify({ error: "Admin user already exists" }),
				{ status: 403, headers: { "Content-Type": "application/json" } },
			);
		}

		// Hash password
		let passwordHash: string;
		try {
			passwordHash = await hashPassword(password);
		} catch (error) {
			logger.error(`[api/setup] Password hashing failed: ${error}`);
			return new Response(
				JSON.stringify({ error: "Failed to hash password" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		// Create admin user
		const userId = randomBytes(16).toString("hex");
		const now = new Date();

		try {
			await db.insert(users).values({
				id: userId,
				username,
				createdAt: now,
				passwordHash,
			});

			// Create user settings
			await db.insert(userSettings).values({
				userId,
				defaultModel: DEFAULT_MODEL,
				updatedAt: now,
			});

			// Create session
			const sessionToken = await createSession(userId);

			// Set session cookie
			context.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
				path: "/",
				httpOnly: true,
				sameSite: "lax",
				secure: import.meta.env.PROD,
				maxAge: 60 * 60 * 24 * 30, // 30 days
			});

			return new Response(JSON.stringify({ success: true, userId }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (dbError) {
			logger.error(`[api/setup] Database error: ${dbError}`);
			return new Response(
				JSON.stringify({ error: "Failed to create admin user" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	} catch (error) {
		logger.error(`[api/setup] Request error: ${error}`);
		return new Response(JSON.stringify({ error: "Invalid request" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
};
