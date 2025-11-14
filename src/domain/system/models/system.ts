/**
 * System Model
 * Handles system-level operations: stats, deployments, admin tasks
 */

import Docker from "dockerode";
import * as db from "@/lib/db";
import type { DeploymentInDatabase } from "@/lib/db/providers/drizzle/schema";
import {
	getContainerStatus,
	removeContainer,
	stopContainer,
	cleanupOldContainers,
	pruneDockerNetworks,
} from "@/lib/docker";

const docker = new Docker({
	socketPath: process.env.DOCKER_HOST || "/var/run/docker.sock",
});

export type DeploymentData = DeploymentInDatabase;

export interface SystemStats {
	totalProjects: number;
	totalDeployments: number;
	activePreviews: number;
	totalContainers: number;
}

/**
 * Deployment Model
 */
export class Deployment {
	/**
	 * Get deployment by ID
	 */
	static async getById(id: string): Promise<DeploymentData | null> {
		const deployment = db.deployments.getById(id);
		if (!deployment) return null;

		const containerStatus = await getContainerStatus(
			deployment.containerId ?? "",
		);

		return {
			...deployment,
			containerStatus,
		} as any;
	}

	/**
	 * Delete a deployment
	 */
	static async delete(id: string): Promise<void> {
		const deployment = db.deployments.getById(id);
		if (!deployment) {
			throw new Error("Deployment not found");
		}

		await stopContainer(deployment.containerId ?? "");
		await removeContainer(deployment.containerId ?? "");
		db.deployments.update(id, { status: "stopped" });
	}

	/**
	 * Get deployments for a project
	 */
	static getByProjectId(projectId: string): DeploymentData[] {
		return db.deployments.getByProjectId(projectId);
	}
}

/**
 * System Stats Model
 */
export class SystemStats {
	/**
	 * Get system-wide statistics
	 */
	static async getStats(): Promise<SystemStats> {
		const totalProjects = (
			db.sqlite.prepare("SELECT COUNT(*) as count FROM projects").get() as {
				count: number;
			}
		).count;

		const totalDeployments = (
			db.sqlite
				.prepare(
					"SELECT COUNT(*) as count FROM deployments WHERE status = 'running'",
				)
				.get() as { count: number }
		).count;

		const activePreviews = (
			db.sqlite
				.prepare(
					"SELECT COUNT(*) as count FROM projects WHERE preview_url IS NOT NULL",
				)
				.get() as { count: number }
		).count;

		const containers = await docker.listContainers();
		const totalContainers = containers.filter(
			(c) => c.Labels && c.Labels["doce.project.id"],
		).length;

		return {
			totalProjects,
			totalDeployments,
			activePreviews,
			totalContainers,
		};
	}
}

/**
 * Admin operations
 */
export class Admin {
	/**
	 * Cleanup old containers and networks
	 */
	static async cleanup(): Promise<void> {
		await cleanupOldContainers();
		await pruneDockerNetworks();
	}
}
