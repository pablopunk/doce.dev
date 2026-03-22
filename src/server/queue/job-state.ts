import type { QueueJob } from "@/server/db/schema";

export type DerivedQueueJobState = QueueJob["state"] | "exhausted";

export function isQueueJobExhausted(job: QueueJob): boolean {
	return (
		job.state === "queued" &&
		job.attempts >= job.maxAttempts &&
		job.lockedBy === null
	);
}

export function getQueueJobDerivedState(job: QueueJob): DerivedQueueJobState {
	return isQueueJobExhausted(job) ? "exhausted" : job.state;
}

export function getQueueJobDerivedError(job: QueueJob): string | null {
	if (job.lastError) {
		return job.lastError;
	}

	if (isQueueJobExhausted(job)) {
		return "Job exhausted all retry attempts before it could be marked failed.";
	}

	return null;
}
