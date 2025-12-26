import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { type Project, projects } from "@/server/db/schema";

export type ProductionStatus = Project["productionStatus"];

/**
 * Update production status for a project
 */
export async function updateProductionStatus(
	projectId: string,
	status: ProductionStatus,
	updates?: {
		productionPort?: number;
		productionUrl?: string;
		productionError?: string | null;
		productionStartedAt?: Date;
	},
): Promise<Project | null> {
	const data: Record<string, unknown> = {
		productionStatus: status,
	};

	if (updates?.productionPort !== undefined) {
		data.productionPort = updates.productionPort;
	}
	if (updates?.productionUrl !== undefined) {
		data.productionUrl = updates.productionUrl;
	}
	if (updates?.productionError !== undefined) {
		data.productionError = updates.productionError;
	}
	if (updates?.productionStartedAt !== undefined) {
		data.productionStartedAt = updates.productionStartedAt;
	}

	const result = await db
		.update(projects)
		.set(data)
		.where(eq(projects.id, projectId))
		.returning();

	return result[0] ?? null;
}

/**
 * Get production status for a project
 */
export function getProductionStatus(project: Project): {
	status: ProductionStatus;
	url: string | null;
	port: number | null;
	error: string | null;
	startedAt: Date | null;
} {
	return {
		status: project.productionStatus || "stopped",
		url: project.productionUrl,
		port: project.productionPort,
		error: project.productionError,
		startedAt: project.productionStartedAt
			? new Date(project.productionStartedAt)
			: null,
	};
}
