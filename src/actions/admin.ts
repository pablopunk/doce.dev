import { defineAction, ActionError } from "astro:actions";
import { cleanupOldContainers, pruneDockerNetworks } from "@/lib/docker";

export const server = {
	// POST /api/admin/cleanup
	cleanup: defineAction({
		handler: async () => {
			try {
				await cleanupOldContainers();
				await pruneDockerNetworks();
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
