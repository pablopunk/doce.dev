import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { queueJobs } from "@/server/db/schema";

export async function completeJob(
	jobId: string,
	workerId: string,
): Promise<void> {
	const now = new Date();

	await db
		.update(queueJobs)
		.set({
			state: "succeeded",
			dedupeActive: null,
			lockedAt: null,
			lockExpiresAt: null,
			lockedBy: null,
			updatedAt: now,
		})
		.where(and(eq(queueJobs.id, jobId), eq(queueJobs.lockedBy, workerId)));
}

export async function cancelRunningJob(
	jobId: string,
	workerId: string,
): Promise<void> {
	const now = new Date();

	await db
		.update(queueJobs)
		.set({
			state: "cancelled",
			cancelledAt: now,
			dedupeActive: null,
			lockedAt: null,
			lockExpiresAt: null,
			lockedBy: null,
			updatedAt: now,
		})
		.where(and(eq(queueJobs.id, jobId), eq(queueJobs.lockedBy, workerId)));
}

export async function scheduleRetry(
	jobId: string,
	workerId: string,
	delayMs: number,
	lastError: string,
): Promise<void> {
	const now = new Date();

	await db
		.update(queueJobs)
		.set({
			state: "queued",
			runAt: new Date(Date.now() + delayMs),
			lastError,
			lockedAt: null,
			lockExpiresAt: null,
			lockedBy: null,
			updatedAt: now,
		})
		.where(and(eq(queueJobs.id, jobId), eq(queueJobs.lockedBy, workerId)));
}

export async function rescheduleJob(
	jobId: string,
	workerId: string,
	delayMs: number,
): Promise<void> {
	const now = new Date();

	await db
		.update(queueJobs)
		.set({
			state: "queued",
			runAt: new Date(Date.now() + delayMs),
			lockedAt: null,
			lockExpiresAt: null,
			lockedBy: null,
			updatedAt: now,
			attempts: sql`attempts - 1`,
		})
		.where(and(eq(queueJobs.id, jobId), eq(queueJobs.lockedBy, workerId)));
}

export async function failJob(
	jobId: string,
	workerId: string,
	lastError: string,
): Promise<void> {
	const now = new Date();

	await db
		.update(queueJobs)
		.set({
			state: "failed",
			lastError,
			dedupeActive: null,
			lockedAt: null,
			lockExpiresAt: null,
			lockedBy: null,
			updatedAt: now,
		})
		.where(and(eq(queueJobs.id, jobId), eq(queueJobs.lockedBy, workerId)));
}

export async function requestCancel(jobId: string): Promise<void> {
	const now = new Date();

	await db
		.update(queueJobs)
		.set({ cancelRequestedAt: now, updatedAt: now })
		.where(eq(queueJobs.id, jobId));
}

export async function runNow(jobId: string): Promise<void> {
	const now = new Date();

	await db
		.update(queueJobs)
		.set({ runAt: now, updatedAt: now })
		.where(and(eq(queueJobs.id, jobId), eq(queueJobs.state, "queued")));
}

export async function forceUnlock(jobId: string): Promise<void> {
	const now = new Date();

	await db
		.update(queueJobs)
		.set({
			state: "failed",
			lastError: "force-unlocked by admin",
			dedupeActive: null,
			lockedAt: null,
			lockExpiresAt: null,
			lockedBy: null,
			updatedAt: now,
		})
		.where(eq(queueJobs.id, jobId));
}

export async function recoverExpiredJobs(): Promise<void> {
	const now = new Date();

	await db
		.update(queueJobs)
		.set({
			state: "queued",
			lockedAt: null,
			lockExpiresAt: null,
			lockedBy: null,
			updatedAt: now,
		})
		.where(
			and(eq(queueJobs.state, "running"), lt(queueJobs.lockExpiresAt, now)),
		);
}
