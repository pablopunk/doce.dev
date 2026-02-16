/**
 * OpenCode Error Diagnostic Taxonomy
 *
 * Defines the contract for mapping OpenCode SDK errors, SSE events, and proxy responses
 * into a consistent taxonomy of 5 categories:
 * - auth: Authentication/authorization failures with providers
 * - provider_model: Model-specific errors (rate limits, invalid models, content policy)
 * - runtime_unreachable: OpenCode runtime not accessible (container down, network issues)
 * - timeout: Request timeouts and abortions
 * - unknown: Catch-all for unclassified errors
 *
 * @module opencode/diagnostics/types
 */

import type {
	ApiError,
	EventSessionError,
	MessageAbortedError,
	MessageOutputLengthError,
	ProviderAuthError,
	UnknownError,
} from "@opencode-ai/sdk/v2/client";

// ============================================================================
// Error Category Taxonomy
// ============================================================================

/**
 * The five error categories in the OpenCode diagnostic taxonomy.
 * Each category maps to specific error signals from SDK, SSE, and proxy layers.
 */
export type OpencodeErrorCategory =
	| "auth"
	| "provider_model"
	| "runtime_unreachable"
	| "timeout"
	| "unknown";

/**
 * All valid error category values as a const array for runtime validation.
 */
export const OPENCODE_ERROR_CATEGORIES: readonly OpencodeErrorCategory[] = [
	"auth",
	"provider_model",
	"runtime_unreachable",
	"timeout",
	"unknown",
] as const;

// ============================================================================
// Source-Specific Error Types
// ============================================================================

/**
 * Error types from the OpenCode SDK (thrown as exceptions or returned in responses).
 * These map to the error union in AssistantMessage.error from the SDK types.
 */
export type OpencodeSdkError =
	| ProviderAuthError
	| ApiError
	| MessageOutputLengthError
	| MessageAbortedError
	| UnknownError;

/**
 * SSE EventSessionError structure (session.error event).
 * Properties come from EventSessionError in SDK types.
 */
export type OpencodeSessionErrorEvent = EventSessionError;

/**
 * Proxy error response structure for 4xx/5xx responses.
 * These are returned by the proxy at src/pages/api/projects/[id]/opencode/[...path].ts
 */
export interface OpencodeProxyError {
	/** HTTP status code from the proxy response */
	status: number;
	/** Error message or structured error data */
	error: string | Record<string, unknown>;
	/** Optional upstream status code if proxy forwarded an error */
	upstreamStatus?: number;
}

/**
 * Queue handler error context.
 * Errors thrown in queue handlers (opencodeSessionCreate, opencodeSendUserPrompt)
 * may be wrapped with additional context.
 */
export interface OpencodeQueueError {
	/** Original error that was thrown */
	originalError: unknown;
	/** Queue job type that failed */
	jobType: string;
	/** Project ID associated with the error */
	projectId: string;
}

// ============================================================================
// Taxonomy Classification Input
// ============================================================================

/**
 * Union type representing any error signal that needs classification.
 * This is the input to the error classification function.
 */
export type OpencodeErrorSource =
	| { type: "sdk"; error: OpencodeSdkError }
	| { type: "sse"; event: OpencodeSessionErrorEvent }
	| { type: "proxy"; response: OpencodeProxyError }
	| { type: "queue"; error: OpencodeQueueError }
	| { type: "unknown"; error: unknown };

// ============================================================================
// Diagnostic Output Types
// ============================================================================

/**
 * Remediation action that can be suggested to the user.
 */
export interface RemediationAction {
	/** Unique identifier for the action type */
	id: string;
	/** Human-readable label for the action button/link */
	label: string;
	/** Description of what this action does */
	description: string;
	/** Whether this action requires navigation */
	href?: string;
	/** Whether this action triggers a function call */
	action?: string;
}

/**
 * Complete diagnostic information for an OpenCode error.
 * This is the output of the error classification pipeline.
 */
export interface OpencodeDiagnostic {
	/** The taxonomy category this error belongs to */
	category: OpencodeErrorCategory;
	/** Short title suitable for display in UI (2-5 words) */
	title: string;
	/** Human-readable message explaining what went wrong */
	message: string;
	/**
	 * Technical details for debugging (may include raw error data).
	 * Not displayed to users by default.
	 */
	technicalDetails:
		| {
				/** Original error name/type */
				errorName: string;
				/** Original error message */
				errorMessage: string;
				/** Stack trace if available */
				stack: string | undefined;
				/** Additional structured data from the error */
				metadata: Record<string, unknown> | undefined;
		  }
		| undefined;
	/** Suggested remediation actions for the user */
	remediation: RemediationAction[];
	/** Whether this error is retryable */
	isRetryable: boolean;
	/** Timestamp when the diagnostic was created */
	timestamp: string;
	/** Source that generated this error */
	source: OpencodeErrorSource["type"];
}

// ============================================================================
// Category-Specific Metadata
// ============================================================================

