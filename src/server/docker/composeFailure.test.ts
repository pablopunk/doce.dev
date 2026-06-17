import { describe, expect, it } from "vitest";
import { classifyComposeFailure } from "./composeFailure";

describe("classifyComposeFailure", () => {
	it("classifies cloudflare docker blob timeout as registry_timeout", () => {
		const diagnostic = classifyComposeFailure(
			"failed to do request: Get https://docker-images-prod.abc.r2.cloudflarestorage.com/blob: dial tcp 172.64.66.1:443: i/o timeout",
		);
		expect(diagnostic.kind).toBe("registry_timeout");
	});

	it("classifies missing container errors as missing_container", () => {
		const diagnostic = classifyComposeFailure(
			"Error: No such container: doce_preview_1",
		);
		expect(diagnostic.kind).toBe("missing_container");
	});

	it("falls back to generic for unknown failures", () => {
		const diagnostic = classifyComposeFailure(
			"Service 'preview' failed to build: Build failed",
		);
		expect(diagnostic.kind).toBe("generic");
	});
});
