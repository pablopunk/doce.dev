import {
	type ComposeFailureKind,
	classifyComposeFailure,
} from "./composeFailure";

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

function assertKind(rawOutput: string, expected: ComposeFailureKind): void {
	const diagnostic = classifyComposeFailure(rawOutput);
	assertEqual(diagnostic.kind, expected);
}

test("classifies cloudflare docker blob timeout as registry timeout", () => {
	assertKind(
		"failed to do request: Get https://docker-images-prod.abc.r2.cloudflarestorage.com/blob: dial tcp 172.64.66.1:443: i/o timeout",
		"registry_timeout",
	);
});

test("classifies missing container errors", () => {
	assertKind("Error: No such container: doce_preview_1", "missing_container");
});

test("falls back to generic for unknown failures", () => {
	assertKind("Service 'preview' failed to build: Build failed", "generic");
});

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;

console.log(`\n${passed}/${results.length} tests passed`);

if (failed > 0) {
	process.exitCode = 1;
}
