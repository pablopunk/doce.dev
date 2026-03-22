import type { QueueJob } from "@/server/db/schema";
import {
	getQueueJobDerivedError,
	getQueueJobDerivedState,
	isQueueJobExhausted,
} from "./job-state";

interface TestResult {
	test: string;
	passed: boolean;
	error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
	try {
		fn();
		results.push({ test: name, passed: true });
		console.log(`PASS ${name}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		results.push({ test: name, passed: false, error: message });
		console.log(`FAIL ${name}: ${message}`);
	}
}

function assertEqual(actual: unknown, expected: unknown): void {
	if (actual !== expected) {
		throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
	}
}

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
		cancelRequestedAt: null,
		cancelledAt: null,
		lastError: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

test("queued jobs at max attempts are exhausted", () => {
	const job = buildJob({ attempts: 3, maxAttempts: 3, state: "queued" });
	assertEqual(isQueueJobExhausted(job), true);
	assertEqual(getQueueJobDerivedState(job), "exhausted");
});

test("running jobs are not exhausted", () => {
	const job = buildJob({ attempts: 3, maxAttempts: 3, state: "running" });
	assertEqual(isQueueJobExhausted(job), false);
	assertEqual(getQueueJobDerivedState(job), "running");
});

test("queued jobs with lock owner are not exhausted", () => {
	const job = buildJob({
		attempts: 3,
		maxAttempts: 3,
		state: "queued",
		lockedBy: "worker_1",
	});
	assertEqual(isQueueJobExhausted(job), false);
	assertEqual(getQueueJobDerivedState(job), "queued");
});

test("derived error uses lastError when present", () => {
	const job = buildJob({
		attempts: 3,
		maxAttempts: 3,
		lastError: "compose failed",
	});
	assertEqual(getQueueJobDerivedError(job), "compose failed");
});

test("derived error provides fallback for exhausted jobs", () => {
	const job = buildJob({ attempts: 3, maxAttempts: 3, state: "queued" });
	assertEqual(
		getQueueJobDerivedError(job),
		"Job exhausted all retry attempts before it could be marked failed.",
	);
});

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;

console.log(`\n${passed}/${results.length} tests passed`);

if (failed > 0) {
	process.exitCode = 1;
}
