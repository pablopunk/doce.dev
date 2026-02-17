import type { EventSessionError } from "@opencode-ai/sdk/v2/client";
import { sanitizeError, sanitizeObject } from "./sanitize";
import {
	classifyOpencodeError,
	createOpencodeDiagnostic,
	isApiError,
	isMessageAbortedError,
	isMessageOutputLengthError,
	isProviderAuthError,
	isSessionErrorEvent,
	isUnknownError,
	OPENCODE_ERROR_CATEGORY_METADATA,
	type OpencodeDiagnostic,
	type OpencodeErrorCategory,
	type OpencodeErrorSource,
	type OpencodeProxyError,
	PROXY_STATUS_TO_CATEGORY,
	SDK_ERROR_NAME_TO_CATEGORY,
} from "./types";

/**
 * Classification result containing category and confidence.
 */
export interface ClassificationResult {
	category: OpencodeErrorCategory;
	confidence: "high" | "medium" | "low";
	reason: string;
}

/**
 * Classifies an SSE session.error event into a taxonomy category.
 *
 * @param event - The EventSessionError from SSE stream
 * @returns Classification result with category and confidence
 */
export function classifySseError(
	event: EventSessionError,
): ClassificationResult {
	// Validate event structure
	if (!isSessionErrorEvent(event)) {
		return {
			category: "unknown",
			confidence: "low",
			reason: "Invalid SSE event structure - missing type or properties",
		};
	}

	const error = event.properties.error;

	// No error in properties
	if (!error) {
		return {
			category: "unknown",
			confidence: "low",
			reason: "SSE event has no error in properties",
		};
	}

	// Use SDK error name mapping
	const category = SDK_ERROR_NAME_TO_CATEGORY[error.name];

	if (category) {
		return {
			category,
			confidence: "high",
			reason: `SSE error mapped from SDK error name: ${error.name}`,
		};
	}

	// Fallback: check for APIError with status code
	if (isApiError(error)) {
		const statusCode = error.data.statusCode;
		if (statusCode) {
			const statusCategory = PROXY_STATUS_TO_CATEGORY[statusCode];
			if (statusCategory) {
				return {
					category: statusCategory,
					confidence: "high",
					reason: `APIError with status code ${statusCode} mapped to ${statusCategory}`,
				};
			}
		}
	}

	// Unknown error type
	return {
		category: "unknown",
		confidence: "medium",
		reason: `Unrecognized error type in SSE event: ${error.name ?? "unnamed"}`,
	};
}

/**
 * Classifies a proxy error response into a taxonomy category.
 *
 * @param response - The proxy error response
 * @returns Classification result with category and confidence
 */
export function classifyProxyResponse(
	response: OpencodeProxyError,
): ClassificationResult {
	const { status, error, upstreamStatus } = response;

	// Use upstream status if available (more specific)
	const effectiveStatus = upstreamStatus ?? status;

	// Map status code to category
	const category = PROXY_STATUS_TO_CATEGORY[effectiveStatus];

	if (category) {
		return {
			category,
			confidence: "high",
			reason: `HTTP status ${effectiveStatus} mapped to ${category}`,
		};
	}

	// Fallback: analyze error message for patterns
	if (typeof error === "string") {
		const messageCategory = classifyErrorMessage(error);
		if (messageCategory) {
			return {
				category: messageCategory,
				confidence: "medium",
				reason: `Error message pattern matched: ${error.slice(0, 50)}...`,
			};
		}
	}

	// Default for unmapped status codes
	// 4xx -> provider_model, 5xx -> unknown
	const fallbackCategory: OpencodeErrorCategory =
		effectiveStatus >= 500 ? "unknown" : "provider_model";

	return {
		category: fallbackCategory,
		confidence: "low",
		reason: `Unmapped status code ${effectiveStatus}, using fallback: ${fallbackCategory}`,
	};
}

/**
 * Classifies a thrown Error value into a taxonomy category.
 *
 * @param error - The thrown error (could be SDK error, native Error, or unknown)
 * @returns Classification result with category and confidence
 */
