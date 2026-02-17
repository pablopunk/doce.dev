/**
 * Test script for OpenCode Diagnostics Module
 *
 * Run with: npx tsx src/server/opencode/diagnostics/test.ts
 */

import {
	classifyProxyResponse,
	classifySseError,
	classifyThrownError,
	createProxyDiagnostic,
	createSseDiagnostic,
	createThrownErrorDiagnostic,
	type OpencodeProxyError,
	REDACTION_PLACEHOLDER,
	sanitizeError,
	sanitizeHeaders,
	sanitizeObject,
} from "./index";

// ============================================================================
// Test Utilities
// ============================================================================

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
		console.log(`✅ ${name}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		results.push({ test: name, passed: false, error: errorMessage });
		console.log(`❌ ${name}: ${errorMessage}`);
	}
}

function assertEqual(
	actual: unknown,
	expected: unknown,
	message?: string,
): void {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error(
			message ||
				`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
		);
	}
}

function assertContains(
	haystack: string,
	needle: string,
	message?: string,
): void {
	if (!haystack.includes(needle)) {
		throw new Error(message || `Expected "${haystack}" to contain "${needle}"`);
	}
}

function assertNotContains(
	haystack: string,
	needle: string,
	message?: string,
): void {
	if (haystack.includes(needle)) {
		throw new Error(
			message || `Expected "${haystack}" NOT to contain "${needle}"`,
		);
	}
}

// ============================================================================
// Sanitize Tests
// ============================================================================

console.log("\n🧪 Testing Sanitize Module\n");

test("sanitizeObject strips apiKey field", () => {
	const input = {
		message: "Request failed",
		apiKey: "sk-1234567890abcdef",
		status: 500,
	};
	const result = sanitizeObject(input);
	assertEqual(result.apiKey, REDACTION_PLACEHOLDER);
	assertEqual(result.message, "Request failed");
	assertEqual(result.status, 500);
});

test("sanitizeObject strips authorization header", () => {
	const input = {
		headers: {
			authorization: "Bearer secret-token-123",
			"content-type": "application/json",
		},
	};
	const result = sanitizeObject(input);
	assertEqual(
		(result.headers as Record<string, string>).authorization,
		REDACTION_PLACEHOLDER,
	);
	assertEqual(
		(result.headers as Record<string, string>)["content-type"],
		"application/json",
	);
});

test("sanitizeObject strips nested sensitive fields", () => {
	const input = {
		config: {
			api_key: "secret123",
			timeout: 5000,
		},
		data: {
			token: "jwt-token-here",
			user: "john",
		},
	};
	const result = sanitizeObject(input);
	assertEqual(
		(result.config as Record<string, unknown>).api_key,
		REDACTION_PLACEHOLDER,
	);
	assertEqual((result.config as Record<string, unknown>).timeout, 5000);
	assertEqual(
		(result.data as Record<string, unknown>).token,
		REDACTION_PLACEHOLDER,
	);
	assertEqual((result.data as Record<string, unknown>).user, "john");
});

test("sanitizeObject strips secrets from strings", () => {
	const input = {
		url: "https://api.example.com?api_key=secret123&user=john",
		authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
	};
	const result = sanitizeObject(input);
	assertNotContains(
		result.url as string,
		"secret123",
		"URL should not contain api_key secret",
	);
	assertContains(
		result.url as string,
		REDACTION_PLACEHOLDER,
		"URL should have redacted placeholder",
	);
	assertNotContains(
		result.authHeader as string,
		"eyJhbGciOi",
		"Auth header should not contain JWT",
	);
});

test("sanitizeObject handles arrays", () => {
	const input = {
		items: [
			{ apiKey: "key1", name: "item1" },
			{ apiKey: "key2", name: "item2" },
		],
	};
	const result = sanitizeObject(input);
	const items = result.items as Array<Record<string, unknown>>;
	if (!items[0] || !items[1]) {
		throw new Error("Expected items to have at least 2 elements");
	}
	assertEqual(items[0].apiKey, REDACTION_PLACEHOLDER);
	assertEqual(items[0].name, "item1");
	assertEqual(items[1].apiKey, REDACTION_PLACEHOLDER);
	assertEqual(items[1].name, "item2");
});

