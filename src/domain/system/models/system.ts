/**
 * System Model
 * Handles system-level operations: stats, deployments, admin tasks
 */

import Docker from "dockerode";
import * as db from "@/lib/db";
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

export interface DeploymentData {
	id: string;
	project_id: string;
	container_id: string;
	url: string;
	status: string;
	created_at: string;
	updated_at: string;
}

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
		const deployment = db.getDeployment(id);
		if (!deployment) return null;

		const containerStatus = await getContainerStatus(
			(deployment as any).container_id,
		);

		return {
			...(deployment as DeploymentData),
			containerStatus,
		} as any;
	}

	/**
	 * Delete a deployment
	 */
	static async delete(id: string): Promise<void> {
		const deployment = db.getDeployment(id);
		if (!deployment) {
			throw new Error("Deployment not found");
		}

		await stopContainer((deployment as any).container_id);
		await removeContainer((deployment as any).container_id);
		db.updateDeployment(id, { status: "stopped" });
	}

	/**
	 * Get deployments for a project
	 */
	static getByProjectId(projectId: string): DeploymentData[] {
		return db.getDeployments(projectId) as DeploymentData[];
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
		const rawDb = db.getDatabase();

		const totalProjects = (
			rawDb.prepare("SELECT COUNT(*) as count FROM projects").get() as {
				count: number;
			}
		).count;

		const totalDeployments = (
			rawDb
				.prepare(
					"SELECT COUNT(*) as count FROM deployments WHERE status = 'running'",
				)
				.get() as { count: number }
		).count;

		const activePreviews = (
			rawDb
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
