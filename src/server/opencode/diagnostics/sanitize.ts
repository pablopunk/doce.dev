/**
 * OpenCode Diagnostics Sanitizer
 *
 * Sanitizes error objects and payloads by removing sensitive fields
 * while preserving structural context for debugging.
 *
 * @module opencode/diagnostics/sanitize
 */

/**
 * Default sensitive keys that should be redacted from objects.
 * These are case-insensitive and match partial key names.
 */
export const DEFAULT_SENSITIVE_KEYS: readonly string[] = [
	// Authentication tokens
	"apikey",
	"api_key",
	"api-key",
	"authorization",
	"auth",
	"token",
	"access_token",
	"accessToken",
	"refresh_token",
	"refreshToken",
	"bearer",
	"jwt",
	"password",
	"secret",
	"secret_key",
	"secretKey",
	"private_key",
	"privateKey",
	// Session identifiers
	"cookie",
	"session",
	"sessionid",
	"session_id",
	"sessionId",
	// Credentials
	"credential",
	"credentials",
	"key",
	"api_secret",
	"apiSecret",
	// Headers that may contain auth
	"x-api-key",
	"x-auth-token",
	"x-access-token",
] as const;

/**
 * Redaction placeholder used to indicate a value was removed.
 */
export const REDACTION_PLACEHOLDER = "[REDACTED]";

/**
 * Options for sanitization.
 */
export interface SanitizeOptions {
	/** Additional keys to redact beyond the defaults */
	additionalKeys?: readonly string[];
	/** Keys to allow (not redact) even if they match sensitive patterns */
	allowKeys?: readonly string[];
	/** Custom redaction placeholder */
	redactionPlaceholder?: string;
	/** Maximum depth to traverse nested objects */
	maxDepth?: number;
}

/**
 * Checks if a key matches any of the sensitive key patterns.
 *
 * @param key - The object key to check
 * @param sensitiveKeys - Array of sensitive key patterns
 * @returns True if the key should be redacted
 */
function isSensitiveKey(
	key: string,
	sensitiveKeys: readonly string[],
): boolean {
	const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
	return sensitiveKeys.some((sensitive) => {
		const normalizedSensitive = sensitive.toLowerCase().replace(/[-_]/g, "");
		return (
			normalizedKey === normalizedSensitive ||
			normalizedKey.includes(normalizedSensitive) ||
			normalizedSensitive.includes(normalizedKey)
		);
	});
}

/**
 * Recursively sanitizes an object by redacting sensitive values.
 *
 * @param value - The value to sanitize
 * @param sensitiveKeys - Keys that should be redacted
 * @param allowedKeys - Keys that should never be redacted
 * @param placeholder - Replacement text for redacted values
 * @param depth - Current recursion depth
 * @param maxDepth - Maximum recursion depth
 * @returns Sanitized value
 */
function sanitizeValue(
	value: unknown,
	sensitiveKeys: readonly string[],
	allowedKeys: readonly string[],
	placeholder: string,
	depth: number,
	maxDepth: number,
): unknown {
	// Stop at max depth
	if (depth >= maxDepth) {
		return typeof value === "object" && value !== null
			? "[Max Depth Reached]"
			: value;
	}

	// Handle null
	if (value === null) {
		return null;
	}

	// Handle arrays
	if (Array.isArray(value)) {
		return value.map((item) =>
			sanitizeValue(
				item,
				sensitiveKeys,
				allowedKeys,
				placeholder,
				depth + 1,
				maxDepth,
			),
		);
	}

	// Handle objects
	if (typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			// Check if key is explicitly allowed
			if (allowedKeys.includes(key)) {
				result[key] = sanitizeValue(
					val,
					sensitiveKeys,
					allowedKeys,
					placeholder,
					depth + 1,
					maxDepth,
				);
				continue;
			}

			// Check if key is sensitive
			if (isSensitiveKey(key, sensitiveKeys)) {
				result[key] = placeholder;
			} else {
				result[key] = sanitizeValue(
					val,
					sensitiveKeys,
					allowedKeys,
					placeholder,
					depth + 1,
					maxDepth,
				);
			}
		}
		return result;
	}

	// Handle strings that might contain sensitive data in specific patterns
	if (typeof value === "string") {
		return sanitizeString(value);
	}

	// Return primitives as-is
	return value;
}

/**
 * Sanitizes a string value by detecting and redacting common secret patterns.
 *
 * @param value - String to sanitize
 * @returns Sanitized string
 */
