import { and, eq } from "drizzle-orm";
import { db, sqlite } from "@/server/db/client";
import { type QueueJob, queueJobs } from "@/server/db/schema";
import { isQueuePaused } from "./queue.settings";

export interface ClaimOptions {
	workerId: string;
	leaseMs: number;
}

export async function heartbeatLease(
	jobId: string,
	workerId: string,
	leaseMs: number,
): Promise<boolean> {
	const now = new Date();
	const lockExpiresAt = new Date(Date.now() + leaseMs);

	const result = await db
		.update(queueJobs)
		.set({ lockExpiresAt, updatedAt: now })
		.where(
			and(
				eq(queueJobs.id, jobId),
				eq(queueJobs.state, "running"),
				eq(queueJobs.lockedBy, workerId),
			),
		)
		.returning({ id: queueJobs.id });

	return result.length > 0;
}

export async function claimNextJob(
	options: ClaimOptions,
): Promise<QueueJob | null> {
	if (await isQueuePaused()) {
		return null;
	}

	const nowMs = Date.now();
	const leaseExpiresMs = nowMs + options.leaseMs;

	const stmt = sqlite
		.prepare(
			`UPDATE queue_jobs
        SET state='running',
            locked_at=@now,
            lock_expires_at=@leaseExpires,
            locked_by=@workerId,
            updated_at=@now,
            attempts=attempts+1
        WHERE id = (
          SELECT id
          FROM queue_jobs
          WHERE state='queued'
            AND run_at <= @now
            AND attempts < max_attempts
            AND (lock_expires_at IS NULL OR lock_expires_at < @now)
            AND (
              project_id IS NULL
              OR NOT EXISTS (
                SELECT 1
                FROM queue_jobs r
                WHERE r.state='running'
                  AND r.project_id = queue_jobs.project_id
              )
            )
          ORDER BY priority DESC, run_at ASC, created_at ASC
          LIMIT 1
        )
        RETURNING
          id,
          type,
          state,
          project_id as projectId,
          payload_json as payloadJson,
          priority,
          attempts,
          max_attempts as maxAttempts,
          run_at as runAt,
          locked_at as lockedAt,
          lock_expires_at as lockExpiresAt,
          locked_by as lockedBy,
          dedupe_key as dedupeKey,
          dedupe_active as dedupeActive,
          cancel_requested_at as cancelRequestedAt,
          cancelled_at as cancelledAt,
          last_error as lastError,
          created_at as createdAt,
          updated_at as updatedAt
        ;`,
		)
		.get({
			now: nowMs,
			leaseExpires: leaseExpiresMs,
			workerId: options.workerId,
		}) as
		| (Omit<
				QueueJob,
				| "runAt"
				| "lockedAt"
				| "lockExpiresAt"
				| "cancelRequestedAt"
				| "cancelledAt"
				| "createdAt"
				| "updatedAt"
		  > & {
				runAt: number;
				lockedAt: number | null;
				lockExpiresAt: number | null;
				cancelRequestedAt: number | null;
				cancelledAt: number | null;
				createdAt: number;
				updatedAt: number;
		  })
		| undefined;

	if (!stmt) {
		return null;
	}

	return {
		...stmt,
		runAt: new Date(stmt.runAt),
		lockedAt: stmt.lockedAt ? new Date(stmt.lockedAt) : null,
		lockExpiresAt: stmt.lockExpiresAt ? new Date(stmt.lockExpiresAt) : null,
		cancelRequestedAt: stmt.cancelRequestedAt
			? new Date(stmt.cancelRequestedAt)
			: null,
		cancelledAt: stmt.cancelledAt ? new Date(stmt.cancelledAt) : null,
		createdAt: new Date(stmt.createdAt),
		updatedAt: new Date(stmt.updatedAt),
	};
}

export async function getRunningJobForProject(
	projectId: string,
): Promise<QueueJob | null> {
	const result = await db
		.select()
		.from(queueJobs)
		.where(
			and(eq(queueJobs.projectId, projectId), eq(queueJobs.state, "running")),
		)
		.limit(1);

	return result[0] ?? null;
}

export async function countActiveJobs(): Promise<number> {
	const result = sqlite
		.prepare(
			`SELECT COUNT(1) as count
       FROM queue_jobs
       WHERE state IN ('queued', 'running')`,
		)
		.get() as { count: number } | undefined;

	return result?.count ?? 0;
}
