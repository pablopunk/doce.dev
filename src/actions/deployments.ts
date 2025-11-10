import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { getDeployment, updateDeployment } from "@/lib/db";
import {
	getContainerStatus,
	removeContainer,
	stopContainer,
} from "@/lib/docker";

export const server = {
	// GET /api/deployments/[id]
	getDeployment: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const deployment = await getDeployment(id);
				if (!deployment) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Deployment not found",
					});
				}

				const containerStatus = await getContainerStatus(
					(deployment as any).container_id,
				);
				return { ...deployment, containerStatus };
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

	// DELETE /api/deployments/[id]
	deleteDeployment: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const deployment = await getDeployment(id);
				if (!deployment) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Deployment not found",
					});
				}

				await stopContainer((deployment as any).container_id);
				await removeContainer((deployment as any).container_id);
				await updateDeployment(id, { status: "stopped" });

				return { success: true };
			} catch (error) {
				if (error instanceof ActionError) throw error;
				console.error("Failed to delete deployment:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete deployment",
				});
			}
		},
	}),
};