/**
 * Metadata configuration for each error category.
 * Used to generate consistent user-facing messages.
 */
export interface OpencodeErrorCategoryMetadata {
	/** Category identifier */
	category: OpencodeErrorCategory;
	/** Display title for the category */
	displayTitle: string;
	/** Default message template for this category */
	defaultMessage: string;
	/** Default remediation actions for this category */
	defaultRemediation: RemediationAction[];
	/** Whether errors in this category are typically retryable */
	defaultRetryable: boolean;
}

/**
 * Metadata for all error categories.
 * This is the source of truth for user-facing strings.
 */
export const OPENCODE_ERROR_CATEGORY_METADATA: Record<
	OpencodeErrorCategory,
	OpencodeErrorCategoryMetadata
> = {
	auth: {
		category: "auth",
		displayTitle: "Authentication Failed",
		defaultMessage:
			"Unable to authenticate with the AI provider. Your API key may be invalid or expired.",
		defaultRemediation: [
			{
				id: "check_api_key",
				label: "Check API Key",
				description:
					"Verify your API key is correctly set in provider settings",
				href: "/settings/providers",
			},
			{
				id: "reconnect_provider",
				label: "Reconnect Provider",
				description:
					"Disconnect and reconnect the provider to refresh authentication",
				action: "reconnectProvider",
			},
		],
		defaultRetryable: false,
	},
	provider_model: {
		category: "provider_model",
		displayTitle: "Model Error",
		defaultMessage:
			"The AI model encountered an error. This could be due to rate limiting, an invalid model selection, or content policy violations.",
		defaultRemediation: [
			{
				id: "try_different_model",
				label: "Try Different Model",
				description: "Switch to a different AI model",
				href: "/settings/models",
			},
			{
				id: "wait_retry",
				label: "Wait and Retry",
				description: "Wait a moment and try again (for rate limits)",
				action: "retry",
			},
		],
		defaultRetryable: true,
	},
	runtime_unreachable: {
		category: "runtime_unreachable",
		displayTitle: "OpenCode Unavailable",
		defaultMessage:
			"Cannot connect to the OpenCode runtime. The service may be starting up or experiencing issues.",
		defaultRemediation: [
			{
				id: "wait_startup",
				label: "Wait for Startup",
				description: "The OpenCode container may still be initializing",
				action: "wait",
			},
			{
				id: "restart_project",
				label: "Restart Project",
				description: "Restart the project containers",
				action: "restartProject",
			},
		],
		defaultRetryable: true,
	},
	timeout: {
		category: "timeout",
		displayTitle: "Request Timed Out",
		defaultMessage:
			"The request took too long to complete. This may be due to high load or a complex operation.",
		defaultRemediation: [
			{
				id: "retry",
				label: "Retry",
				description: "Try the request again",
				action: "retry",
			},
			{
				id: "simplify_request",
				label: "Simplify Request",
				description: "Try a simpler prompt or break into smaller tasks",
				action: "simplify",
			},
		],
		defaultRetryable: true,
	},
	unknown: {
		category: "unknown",
		displayTitle: "Unexpected Error",
		defaultMessage:
			"An unexpected error occurred. Please try again or contact support if the issue persists.",
		defaultRemediation: [
			{
				id: "retry",
				label: "Retry",
				description: "Try the operation again",
				action: "retry",
			},
			{
				id: "view_logs",
				label: "View Logs",
				description: "Check the logs for more details",
				href: "/logs",
			},
		],
		defaultRetryable: true,
	},
} as const;

// ============================================================================
// Classification Functions
// ============================================================================

/**
 * Type guard for ProviderAuthError.
 */
export function isProviderAuthError(
	error: unknown,
): error is ProviderAuthError {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "ProviderAuthError"
	);
}

/**
 * Type guard for ApiError.
 */
export function isApiError(error: unknown): error is ApiError {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "APIError"
	);
}

/**
 * Type guard for MessageAbortedError.
 */
export function isMessageAbortedError(
	error: unknown,
): error is MessageAbortedError {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "MessageAbortedError"
	);
}

/**
 * Type guard for MessageOutputLengthError.
 */
export function isMessageOutputLengthError(
	error: unknown,
): error is MessageOutputLengthError {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "MessageOutputLengthError"
	);
}

/**
 * Type guard for UnknownError.
 */
export function isUnknownError(error: unknown): error is UnknownError {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "UnknownError"
	);
}

/**
 * Type guard for EventSessionError.
 */
export function isSessionErrorEvent(
	event: unknown,
): event is EventSessionError {
	return (
		typeof event === "object" &&
		event !== null &&
		"type" in event &&
		event.type === "session.error"
	);
}

// ============================================================================
// Classification Maps
// ============================================================================

/**
 * Maps SDK error names to their taxonomy categories.
 * This is the definitive mapping from SDK error types to categories.
 */
export const SDK_ERROR_NAME_TO_CATEGORY: Record<string, OpencodeErrorCategory> =
	{
		ProviderAuthError: "auth",
		APIError: "provider_model",
		MessageOutputLengthError: "provider_model",
		MessageAbortedError: "timeout",
		UnknownError: "unknown",
	} as const;

