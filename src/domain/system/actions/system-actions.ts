import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { Admin, Deployment, SystemStats } from "@/domain/system/models/system";

export const deployments = {
	/**
	 * Get deployment by ID
	 */
	getDeployment: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const deployment = await Deployment.getById(id);
				if (!deployment) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Deployment not found",
					});
				}
				return deployment;
			} catch (error) {
				if (error instanceof ActionError) throw error;
				console.error("Failed to get deployment:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get deployment",
				});
			}
		},
	}),

	/**
	 * Delete a deployment
	 */
	deleteDeployment: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				await Deployment.delete(id);
				return { success: true };
			} catch (error) {
				if (
					error instanceof Error &&
					error.message === "Deployment not found"
				) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Deployment not found",
					});
				}

				console.error("Failed to delete deployment:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete deployment",
				});
			}
		},
	}),
};

export const stats = {
	/**
	 * Get system statistics
	 */
	getStats: defineAction({
		handler: async () => {
			try {
				const stats = await SystemStats.getStats();
				return stats;
			} catch (error) {
				console.error("Failed to get stats:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get stats",
				});
			}
		},
	}),
};

export const admin = {
	/**
	 * Cleanup old containers and networks
	 */
	cleanup: defineAction({
		handler: async () => {
			try {
				await Admin.cleanup();
				return { success: true, message: "Cleanup completed" };
			} catch (error) {
				console.error("Cleanup failed:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Cleanup failed",
				});
			}
		},
	}),
};