test("sanitizeError handles Error objects", () => {
	const error = new Error("Something went wrong");
	(error as Error & { apiKey: string }).apiKey = "secret-key";
	const result = sanitizeError(error);
	assertEqual(result.message, "Something went wrong");
	assertEqual(result.name, "Error");
	assertEqual(result.apiKey, REDACTION_PLACEHOLDER);
	assertContains(result.stack as string, "Error: Something went wrong");
});

test("sanitizeHeaders redacts sensitive headers", () => {
	const headers = {
		Authorization: "Bearer token123",
		"X-API-Key": "secret-key",
		"Content-Type": "application/json",
		Cookie: "session=abc123",
	};
	const result = sanitizeHeaders(headers);
	assertEqual(result.Authorization, REDACTION_PLACEHOLDER);
	assertEqual(result["X-API-Key"], REDACTION_PLACEHOLDER);
	assertEqual(result["Content-Type"], "application/json");
	assertEqual(result.Cookie, REDACTION_PLACEHOLDER);
});

test("sanitizeObject respects allowKeys option", () => {
	const input = {
		token: "should-be-redacted",
		myToken: "should-be-allowed",
	};
	const result = sanitizeObject(input, { allowKeys: ["myToken"] });
	assertEqual(result.token, REDACTION_PLACEHOLDER);
	assertEqual(result.myToken, "should-be-allowed");
});

test("sanitizeObject respects maxDepth option", () => {
	const input = {
		level1: {
			level2: {
				level3: {
					level4: {
						apiKey: "secret",
					},
				},
			},
		},
	};
	const result = sanitizeObject(input, { maxDepth: 2 });
	assertEqual(
		(result.level1 as Record<string, unknown>).level2,
		"[Max Depth Reached]",
	);
});

// ============================================================================
// Classify Tests
// ============================================================================

console.log("\n🧪 Testing Classify Module\n");

test("classifySseError maps ProviderAuthError to auth", () => {
	const event = {
		type: "session.error" as const,
		properties: {
			error: {
				name: "ProviderAuthError" as const,
				data: {
					providerID: "openai",
					message: "Invalid API key",
				},
			},
		},
	};
	const result = classifySseError(event);
	assertEqual(result.category, "auth");
	assertEqual(result.confidence, "high");
});

test("classifySseError maps MessageAbortedError to timeout", () => {
	const event = {
		type: "session.error" as const,
		properties: {
			error: {
				name: "MessageAbortedError" as const,
				data: {
					message: "Request was aborted",
				},
			},
		},
	};
	const result = classifySseError(event);
	assertEqual(result.category, "timeout");
	assertEqual(result.confidence, "high");
});

test("classifySseError maps APIError with 429 to provider_model", () => {
	const event = {
		type: "session.error" as const,
		properties: {
			error: {
				name: "APIError" as const,
				data: {
					message: "Rate limited",
					statusCode: 429,
					isRetryable: true,
				},
			},
		},
	};
	const result = classifySseError(event);
	assertEqual(result.category, "provider_model");
	assertEqual(result.confidence, "high");
});

test("classifySseError returns unknown for invalid event", () => {
	const event = {
		type: "session.error" as const,
		properties: {},
	};
	const result = classifySseError(event);
	assertEqual(result.category, "unknown");
	assertEqual(result.confidence, "low");
});

test("classifyProxyResponse maps 401 to auth", () => {
	const response: OpencodeProxyError = {
		status: 401,
		error: "Unauthorized",
	};
	const result = classifyProxyResponse(response);
	assertEqual(result.category, "auth");
	assertEqual(result.confidence, "high");
});

test("classifyProxyResponse maps 502 to runtime_unreachable", () => {
	const response: OpencodeProxyError = {
		status: 502,
		error: "Bad Gateway",
	};
	const result = classifyProxyResponse(response);
	assertEqual(result.category, "runtime_unreachable");
	assertEqual(result.confidence, "high");
});

test("classifyProxyResponse uses upstreamStatus when available", () => {
	const response: OpencodeProxyError = {
		status: 502,
		error: "Bad Gateway",
		upstreamStatus: 429,
	};
	const result = classifyProxyResponse(response);
	assertEqual(result.category, "provider_model");
	assertEqual(result.confidence, "high");
});

test("classifyProxyResponse falls back for unmapped status", () => {
	const response: OpencodeProxyError = {
		status: 418, // I'm a teapot
		error: "I'm a teapot",
	};
	const result = classifyProxyResponse(response);
	assertEqual(result.category, "provider_model"); // 4xx fallback
	assertEqual(result.confidence, "low");
});