function sanitizeString(value: string): string {
	// Pattern for Bearer tokens
	let sanitized = value.replace(
		/bearer\s+[a-zA-Z0-9_\-.]+/gi,
		`Bearer ${REDACTION_PLACEHOLDER}`,
	);

	// Pattern for Basic auth (base64 encoded credentials)
	sanitized = sanitized.replace(
		/basic\s+[a-zA-Z0-9+/=]+/gi,
		`Basic ${REDACTION_PLACEHOLDER}`,
	);

	// Pattern for API keys in query strings
	sanitized = sanitized.replace(
		/([?&])(api[_-]?key|token|auth)=[^&]+/gi,
		`$1$2=${REDACTION_PLACEHOLDER}`,
	);

	// Pattern for JWT tokens (three base64url parts separated by dots)
	sanitized = sanitized.replace(
		/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
		REDACTION_PLACEHOLDER,
	);

	return sanitized;
}

/**
 * Sanitizes an object by redacting sensitive fields.
 *
 * This function creates a deep copy of the input with all sensitive
 * keys replaced with a placeholder. It preserves the structure of
 * the object for debugging purposes while removing secrets.
 *
 * @param input - The object to sanitize
 * @param options - Sanitization options
 * @returns Sanitized object
 *
 * @example
 * ```typescript
 * const sanitized = sanitizeObject({
 *   message: "Request failed",
 *   apiKey: "sk-1234567890",
 *   headers: { authorization: "Bearer token123" }
 * });
 * // Result: { message: "Request failed", apiKey: "[REDACTED]", headers: { authorization: "[REDACTED]" } }
 * ```
 */
export function sanitizeObject<T extends Record<string, unknown>>(
	input: T,
	options: SanitizeOptions = {},
): Record<string, unknown> {
	const {
		additionalKeys = [],
		allowKeys = [],
		redactionPlaceholder = REDACTION_PLACEHOLDER,
		maxDepth = 10,
	} = options;

	const sensitiveKeys = [...DEFAULT_SENSITIVE_KEYS, ...additionalKeys];

	return sanitizeValue(
		input,
		sensitiveKeys,
		allowKeys,
		redactionPlaceholder,
		0,
		maxDepth,
	) as Record<string, unknown>;
}

/**
 * Sanitizes error objects specifically, preserving error-specific fields.
 *
 * @param error - The error to sanitize
 * @param options - Sanitization options
 * @returns Sanitized error object safe for logging/display
 */
export function sanitizeError(
	error: unknown,
	options: SanitizeOptions = {},
): Record<string, unknown> {
	if (error instanceof Error) {
		const errorObj: Record<string, unknown> = {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};

		// Include any custom properties from the error
		if (typeof error === "object" && error !== null) {
			for (const [key, value] of Object.entries(error)) {
				if (!(key in errorObj)) {
					errorObj[key] = value;
				}
			}
		}

		return sanitizeObject(errorObj, options);
	}

	// Handle non-Error values
	if (typeof error === "object" && error !== null) {
		return sanitizeObject(error as Record<string, unknown>, options);
	}

	// Handle primitives
	return { value: String(error) };
}

/**
 * Sanitizes headers object, specifically designed for HTTP headers.
 *
 * @param headers - Headers object to sanitize
 * @param options - Sanitization options
 * @returns Sanitized headers
 */
export function sanitizeHeaders(
	headers: Record<string, string | string[] | undefined>,
	options: SanitizeOptions = {},
): Record<string, string | string[] | undefined> {
	const result: Record<string, string | string[] | undefined> = {};

	for (const [key, value] of Object.entries(headers)) {
		const normalizedKey = key.toLowerCase();
		if (
			DEFAULT_SENSITIVE_KEYS.some(
				(sensitive) => normalizedKey === sensitive.toLowerCase(),
			) ||
			key.toLowerCase().includes("auth") ||
			key.toLowerCase().includes("token") ||
			key.toLowerCase().includes("cookie")
		) {
			result[key] = options.redactionPlaceholder ?? REDACTION_PLACEHOLDER;
		} else if (typeof value === "string") {
			result[key] = sanitizeString(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Creates a sanitized copy of technical details for diagnostics.
 * This is specifically designed for the OpencodeDiagnostic.technicalDetails field.
 *
 * @param details - Technical details to sanitize
 * @returns Sanitized technical details
 */
export function sanitizeTechnicalDetails(
	details: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!details) return undefined;
	return sanitizeObject(details, { maxDepth: 5 });
}
