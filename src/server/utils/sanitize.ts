/**
 * Log and error message sanitization utilities
 *
 * Redacts sensitive information like API keys, tokens, and passwords
 * before storing in logs or database.
 */

// Patterns to detect and redact sensitive data
const SENSITIVE_PATTERNS = [
	// API Keys
	{
		pattern: /api[_-]?key[:\s]*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
		replacement: "api_key:[REDACTED]",
	},
	{
		pattern: /apikey[:\s]*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
		replacement: "apikey:[REDACTED]",
	},

	// Bearer tokens
	{
		pattern: /bearer\s+[a-zA-Z0-9_\-.]{20,}/gi,
		replacement: "Bearer [REDACTED]",
	},

	// Authorization headers
	{
		pattern: /authorization[:\s]*["']?[a-zA-Z0-9_\-.\s]{20,}["']?/gi,
		replacement: "Authorization: [REDACTED]",
	},

	// Passwords
	{
		pattern: /password[:\s]*["']?[^\s"']{8,}["']?/gi,
		replacement: "password:[REDACTED]",
	},
	{
		pattern: /passwd[:\s]*["']?[^\s"']{8,}["']?/gi,
		replacement: "passwd:[REDACTED]",
	},

	// Private keys
	{
		pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi,
		replacement: "[REDACTED PRIVATE KEY]",
	},

	// Tokens (generic)
	{
		pattern: /token[:\s]*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
		replacement: "token:[REDACTED]",
	},
	{
		pattern: /access[_-]?token[:\s]*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
		replacement: "access_token:[REDACTED]",
	},
	{
		pattern: /refresh[_-]?token[:\s]*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
		replacement: "refresh_token:[REDACTED]",
	},
	{
		pattern: /auth[_-]?token[:\s]*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
		replacement: "auth_token:[REDACTED]",
	},
	{
		pattern: /session[_-]?token[:\s]*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
		replacement: "session_token:[REDACTED]",
	},

	// Secret keys
	{
		pattern: /secret[_-]?key[:\s]*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
		replacement: "secret_key:[REDACTED]",
	},

	// AWS keys
	{ pattern: /AKIA[0-9A-Z]{16}/g, replacement: "[REDACTED_AWS_KEY]" },

	// GitHub tokens
	{
		pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
		replacement: "[REDACTED_GH_TOKEN]",
	},

	// Slack tokens
	{
		pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}(-[a-zA-Z0-9]{24})?/g,
		replacement: "[REDACTED_SLACK_TOKEN]",
	},
] as const;

/**
 * Sanitize a string by redacting sensitive information
 */
export function sanitizeMessage(message: string): string {
	if (!message || typeof message !== "string") {
		return message;
	}

	let sanitized = message;

	for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
		sanitized = sanitized.replace(pattern, replacement);
	}

	return sanitized;
}

/**
 * Sanitize an error object, preserving its structure but redacting sensitive data
 */
export function sanitizeError(error: Error): Error {
	const sanitized = new Error(sanitizeMessage(error.message));
	sanitized.name = error.name;
	if (error.stack) {
		sanitized.stack = sanitizeMessage(error.stack);
	}

	// Copy any custom properties
	for (const key of Object.keys(error)) {
		const value = (error as unknown as Record<string, unknown>)[key];
		if (typeof value === "string") {
			(sanitized as unknown as Record<string, unknown>)[key] = sanitizeMessage(value);
		} else {
			(sanitized as unknown as Record<string, unknown>)[key] = value;
		}
	}

	return sanitized;
}

/**
 * Sanitize any value (string, Error, or JSON-serializable object)
 */
export function sanitize(value: unknown): unknown {
	if (typeof value === "string") {
		return sanitizeMessage(value);
	}

	if (value instanceof Error) {
		return sanitizeError(value);
	}

	// For objects, recursively sanitize string values
	if (value && typeof value === "object") {
		try {
			const json = JSON.stringify(value);
			const sanitized = sanitizeMessage(json);
			return JSON.parse(sanitized);
		} catch {
			// If JSON serialization fails, return as-is
			return value;
		}
	}

	return value;
}

/**
 * Convert an error to a sanitized string message
 * Safe for storing in database or logging
 */
export function errorToSanitizedMessage(error: unknown): string {
	if (error instanceof Error) {
		const sanitized = sanitizeError(error);
		return sanitized.message;
	}

	if (typeof error === "string") {
		return sanitizeMessage(error);
	}

	// For other types, convert to string and sanitize
	try {
		const str = JSON.stringify(error);
		return sanitizeMessage(str);
	} catch {
		return "[Unable to serialize error]";
	}
}
