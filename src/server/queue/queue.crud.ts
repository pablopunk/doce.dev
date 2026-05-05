import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { type QueueJob, queueJobs } from "@/server/db/schema";
import { emitQueueEvent } from "./events";
import { enqueueJob } from "./queue.model";
import { type QueueJobType, queueJobTypeSchema } from "./types";

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

export interface ListJobsFilters {
	state?: QueueJobState | undefined;
	type?: QueueJobType | string | undefined;
	projectId?: string | undefined;
	q?: string | undefined;
	limit?: number | undefined;
	offset?: number | undefined;
}

export async function getJobById(jobId: string): Promise<QueueJob | null> {
	const result = await db
		.select()
		.from(queueJobs)
		.where(eq(queueJobs.id, jobId))
		.limit(1);

	return result[0] ?? null;
}

export async function retryJob(
	jobId: string,
	newJobId: string,
): Promise<QueueJob> {
	const job = await getJobById(jobId);
	if (!job) {
		throw new Error("Job not found");
	}

	const type = queueJobTypeSchema.parse(job.type);
	const payload = JSON.parse(job.payloadJson) as object;

	const input: EnqueueJobInput<object> = {
		id: newJobId,
		type,
		payload,
		priority: job.priority,
		maxAttempts: job.maxAttempts,
	};

	if (job.projectId) {
		input.projectId = job.projectId;
	}

	if (job.dedupeKey) {
		input.dedupeKey = job.dedupeKey;
	}

	return enqueueJob(input);
}

export async function getJobCancelRequestedAt(
	jobId: string,
): Promise<Date | null> {
	const result = await db
		.select({ cancelRequestedAt: queueJobs.cancelRequestedAt })
		.from(queueJobs)
		.where(eq(queueJobs.id, jobId))
		.limit(1);

	return result[0]?.cancelRequestedAt ?? null;
}

function buildJobsWhere(filters: Omit<ListJobsFilters, "limit" | "offset">) {
	const parts = [];

	if (filters.state) parts.push(eq(queueJobs.state, filters.state));
	if (filters.type) parts.push(eq(queueJobs.type, filters.type));
	if (filters.projectId) parts.push(eq(queueJobs.projectId, filters.projectId));

	if (filters.q) {
		const pattern = `%${filters.q}%`;
		parts.push(
			or(
				like(queueJobs.payloadJson, pattern),
				like(queueJobs.lastError, pattern),
			),
		);
	}

	return parts.length > 0 ? and(...parts) : undefined;
}

export async function countJobs(
	filters: Omit<ListJobsFilters, "limit" | "offset">,
): Promise<number> {
	const result = await db
		.select({ count: sql`COUNT(*)` })
		.from(queueJobs)
		.where(buildJobsWhere(filters));

	return (result[0]?.count as number) ?? 0;
}

export async function listJobs(filters: ListJobsFilters): Promise<QueueJob[]> {
	return db
		.select()
		.from(queueJobs)
		.where(buildJobsWhere(filters))
		.orderBy(desc(queueJobs.createdAt))
		.limit(filters.limit ?? 100)
		.offset(filters.offset ?? 0);
}

export async function cancelQueuedJob(jobId: string): Promise<QueueJob | null> {
	const now = new Date();

	const result = await db
		.update(queueJobs)
		.set({
			state: "cancelled",
			cancelledAt: now,
			cancelRequestedAt: now,
			dedupeActive: null,
			lockedAt: null,
			lockExpiresAt: null,
			lockedBy: null,
			updatedAt: now,
		})
		.where(and(eq(queueJobs.id, jobId), eq(queueJobs.state, "queued")))
		.returning();

	const job = result[0] ?? null;
	if (job) {
		emitQueueEvent({
			jobId: job.id,
			projectId: job.projectId,
			type: job.type,
			state: job.state,
		});
	}

	return job;
}

export async function deleteJob(jobId: string): Promise<number> {
	const result = await db
		.delete(queueJobs)
		.where(
			and(
				eq(queueJobs.id, jobId),
				sql`state IN ('succeeded', 'failed', 'cancelled')`,
			),
		)
		.returning({ id: queueJobs.id });

	if (result.length > 0) {
		emitQueueEvent({ jobId, settingsChanged: true });
	}

	return result.length;
}

export async function deleteJobsByState(state: QueueJobState): Promise<number> {
	const terminalStates = ["succeeded", "failed", "cancelled"] as const;
	if (!terminalStates.includes(state as (typeof terminalStates)[number])) {
		throw new Error(`Cannot delete jobs in state: ${state}`);
	}

	const result = await db
		.delete(queueJobs)
		.where(eq(queueJobs.state, state))
		.returning({ id: queueJobs.id });

	if (result.length > 0) {
		emitQueueEvent({ settingsChanged: true, state });
	}

	return result.length;
}
