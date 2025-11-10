import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import bcrypt from "bcryptjs";
import { appendFile } from "fs/promises";
import { join } from "path";
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

				const envPath = join(process.cwd(), ".env.local");
				let envContent = "";
				if (provider === "openai") {
					envContent = `OPENAI_API_KEY=${apiKey}\n`;
				} else if (provider === "anthropic") {
					envContent = `ANTHROPIC_API_KEY=${apiKey}\n`;
				}

				if (envContent) {
					await appendFile(envPath, envContent);
				}

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
			username: z.string(),
			password: z.string().min(8),
		}),
		handler: async ({ username, password }) => {
			try {
				if (isSetupComplete()) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Setup already completed",
					});
				}

				const passwordHash = await bcrypt.hash(password, 10);
				const user = createUser(username, passwordHash);

				return { success: true, userId: user.id };
			} catch (error) {
				if (error instanceof ActionError) throw error;
				console.error("[doce.dev] Setup user error:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create user",
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
