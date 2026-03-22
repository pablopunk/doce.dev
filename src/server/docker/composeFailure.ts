export type ComposeFailureKind =
	| "registry_timeout"
	| "missing_container"
	| "generic";

export interface ComposeFailureDiagnostic {
	kind: ComposeFailureKind;
	summary: string;
}

const REGISTRY_TIMEOUT_PATTERN =
	/(cloudflarestorage\.com|production\.cloudflare\.docker\.com).*(i\/o timeout|context deadline exceeded|tls handshake timeout)|dial tcp .*:443: i\/o timeout/i;

const MISSING_CONTAINER_PATTERN = /no such container/i;

export function classifyComposeFailure(
	rawOutput: string,
): ComposeFailureDiagnostic {
	if (REGISTRY_TIMEOUT_PATTERN.test(rawOutput)) {
		return {
			kind: "registry_timeout",
			summary:
				"Docker registry timed out while downloading image layers. Check outbound access to Docker image blob hosts or pre-pull required base images.",
		};
	}

	if (MISSING_CONTAINER_PATTERN.test(rawOutput)) {
		return {
			kind: "missing_container",
			summary:
				"Docker referenced a container that does not exist. Check project/container naming and compose state before retrying.",
		};
	}

	const fallback = rawOutput.trim().slice(0, 240) || "Unknown docker error";
	return { kind: "generic", summary: fallback };
}
