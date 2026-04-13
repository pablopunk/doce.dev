import { describe, expect, it } from "vitest";
import { sanitizeMessage, errorToSanitizedMessage } from "./sanitize";

describe("sanitizeMessage", () => {
	it("should redact API keys", () => {
		const message = "Error: api_key:sk-1234567890abcdef1234567890";
		expect(sanitizeMessage(message)).toBe("Error: api_key:[REDACTED]");
	});

	it("should redact bearer tokens", () => {
		const message = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
		expect(sanitizeMessage(message)).toBe("Authorization: Bearer [REDACTED]");
	});

	it("should redact passwords", () => {
		const message = "password: superSecretPassword123";
		expect(sanitizeMessage(message)).toBe("password:[REDACTED]");
	});

	it("should redact private keys", () => {
		const message = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...";
		expect(sanitizeMessage(message)).toBe("[REDACTED PRIVATE KEY]\nMIIEpAIBAAKCAQEA...");
	});

	it("should redact multiple sensitive values in one message", () => {
		const message = "api_key:sk-1234567890 and password: secret123 and token: abc1234567890123456";
		const result = sanitizeMessage(message);
		expect(result).toContain("api_key:[REDACTED]");
		expect(result).toContain("password:[REDACTED]");
		expect(result).toContain("token:[REDACTED]");
	});

	it("should preserve non-sensitive messages", () => {
		const message = "Project build failed with exit code 1";
		expect(sanitizeMessage(message)).toBe(message);
	});

	it("should handle empty strings", () => {
		expect(sanitizeMessage("")).toBe("");
	});
});

describe("errorToSanitizedMessage", () => {
	it("should sanitize error messages", () => {
		const error = new Error("Failed with api_key:sk-secret123456");
		expect(errorToSanitizedMessage(error)).toBe("Failed with api_key:[REDACTED]");
	});

	it("should handle plain strings", () => {
		const message = "Error: token:abc12345678901234567890";
		expect(errorToSanitizedMessage(message)).toBe("Error: token:[REDACTED]");
	});

	it("should handle non-string errors", () => {
		expect(errorToSanitizedMessage(123)).toBe("123");
		expect(errorToSanitizedMessage(null)).toBe("null");
		expect(errorToSanitizedMessage(undefined)).toBe("undefined");
	});
});
