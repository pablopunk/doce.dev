import { db, sqlite } from "@/server/db/client";
import { queueJobs, queueSettings, type QueueJob } from "@/server/db/schema";
import { and, desc, eq, like, or } from "drizzle-orm";
import { logger } from "@/server/logger";
import { queueJobTypeSchema, type QueueJobType } from "./types";

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
}

const QUEUE_SETTINGS_ROW_ID = 1;

export async function ensureQueueSettingsRow(): Promise<void> {
  const existing = await db
    .select({ id: queueSettings.id })
    .from(queueSettings)
    .where(eq(queueSettings.id, QUEUE_SETTINGS_ROW_ID))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await db.insert(queueSettings).values({
    id: QUEUE_SETTINGS_ROW_ID,
    paused: false,
    updatedAt: new Date(),
  });
}

export async function isQueuePaused(): Promise<boolean> {
  await ensureQueueSettingsRow();

  const result = await db
    .select({ paused: queueSettings.paused })
    .from(queueSettings)
    .where(eq(queueSettings.id, QUEUE_SETTINGS_ROW_ID))
    .limit(1);

  return result[0]?.paused ?? false;
}

export async function setQueuePaused(paused: boolean): Promise<void> {
  await ensureQueueSettingsRow();

  await db
    .update(queueSettings)
    .set({ paused, updatedAt: new Date() })
    .where(eq(queueSettings.id, QUEUE_SETTINGS_ROW_ID));
}

export async function enqueueJob<TPayload extends object>(
  input: EnqueueJobInput<TPayload>
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
        .where(and(eq(queueJobs.dedupeKey, input.dedupeKey), eq(queueJobs.dedupeActive, "active")))
        .limit(1);

      if (existing[0]) {
        return existing[0];
      }
    }

    throw err;
  }
}

export async function getJobById(jobId: string): Promise<QueueJob | null> {
  const result = await db
    .select()
    .from(queueJobs)
    .where(eq(queueJobs.id, jobId))
    .limit(1);

  return result[0] ?? null;
}

export async function retryJob(jobId: string, newJobId: string): Promise<QueueJob> {
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

export async function getJobCancelRequestedAt(jobId: string): Promise<Date | null> {
  const result = await db
    .select({ cancelRequestedAt: queueJobs.cancelRequestedAt })
    .from(queueJobs)
    .where(eq(queueJobs.id, jobId))
    .limit(1);

  return result[0]?.cancelRequestedAt ?? null;
}

export async function listJobs(filters: ListJobsFilters): Promise<QueueJob[]> {
  const whereParts = [];

  if (filters.state) {
    whereParts.push(eq(queueJobs.state, filters.state));
  }

  if (filters.type) {
    whereParts.push(eq(queueJobs.type, filters.type));
  }

  if (filters.projectId) {
    whereParts.push(eq(queueJobs.projectId, filters.projectId));
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    whereParts.push(or(like(queueJobs.payloadJson, pattern), like(queueJobs.lastError, pattern)));
  }

  const where = whereParts.length > 0 ? and(...whereParts) : undefined;

  return db
    .select()
    .from(queueJobs)
    .where(where)
    .orderBy(desc(queueJobs.createdAt))
    .limit(filters.limit ?? 100);
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

  return result[0] ?? null;
}

export async function requestCancel(jobId: string): Promise<QueueJob | null> {
  const now = new Date();

  const result = await db
    .update(queueJobs)
    .set({ cancelRequestedAt: now, updatedAt: now })
    .where(eq(queueJobs.id, jobId))
    .returning();

  return result[0] ?? null;
}

export async function runNow(jobId: string): Promise<QueueJob | null> {
  const now = new Date();

  const result = await db
    .update(queueJobs)
    .set({ runAt: now, updatedAt: now })
    .where(and(eq(queueJobs.id, jobId), eq(queueJobs.state, "queued")))
    .returning();

  return result[0] ?? null;
}

export async function forceUnlock(jobId: string): Promise<QueueJob | null> {
  const now = new Date();

  const result = await db
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
    .where(eq(queueJobs.id, jobId))
    .returning();

  return result[0] ?? null;
}

export async function heartbeatLease(
  jobId: string,
  workerId: string,
  leaseMs: number
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
        eq(queueJobs.lockedBy, workerId)
      )
    )
    .returning({ id: queueJobs.id });

  return result.length > 0;
}

export async function completeJob(jobId: string, workerId: string): Promise<void> {
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

export async function cancelRunningJob(jobId: string, workerId: string): Promise<void> {
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
  lastError: string
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

/**
 * Reschedule a job to run again later without incrementing attempts or setting error.
 * Used for "wait" jobs that need to poll until a condition is met.
 */
export async function rescheduleJob(
  jobId: string,
  workerId: string,
  delayMs: number
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
      // Note: attempts is NOT decremented - it was already incremented on claim.
      // But we don't set lastError, so this looks like a normal reschedule.
    })
    .where(and(eq(queueJobs.id, jobId), eq(queueJobs.lockedBy, workerId)));
}

export async function failJob(
  jobId: string,
  workerId: string,
  lastError: string
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

export async function claimNextJob(options: ClaimOptions): Promise<QueueJob | null> {
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
        ;`
    )
    .get({
      now: nowMs,
      leaseExpires: leaseExpiresMs,
      workerId: options.workerId,
    }) as
    | (Omit<QueueJob, "runAt" | "lockedAt" | "lockExpiresAt" | "cancelRequestedAt" | "cancelledAt" | "createdAt" | "updatedAt"> & {
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
    cancelRequestedAt: stmt.cancelRequestedAt ? new Date(stmt.cancelRequestedAt) : null,
    cancelledAt: stmt.cancelledAt ? new Date(stmt.cancelledAt) : null,
    createdAt: new Date(stmt.createdAt),
    updatedAt: new Date(stmt.updatedAt),
  };
}

export async function getRunningJobForProject(projectId: string): Promise<QueueJob | null> {
  const result = await db
    .select()
    .from(queueJobs)
    .where(and(eq(queueJobs.projectId, projectId), eq(queueJobs.state, "running")))
    .limit(1);

  return result[0] ?? null;
}

export async function countActiveJobs(): Promise<number> {
  const result = sqlite
    .prepare(
      `SELECT COUNT(1) as count
       FROM queue_jobs
       WHERE state IN ('queued', 'running')`
    )
    .get() as { count: number } | undefined;

  return result?.count ?? 0;
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
    "Queue job failed"
  );
}
