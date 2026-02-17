import * as fs from "node:fs/promises";
import * as path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { type Project, projects, queueJobs } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { getProductionCurrentSymlink } from "@/server/projects/paths";

export type ProductionStatus = Project["productionStatus"];

/**
 * Production deployment state machine
 *
 * States: stopped → queued → building → running (success) | failed
 *
 * Active states (queued, building) block new deployments.
 * Terminal states (running, failed, stopped) allow new deployments.
 */
export const PRODUCTION_STATES = [
	"queued",
	"building",
	"running",
	"failed",
	"stopped",
] as const;

export const ACTIVE_DEPLOYMENT_STATES: readonly ProductionStatus[] = [
	"queued",
	"building",
];

export const TERMINAL_DEPLOYMENT_STATES: readonly ProductionStatus[] = [
	"running",
	"failed",
	"stopped",
];

export const VALID_PRODUCTION_TRANSITIONS: Record<
	ProductionStatus,
	readonly ProductionStatus[]
> = {
	stopped: ["queued"],
	queued: ["building", "failed"],
	building: ["running", "failed"],
	running: ["queued", "stopped", "failed"],
	failed: ["queued"],
};

export function isDeploymentActive(status: ProductionStatus): boolean {
	return (ACTIVE_DEPLOYMENT_STATES as readonly string[]).includes(status);
}

export function isValidTransition(
	from: ProductionStatus,
	to: ProductionStatus,
): boolean {
	return (VALID_PRODUCTION_TRANSITIONS[from] as readonly string[]).includes(to);
}

export async function hasActiveDeployment(projectId: string): Promise<boolean> {
	const result = await db
		.select({ productionStatus: projects.productionStatus })
		.from(projects)
		.where(eq(projects.id, projectId))
		.limit(1);

	if (!result[0]) return false;
	return isDeploymentActive(result[0].productionStatus);
}

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

export async function cancelActiveProductionJobs(
	projectId: string,
): Promise<void> {
	const activeJobs = await db
		.select()
		.from(queueJobs)
		.where(
			and(
				eq(queueJobs.projectId, projectId),
				inArray(queueJobs.type, [...PRODUCTION_JOB_TYPES]),
				inArray(queueJobs.state, ["queued", "running"]),
			),
		);

	const now = new Date();
	for (const job of activeJobs) {
		if (job.state === "queued") {
			await db
				.update(queueJobs)
				.set({
					state: "cancelled",
					cancelledAt: now,
					cancelRequestedAt: now,
					dedupeActive: null,
					updatedAt: now,
				})
				.where(and(eq(queueJobs.id, job.id), eq(queueJobs.state, "queued")));
			logger.info(
				{ jobId: job.id, type: job.type, projectId },
				"Cancelled queued production job",
			);
		} else if (job.state === "running") {
			await db
				.update(queueJobs)
				.set({ cancelRequestedAt: now, updatedAt: now })
				.where(eq(queueJobs.id, job.id));
			logger.info(
				{ jobId: job.id, type: job.type, projectId },
				"Requested cancellation of running production job",
			);
		}
	}
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
		productionBasePort?: number | null;
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
	if (updates?.productionBasePort !== undefined) {
		data.productionBasePort = updates.productionBasePort;
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
				// PRODUCTION_JOB_TYPES is const-asserted tuple; Drizzle's inArray needs proper typing
				inArray(queueJobs.type, [...PRODUCTION_JOB_TYPES]),
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

/**
 * Get the hash of the previous release from the current symlink.
 * Returns null if no symlink exists or if the symlink points to the same
 * hash as the failed deployment (no previous to rollback to).
 * Bounded to one level — only the immediate previous release.
 */
export async function getPreviousReleaseHash(
	projectId: string,
	failedHash: string,
): Promise<string | null> {
	const symlinkPath = getProductionCurrentSymlink(projectId);
	try {
		const target = await fs.readlink(symlinkPath);
		const previousHash = path.basename(target);
		if (previousHash && previousHash !== failedHash) {
			return previousHash;
		}
		return null;
	} catch {
		return null;
	}
}