export function classifyThrownError(error: unknown): ClassificationResult {
	// SDK error types - highest confidence
	if (isProviderAuthError(error)) {
		return {
			category: "auth",
			confidence: "high",
			reason: "ProviderAuthError detected",
		};
	}

	if (isApiError(error)) {
		const statusCode = error.data.statusCode;
		if (statusCode && PROXY_STATUS_TO_CATEGORY[statusCode]) {
			return {
				category: PROXY_STATUS_TO_CATEGORY[statusCode],
				confidence: "high",
				reason: `APIError with status ${statusCode}`,
			};
		}
		return {
			category: "provider_model",
			confidence: "high",
			reason: "APIError without specific status code",
		};
	}

	if (isMessageAbortedError(error)) {
		return {
			category: "timeout",
			confidence: "high",
			reason: "MessageAbortedError detected",
		};
	}

	if (isMessageOutputLengthError(error)) {
		return {
			category: "provider_model",
			confidence: "high",
			reason: "MessageOutputLengthError detected",
		};
	}

	if (isUnknownError(error)) {
		return {
			category: "unknown",
			confidence: "high",
			reason: "UnknownError detected",
		};
	}

	// Native Error types
	if (error instanceof Error) {
		// Check error name first (high confidence)
		if (error.name === "AbortError") {
			return {
				category: "timeout",
				confidence: "high",
				reason: "AbortError detected",
			};
		}

		// Then check message patterns (medium confidence)
		const messageCategory = classifyErrorMessage(error.message);
		if (messageCategory) {
			return {
				category: messageCategory,
				confidence: "medium",
				reason: `Error message pattern: ${error.message.slice(0, 50)}...`,
			};
		}

		return {
			category: "unknown",
			confidence: "medium",
			reason: `Generic Error: ${error.name}`,
		};
	}

	// Non-Error values
	if (typeof error === "string") {
		const messageCategory = classifyErrorMessage(error);
		if (messageCategory) {
			return {
				category: messageCategory,
				confidence: "medium",
				reason: `String error message matched pattern`,
			};
		}
	}

	// Complete unknown
	return {
		category: "unknown",
		confidence: "low",
		reason: `Unclassifiable error type: ${typeof error}`,
	};
}

/**
 * Analyzes an error message for known patterns and returns the matching category.
 *
 * @param message - Error message to analyze
 * @returns Category if pattern matched, null otherwise
 */
function classifyErrorMessage(message: string): OpencodeErrorCategory | null {
	const normalizedMessage = message.toLowerCase();

	// Timeout patterns
	const timeoutPatterns = [
		"timeout",
		"timed out",
		"abort",
		"aborted",
		"deadline exceeded",
		"context deadline",
	];
	if (timeoutPatterns.some((pattern) => normalizedMessage.includes(pattern))) {
		return "timeout";
	}

	// Connection/Runtime unreachable patterns
	const connectionPatterns = [
		"econnrefused",
		"enotfound",
		"fetch failed",
		"connection refused",
		"getaddrinfo",
		"network error",
		"unreachable",
		"cannot connect",
		"connection reset",
		"socket hang up",
	];
	if (
		connectionPatterns.some((pattern) => normalizedMessage.includes(pattern))
	) {
		return "runtime_unreachable";
	}

	// Auth patterns
	const authPatterns = [
		"unauthorized",
		"authentication failed",
		"invalid api key",
		"invalid token",
		"access denied",
		"forbidden",
		"401",
		"403",
	];
	if (authPatterns.some((pattern) => normalizedMessage.includes(pattern))) {
		return "auth";
	}

	// Rate limit patterns (provider_model)
	const rateLimitPatterns = ["rate limit", "too many requests", "429"];
	if (
		rateLimitPatterns.some((pattern) => normalizedMessage.includes(pattern))
	) {
		return "provider_model";
	}

	return null;
}

/**
 * Creates a diagnostic from an SSE error event with full sanitization.
 *
 * @param event - The SSE session.error event
 * @param projectId - Optional project ID for context
 * @returns Sanitized diagnostic object
 */