test("classifyThrownError recognizes ProviderAuthError", () => {
	const error = {
		name: "ProviderAuthError",
		data: {
			providerID: "openai",
			message: "Invalid key",
		},
	};
	const result = classifyThrownError(error);
	assertEqual(result.category, "auth");
	assertEqual(result.confidence, "high");
});

test("classifyThrownError recognizes AbortError", () => {
	const error = new Error("Request aborted");
	error.name = "AbortError";
	const result = classifyThrownError(error);
	assertEqual(result.category, "timeout");
	assertEqual(result.confidence, "high");
});

test("classifyThrownError recognizes connection errors by message", () => {
	const error = new Error("connect ECONNREFUSED 127.0.0.1:3000");
	const result = classifyThrownError(error);
	assertEqual(result.category, "runtime_unreachable");
	assertEqual(result.confidence, "medium");
});

test("classifyThrownError recognizes timeout by message", () => {
	const error = new Error("Request timeout after 30000ms");
	const result = classifyThrownError(error);
	assertEqual(result.category, "timeout");
	assertEqual(result.confidence, "medium");
});

test("classifyThrownError recognizes auth by message", () => {
	const error = new Error("401 Unauthorized: Invalid API key");
	const result = classifyThrownError(error);
	assertEqual(result.category, "auth");
	assertEqual(result.confidence, "medium");
});

test("classifyThrownError handles string errors", () => {
	const result = classifyThrownError("Rate limit exceeded");
	assertEqual(result.category, "provider_model");
	assertEqual(result.confidence, "medium");
});

test("classifyThrownError handles unknown types", () => {
	const result = classifyThrownError(null);
	assertEqual(result.category, "unknown");
	assertEqual(result.confidence, "low");
});

// ============================================================================
// Integration Tests
// ============================================================================

console.log("\n🧪 Testing Integration (Create Diagnostic)\n");

test("createSseDiagnostic creates sanitized diagnostic", () => {
	const event = {
		type: "session.error" as const,
		properties: {
			error: {
				name: "ProviderAuthError" as const,
				data: {
					providerID: "openai",
					message: "Invalid API key",
				},
			},
		},
	};
	const diagnostic = createSseDiagnostic(event, "project-123");
	assertEqual(diagnostic.category, "auth");
	assertEqual(diagnostic.title, "Authentication Failed");
	assertEqual(diagnostic.source, "sse");
	assertEqual(diagnostic.isRetryable, false);
	assertContains(
		JSON.stringify(diagnostic.remediation),
		"check_api_key",
		"Should include check_api_key remediation",
	);
});

test("createProxyDiagnostic creates sanitized diagnostic", () => {
	const response: OpencodeProxyError = {
		status: 429,
		error: "Rate limit exceeded",
	};
	const diagnostic = createProxyDiagnostic(response, "project-456");
	assertEqual(diagnostic.category, "provider_model");
	assertEqual(diagnostic.title, "Model Error");
	assertEqual(diagnostic.source, "proxy");
	assertEqual(diagnostic.isRetryable, true);
});

test("createThrownErrorDiagnostic handles SDK errors", () => {
	const error = {
		name: "MessageAbortedError",
		data: { message: "Request was aborted" },
	};
	const diagnostic = createThrownErrorDiagnostic(error, "project-789");
	assertEqual(diagnostic.category, "timeout");
	assertEqual(diagnostic.title, "Request Timed Out");
	assertEqual(diagnostic.source, "unknown");
});

test("createThrownErrorDiagnostic sanitizes error details", () => {
	const error = new Error("Connection failed");
	(error as Error & { apiKey: string }).apiKey = "secret-key";
	const diagnostic = createThrownErrorDiagnostic(error, "project-000");
	if (diagnostic.technicalDetails?.metadata) {
		const metadata = diagnostic.technicalDetails.metadata as Record<
			string,
			unknown
		>;
		assertEqual(metadata.apiKey, REDACTION_PLACEHOLDER);
	}
});

// ============================================================================
// Summary
// ============================================================================

console.log("\n📊 Test Summary\n");

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

console.log(`Total: ${results.length}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ❌`);

if (failed > 0) {
	console.log("\n❌ Failed tests:");
	for (const r of results.filter((r) => !r.passed)) {
		console.log(`  - ${r.test}: ${r.error}`);
	}
	process.exit(1);
} else {
	console.log("\n✅ All tests passed!");
	process.exit(0);
}
