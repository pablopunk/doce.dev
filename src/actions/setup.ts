import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import bcrypt from "bcryptjs";
import { createUser, isSetupComplete, setConfig } from "@/lib/db";

export const server = {
	// GET /api/setup/status
	getStatus: defineAction({
		handler: async () => {
			try {
				return { setupComplete: isSetupComplete() };
			} catch (error) {
				console.error("[doce.dev] Setup status error:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to check setup status",
				});
			}
		},
	}),

	// POST /api/setup/ai
	setupAI: defineAction({
		input: z.object({
			provider: z.string(),
			apiKey: z.string(),
		}),
		handler: async ({ provider, apiKey }) => {
			try {
				if (isSetupComplete()) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Setup already completed",
					});
				}

				setConfig("ai_provider", provider);
				setConfig(`${provider}_api_key`, apiKey);

				return { success: true };
			} catch (error) {
				if (error instanceof ActionError) throw error;
				console.error("[doce.dev] Setup AI error:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to configure AI",
				});
			}
		},
	}),

	// POST /api/setup/user
	createUser: defineAction({
		input: z.object({
			username: z.string().min(1, "Username is required"),
			password: z.string().min(1, "Password is required"),
		}),
		handler: async ({ username, password }) => {
			console.log(`[Setup] Creating user: ${username}`);
			try {
				if (isSetupComplete()) {
					console.error("[Setup] ERROR: Setup already completed");
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Setup already completed",
					});
				}

				const passwordHash = await bcrypt.hash(password, 10);
				console.log(`[Setup] Hashed password, creating user in DB`);
				const user = createUser(username, passwordHash);
				console.log(`[Setup] User created successfully: ${user.id}`);

				return { success: true, userId: user.id };
			} catch (error) {
				if (error instanceof ActionError) {
					console.error(`[Setup] ActionError:`, error.code, error.message);
					throw error;
				}
				console.error("[Setup] Unexpected error creating user:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						error instanceof Error ? error.message : "Failed to create user",
				});
			}
		},
	}),

	// POST /api/setup/complete
	completeSetup: defineAction({
		handler: async () => {
			try {
				if (isSetupComplete()) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Setup already completed",
					});
				}

				setConfig("setup_complete", "true");
				return { success: true };
			} catch (error) {
				if (error instanceof ActionError) throw error;
				console.error("[doce.dev] Setup complete error:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to complete setup",
				});
			}
		},
	}),
};
