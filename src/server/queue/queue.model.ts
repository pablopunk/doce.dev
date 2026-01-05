import { db } from "@/server/db/client";
import { type QueueJob, queueJobs } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { type QueueJobType, queueJobTypeSchema } from "./types";

export * from "./queue.claim";
export * from "./queue.crud";
export * from "./queue.lifecycle";
// Re-export queue functionality from focused modules for backward compatibility
export * from "./queue.settings";

export type QueueJobState = QueueJob["state"];

export interface EnqueueJobInput<TPayload extends object> {
	id: string;
	type: QueueJobType;
	payload: TPayload;
	projectId?: string;
	priority?: number;
	runAt?: Date;
	maxAttempts?: number;
	dedupeKey?: string;
}

export interface ClaimOptions {
	workerId: string;
	leaseMs: number;
}

export interface ListJobsFilters {
	state?: QueueJobState;
	type?: QueueJobType;
	projectId?: string;
	q?: string;
	limit?: number;
	offset?: number;
}

export async function enqueueJob<TPayload extends object>(
	input: EnqueueJobInput<TPayload>,
): Promise<QueueJob> {
	const now = new Date();

	try {
		const result = await db
			.insert(queueJobs)
			.values({
				id: input.id,
				type: input.type,
				state: "queued",
				projectId: input.projectId,
				payloadJson: JSON.stringify(input.payload),
				priority: input.priority ?? 0,
				attempts: 0,
				maxAttempts: input.maxAttempts ?? 3,
				runAt: input.runAt ?? now,
				lockedAt: null,
				lockExpiresAt: null,
				lockedBy: null,
				dedupeKey: input.dedupeKey,
				dedupeActive: input.dedupeKey ? "active" : null,
				cancelRequestedAt: null,
				cancelledAt: null,
				lastError: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		const job = result[0];
		if (!job) {
			throw new Error("Failed to enqueue job");
		}

		return job;
	} catch (err) {
		if (input.dedupeKey) {
			const existing = await db
				.select()
				.from(queueJobs)
				.where(
					and(
						eq(queueJobs.dedupeKey, input.dedupeKey),
						eq(queueJobs.dedupeActive, "active"),
					),
				)
				.limit(1);

			if (existing[0]) {
				return existing[0];
			}
		}

		throw err;
	}
}

export function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

export function logJobFailure(job: QueueJob, error: unknown): void {
	logger.error(
		{ error, jobId: job.id, type: job.type, projectId: job.projectId },
		"Queue job failed",
	);
}

export async function cancelEnsureRunningForProject(
	projectId: string,
): Promise<void> {
	const jobs = await listJobs({
		projectId,
		type: "docker.ensureRunning",
	});

	for (const job of jobs) {
		if (job.state === "queued") {
			await cancelQueuedJob(job.id);
			logger.info(
				{ jobId: job.id, projectId, reason: "docker.stop enqueued" },
				"Cancelled queued docker.ensureRunning job",
			);
		} else if (job.state === "running") {
			await requestCancel(job.id);
			logger.info(
				{ jobId: job.id, projectId, reason: "docker.stop enqueued" },
				"Requested cancellation of running docker.ensureRunning job",
			);
		}
	}
}
