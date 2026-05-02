/**
 * Queue job self-healing reconciliation
 *
 * Detects and fixes:
 * - Orphaned running jobs (worker died, lease expired)
 * - Impossible queued jobs (attempts >= maxAttempts but still queued)
 * - Dedupe leaks (dedupeActive set but job is completed)
 * - Stale completed jobs (older than retention period)
 */

import { and, eq, gt, isNotNull, lt, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { queueJobs } from "@/server/db/schema";
import { logger } from "@/server/logger";
import type { HealingAction, Violation } from "./types";

const COMPLETED_JOB_RETENTION_DAYS = 7;
const FAILED_JOB_RETENTION_DAYS = 7;
const CANCELLED_JOB_RETENTION_DAYS = 7;

/**
 * Fix orphaned running jobs (expired lease).
 * These happen when a worker crashes with a claimed job.
 */
export async function fixOrphanedRunningJobs(): Promise<{
	violations: Violation[];
	actions: HealingAction[];
}> {
	const violations: Violation[] = [];
	const actions: HealingAction[] = [];

	const now = new Date();

	const orphaned = await db
		.select()
		.from(queueJobs)
		.where(
			and(eq(queueJobs.state, "running"), lt(queueJobs.lockExpiresAt, now)),
		);

	if (orphaned.length === 0) {
		return { violations, actions };
	}

	logger.warn(
		{ count: orphaned.length },
		"Found orphaned running jobs with expired leases",
	);

	for (const job of orphaned) {
		violations.push({
			entityType: "queueJob",
			entityId: job.id,
			violationType: "queue.job.orphaned",
			description: `Job ${job.type} has expired lease (expired at ${job.lockExpiresAt})`,
			severity: "high",
			suggestedAction: "queue.reset.orphaned",
			context: {
				jobId: job.id,
				jobType: job.type,
				lockedBy: job.lockedBy,
				lockExpiresAt: job.lockExpiresAt,
			},
		});
	}

	await db
		.update(queueJobs)
		.set({
			state: "queued",
			lockedAt: null,
			lockExpiresAt: null,
			lockedBy: null,
			healedAt: now,
			healReason: "orphaned",
			updatedAt: now,
		})
		.where(
			and(eq(queueJobs.state, "running"), lt(queueJobs.lockExpiresAt, now)),
		);

	for (const violation of violations) {
		actions.push({
			violationId: `${violation.entityId}:${violation.violationType}`,
			action: "queue.reset.orphaned",
			timestamp: now,
			success: true,
		});
	}

	logger.info(
		{ count: orphaned.length },
		"Fixed orphaned running jobs by resetting to queued",
	);

	return { violations, actions };
}

/**
 * Fix impossible queued jobs (attempts >= maxAttempts but still queued).
 * These jobs will never run and should be marked failed.
 */
export async function fixImpossibleQueuedJobs(): Promise<{
	violations: Violation[];
	actions: HealingAction[];
}> {
	const violations: Violation[] = [];
	const actions: HealingAction[] = [];

	const now = new Date();

	const impossible = await db
		.select()
		.from(queueJobs)
		.where(
			and(
				eq(queueJobs.state, "queued"),
				ne(queueJobs.attempts, 0),
				gt(queueJobs.attempts, queueJobs.maxAttempts),
			),
		);

	if (impossible.length === 0) {
		return { violations, actions };
	}

	logger.warn(
		{ count: impossible.length },
		"Found impossible queued jobs that will never run",
	);

	for (const job of impossible) {
		violations.push({
			entityType: "queueJob",
			entityId: job.id,
			violationType: "queue.job.impossible",
			description: `Job ${job.type} has ${job.attempts} attempts but max is ${job.maxAttempts}`,
			severity: "high",
			suggestedAction: "queue.fail.impossible",
			context: {
				jobId: job.id,
				jobType: job.type,
				attempts: job.attempts,
				maxAttempts: job.maxAttempts,
			},
		});
	}

	await db
		.update(queueJobs)
		.set({
			state: "failed",
			lastError: "Exceeded max attempts, job is impossible",
			healedAt: now,
			healReason: "impossible",
			updatedAt: now,
		})
		.where(
			and(
				eq(queueJobs.state, "queued"),
				gt(queueJobs.attempts, queueJobs.maxAttempts),
			),
		);

	for (const violation of violations) {
		actions.push({
			violationId: `${violation.entityId}:${violation.violationType}`,
			action: "queue.fail.impossible",
			timestamp: now,
			success: true,
		});
	}

	logger.info(
		{ count: impossible.length },
		"Fixed impossible jobs by marking failed",
	);

	return { violations, actions };
}

/**
 * Fix dedupe leaks: jobs with dedupeActive set but state is not queued/running.
 * These prevent new deduped jobs from being enqueued.
 */
export async function fixDedupeLeaks(): Promise<{
	violations: Violation[];
	actions: HealingAction[];
}> {
	const violations: Violation[] = [];
	const actions: HealingAction[] = [];

	const now = new Date();

	const leaks = await db
		.select()
		.from(queueJobs)
		.where(
			and(
				isNotNull(queueJobs.dedupeActive),
				ne(queueJobs.state, "queued"),
				ne(queueJobs.state, "running"),
			),
		);

	if (leaks.length === 0) {
		return { violations, actions };
	}

	logger.warn(
		{ count: leaks.length },
		"Found dedupe leaks blocking new enqueues",
	);

	for (const job of leaks) {
		violations.push({
			entityType: "queueJob",
			entityId: job.id,
			violationType: "queue.dedupe.leak",
			description: `Job ${job.type} (${job.state}) still has dedupeActive set (key: ${job.dedupeKey})`,
			severity: "medium",
			suggestedAction: "queue.clear.dedupe",
			context: {
				jobId: job.id,
				jobType: job.type,
				state: job.state,
				dedupeKey: job.dedupeKey,
			},
		});
	}

	await db
		.update(queueJobs)
		.set({
			dedupeActive: null,
			healedAt: now,
			healReason: "dedupe_leak",
			updatedAt: now,
		})
		.where(
			and(
				isNotNull(queueJobs.dedupeActive),
				ne(queueJobs.state, "queued"),
				ne(queueJobs.state, "running"),
			),
		);

	for (const violation of violations) {
		actions.push({
			violationId: `${violation.entityId}:${violation.violationType}`,
			action: "queue.clear.dedupe",
			timestamp: now,
			success: true,
		});
	}

	logger.info({ count: leaks.length }, "Fixed dedupe leaks");

	return { violations, actions };
}

/**
 * Delete stale completed jobs to prevent DB from growing unbounded.
 */
export async function purgeStaleCompletedJobs(): Promise<{
	violations: Violation[];
	actions: HealingAction[];
}> {
	const violations: Violation[] = [];
	const actions: HealingAction[] = [];

	const now = new Date();
	const purgeConfigs = [
		{ state: "succeeded" as const, days: COMPLETED_JOB_RETENTION_DAYS },
		{ state: "failed" as const, days: FAILED_JOB_RETENTION_DAYS },
		{ state: "cancelled" as const, days: CANCELLED_JOB_RETENTION_DAYS },
	];

	for (const { state, days } of purgeConfigs) {
		const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

		await db
			.delete(queueJobs)
			.where(and(eq(queueJobs.state, state), lt(queueJobs.updatedAt, cutoff)));

		logger.debug({ state, days }, "Purged stale completed jobs");
	}

	return { violations, actions };
}

/**
 * Run all queue reconciliation checks.
 */
export async function reconcileQueue(): Promise<{
	violations: Violation[];
	actions: HealingAction[];
}> {
	const allViolations: Violation[] = [];
	const allActions: HealingAction[] = [];

	const checks = [
		fixOrphanedRunningJobs(),
		fixImpossibleQueuedJobs(),
		fixDedupeLeaks(),
		purgeStaleCompletedJobs(),
	];

	const results = await Promise.all(checks);

	for (const result of results) {
		allViolations.push(...result.violations);
		allActions.push(...result.actions);
	}

	return {
		violations: allViolations,
		actions: allActions,
	};
}
