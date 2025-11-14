import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { User, Setup, type UserModel } from "@/domain/auth/models/user";

export const server = {
	/**
	 * Get setup status
	 */
	getStatus: defineAction({
		handler: async () => {
			try {
				return Setup.getStatus();
			} catch (error) {
				console.error("[doce.dev] Setup status error:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to check setup status",
				});
			}
		},
	}),

	/**
	 * Configure AI provider during setup
	 */
	setupAI: defineAction({
		input: z.object({
			provider: z.string(),
			apiKey: z.string(),
		}),
		handler: async ({ provider, apiKey }) => {
			try {
				Setup.configureAI(provider, apiKey);
				return { success: true };
			} catch (error) {
				if (
					error instanceof Error &&
					error.message === "Setup already completed"
				) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Setup already completed",
					});
				}

				console.error("[doce.dev] Setup AI error:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to configure AI",
				});
			}
		},
	}),

	/**
	 * Create a new user during setup
	 */
	createUser: defineAction({
		input: z.object({
			username: z.string().min(1, "Username is required"),
			password: z.string().min(1, "Password is required"),
		}),
		handler: async ({ username, password }) => {
			console.log(`[Setup] Creating user: ${username}`);
			try {
				if (Setup.isComplete()) {
					console.error("[Setup] ERROR: Setup already completed");
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Setup already completed",
					});
				}

				const user: UserModel = await User.create(username, password);
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

	/**
	 * Complete the setup process
	 */
	completeSetup: defineAction({
		handler: async () => {
			try {
				if (Setup.isComplete()) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Setup already completed",
					});
				}

				Setup.complete();
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
