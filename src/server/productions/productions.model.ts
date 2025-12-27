import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { type Project, projects, queueJobs } from "@/server/db/schema";

export type ProductionStatus = Project["productionStatus"];

/**
 * Production queue job types
 */
const PRODUCTION_JOB_TYPES = [
	"production.build",
	"production.start",
	"production.waitReady",
	"production.stop",
] as const;

export type ProductionJobType = (typeof PRODUCTION_JOB_TYPES)[number];

/**
 * Active production job info returned to UI
 */
export interface ActiveProductionJob {
	type: ProductionJobType;
	state: "queued" | "running";
}

/**
 * Update production status for a project
 */
export async function updateProductionStatus(
	projectId: string,
	status: ProductionStatus,
	updates?: {
		productionPort?: number | null;
		productionUrl?: string | null;
		productionError?: string | null;
		productionStartedAt?: Date;
		productionHash?: string | null;
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
	if (updates?.productionHash !== undefined) {
		data.productionHash = updates.productionHash;
	}

	const result = await db
		.update(projects)
		.set(data)
		.where(eq(projects.id, projectId))
		.returning();

	return result[0] ?? null;
}

/**
 * Get active production job for a project (if any)
 * Returns the first active job in the production job chain
 */
export async function getActiveProductionJob(
	projectId: string,
): Promise<ActiveProductionJob | null> {
	const activeJob = await db
		.select()
		.from(queueJobs)
		.where(
			and(
				eq(queueJobs.projectId, projectId),
				inArray(queueJobs.type, PRODUCTION_JOB_TYPES as any),
				inArray(queueJobs.state, ["queued", "running"]),
			),
		)
		.orderBy(queueJobs.createdAt)
		.limit(1);

	if (!activeJob[0]) {
		return null;
	}

	return {
		type: activeJob[0].type as ProductionJobType,
		state: activeJob[0].state as "queued" | "running",
	};
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