/**
 * Maps HTTP status codes from proxy responses to taxonomy categories.
 */
export const PROXY_STATUS_TO_CATEGORY: Record<number, OpencodeErrorCategory> = {
	// 4xx - Client errors (usually auth or invalid requests)
	400: "provider_model",
	401: "auth",
	403: "auth",
	404: "runtime_unreachable",
	408: "timeout",
	413: "provider_model",
	429: "provider_model", // Rate limiting

	// 5xx - Server errors (runtime issues)
	500: "unknown",
	502: "runtime_unreachable", // Bad gateway (OpenCode container down)
	503: "runtime_unreachable", // Service unavailable
	504: "timeout", // Gateway timeout
} as const;

/**
 * Default category for unmapped status codes.
 */
export const DEFAULT_PROXY_CATEGORY: OpencodeErrorCategory = "unknown";

// ============================================================================
// Error Classification Utility
// ============================================================================

/**
 * Classifies an error source into a taxonomy category.
 * This is the main entry point for error classification.
 *
 * @param source - The error source to classify
 * @returns The taxonomy category for the error
 */
export function classifyOpencodeError(
	source: OpencodeErrorSource,
): OpencodeErrorCategory {
	switch (source.type) {
		case "sdk": {
			const errorName = (source.error as { name?: string }).name;
			return SDK_ERROR_NAME_TO_CATEGORY[errorName ?? ""] ?? "unknown";
		}
		case "sse": {
			const error = source.event.properties.error;
			if (!error) return "unknown";
			return SDK_ERROR_NAME_TO_CATEGORY[error.name] ?? "unknown";
		}
		case "proxy": {
			const status = source.response.status;
			return PROXY_STATUS_TO_CATEGORY[status] ?? DEFAULT_PROXY_CATEGORY;
		}
		case "queue": {
			// Try to classify based on the original error
			const original = source.error.originalError;
			if (isProviderAuthError(original)) return "auth";
			if (isApiError(original)) return "provider_model";
			if (isMessageAbortedError(original)) return "timeout";

			// Check error message patterns
			const message =
				original instanceof Error ? original.message : String(original);
			if (message.includes("timeout") || message.includes("AbortError")) {
				return "timeout";
			}
			if (
				message.includes("ECONNREFUSED") ||
				message.includes("ENOTFOUND") ||
				message.includes("fetch failed")
			) {
				return "runtime_unreachable";
			}
			return "unknown";
		}
		case "unknown":
		default: {
			// Check for common patterns
			const error = source.error;
			if (error instanceof Error) {
				if (error.name === "AbortError" || error.message.includes("timeout")) {
					return "timeout";
				}
				if (
					error.message.includes("ECONNREFUSED") ||
					error.message.includes("ENOTFOUND") ||
					error.message.includes("fetch failed")
				) {
					return "runtime_unreachable";
				}
			}
			return "unknown";
		}
	}
}

// ============================================================================
// Diagnostic Builder
// ============================================================================

/**
 * Creates a complete diagnostic object from an error source.
 *
 * @param source - The error source
 * @param projectId - Optional project ID for context
 * @returns A complete OpencodeDiagnostic object
 */
export function createOpencodeDiagnostic(
	source: OpencodeErrorSource,
	_projectId?: string,
): OpencodeDiagnostic {
	const category = classifyOpencodeError(source);
	const metadata = OPENCODE_ERROR_CATEGORY_METADATA[category];
	const timestamp = new Date().toISOString();

	// Extract technical details based on source type
	let technicalDetails: OpencodeDiagnostic["technicalDetails"] | undefined;
	let originalError: unknown;

	switch (source.type) {
		case "sdk":
			originalError = source.error;
			break;
		case "sse":
			originalError = source.event.properties.error;
			break;
		case "proxy":
			originalError = source.response;
			break;
		case "queue":
			originalError = source.error.originalError;
			break;
		case "unknown":
		default:
			originalError = source.error;
	}

	if (originalError instanceof Error) {
		technicalDetails = {
			errorName: originalError.name,
			errorMessage: originalError.message,
			stack: originalError.stack,
			metadata: undefined,
		};
	} else if (originalError && typeof originalError === "object") {
		const err = originalError as { name?: string; message?: string };
		technicalDetails = {
			errorName: err.name ?? "UnknownError",
			errorMessage: err.message ?? String(originalError),
			stack: undefined,
			metadata: originalError as Record<string, unknown>,
		};
	} else {
		technicalDetails = {
			errorName: "UnknownError",
			errorMessage: String(originalError),
			stack: undefined,
			metadata: undefined,
		};
	}

	return {
		category,
		title: metadata.displayTitle,
		message: metadata.defaultMessage,
		technicalDetails,
		remediation: metadata.defaultRemediation,
		isRetryable: metadata.defaultRetryable,
		timestamp,
		source: source.type,
	};
}