export function createSseDiagnostic(
	event: EventSessionError,
	projectId?: string,
): OpencodeDiagnostic {
	const classification = classifySseError(event);
	const source: OpencodeErrorSource = { type: "sse", event };

	// Create base diagnostic
	const diagnostic = createOpencodeDiagnostic(source, projectId);

	// Override with classification if confidence is higher
	if (classification.confidence === "high") {
		diagnostic.category = classification.category;
		const metadata = OPENCODE_ERROR_CATEGORY_METADATA[classification.category];
		diagnostic.title = metadata.displayTitle;
		diagnostic.message = metadata.defaultMessage;
		diagnostic.remediation = metadata.defaultRemediation;
		diagnostic.isRetryable = metadata.defaultRetryable;
	}

	// Sanitize technical details
	if (diagnostic.technicalDetails?.metadata) {
		diagnostic.technicalDetails.metadata = sanitizeObject(
			diagnostic.technicalDetails.metadata as Record<string, unknown>,
		);
	}

	return diagnostic;
}

/**
 * Creates a diagnostic from a proxy error response with full sanitization.
 *
 * @param response - The proxy error response
 * @param projectId - Optional project ID for context
 * @returns Sanitized diagnostic object
 */
export function createProxyDiagnostic(
	response: OpencodeProxyError,
	projectId?: string,
): OpencodeDiagnostic {
	const classification = classifyProxyResponse(response);
	const source: OpencodeErrorSource = { type: "proxy", response };

	// Create base diagnostic
	const diagnostic = createOpencodeDiagnostic(source, projectId);

	// Override with classification
	diagnostic.category = classification.category;
	const metadata = OPENCODE_ERROR_CATEGORY_METADATA[classification.category];
	diagnostic.title = metadata.displayTitle;
	diagnostic.message = metadata.defaultMessage;
	diagnostic.remediation = metadata.defaultRemediation;
	diagnostic.isRetryable = metadata.defaultRetryable;

	// Sanitize technical details
	if (diagnostic.technicalDetails?.metadata) {
		diagnostic.technicalDetails.metadata = sanitizeObject(
			diagnostic.technicalDetails.metadata as Record<string, unknown>,
		);
	}

	return diagnostic;
}

/**
 * Creates a diagnostic from a thrown error with full sanitization.
 *
 * @param error - The thrown error
 * @param projectId - Optional project ID for context
 * @returns Sanitized diagnostic object
 */
export function createThrownErrorDiagnostic(
	error: unknown,
	projectId?: string,
): OpencodeDiagnostic {
	const classification = classifyThrownError(error);
	const source: OpencodeErrorSource = { type: "unknown", error };

	// Create base diagnostic
	const diagnostic = createOpencodeDiagnostic(source, projectId);

	// Override with classification
	diagnostic.category = classification.category;
	const metadata = OPENCODE_ERROR_CATEGORY_METADATA[classification.category];
	diagnostic.title = metadata.displayTitle;
	diagnostic.message = metadata.defaultMessage;
	diagnostic.remediation = metadata.defaultRemediation;
	diagnostic.isRetryable = metadata.defaultRetryable;

	// Sanitize technical details
	if (diagnostic.technicalDetails) {
		diagnostic.technicalDetails = sanitizeError(
			diagnostic.technicalDetails,
		) as OpencodeDiagnostic["technicalDetails"];
	}

	return diagnostic;
}

/**
 * Re-exports from types.ts for convenience.
 */
export {
	classifyOpencodeError,
	createOpencodeDiagnostic,
	OPENCODE_ERROR_CATEGORY_METADATA,
	PROXY_STATUS_TO_CATEGORY,
	SDK_ERROR_NAME_TO_CATEGORY,
};

/**
 * Re-exports type guards from types.ts.
 */
export {
	isProviderAuthError,
	isApiError,
	isMessageAbortedError,
	isMessageOutputLengthError,
	isUnknownError,
	isSessionErrorEvent,
};

/**
 * Re-exports types from types.ts.
 */
export type {
	OpencodeDiagnostic,
	OpencodeErrorCategory,
	OpencodeErrorSource,
	OpencodeProxyError,
};
