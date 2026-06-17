import { describe, expect, it } from "vitest";
import type { QueueJob } from "@/server/db/schema";
import {
	getQueueJobDerivedError,
	getQueueJobDerivedState,
	isQueueJobExhausted,
} from "./job-state";

function buildJob(overrides: Partial<QueueJob>): QueueJob {
	const now = new Date();

	return {
		id: "job_1",
		type: "docker.composeUp",
		state: "queued",
		projectId: "project_1",
		payloadJson: "{}",
		priority: 0,
		attempts: 0,
		maxAttempts: 3,
		runAt: now,
		lockedAt: null,
		lockExpiresAt: null,
		lockedBy: null,
		dedupeKey: null,
		dedupeActive: null,
		healedAt: null,
		healReason: null,
		cancelRequestedAt: null,
		cancelledAt: null,
		lastError: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

describe("job-state", () => {
	describe("isQueueJobExhausted", () => {
		it("returns true for queued jobs at max attempts", () => {
			const job = buildJob({ attempts: 3, maxAttempts: 3, state: "queued" });
			expect(isQueueJobExhausted(job)).toBe(true);
			expect(getQueueJobDerivedState(job)).toBe("exhausted");
		});

		it("returns false for running jobs even at max attempts", () => {
			const job = buildJob({ attempts: 3, maxAttempts: 3, state: "running" });
			expect(isQueueJobExhausted(job)).toBe(false);
			expect(getQueueJobDerivedState(job)).toBe("running");
		});

		it("returns false for queued jobs with a lock owner", () => {
			const job = buildJob({
				attempts: 3,
				maxAttempts: 3,
				state: "queued",
				lockedBy: "worker_1",
			});
			expect(isQueueJobExhausted(job)).toBe(false);
			expect(getQueueJobDerivedState(job)).toBe("queued");
		});
	});

	describe("getQueueJobDerivedError", () => {
		it("uses lastError when present", () => {
			const job = buildJob({
				attempts: 3,
				maxAttempts: 3,
				lastError: "compose failed",
			});
			expect(getQueueJobDerivedError(job)).toBe("compose failed");
		});

		it("provides fallback for exhausted jobs without lastError", () => {
			const job = buildJob({ attempts: 3, maxAttempts: 3, state: "queued" });
			expect(getQueueJobDerivedError(job)).toBe(
				"Job exhausted all retry attempts before it could be marked failed.",
			);
		});

		it("returns null for non-exhausted jobs without lastError", () => {
			const job = buildJob({ attempts: 1, maxAttempts: 3, state: "queued" });
			expect(getQueueJobDerivedError(job)).toBeNull();
		});
	});
});
