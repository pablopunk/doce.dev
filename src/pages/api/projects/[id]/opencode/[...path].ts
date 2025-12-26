import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { logger } from "@/server/logger";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";

const SESSION_COOKIE_NAME = "doce_session";

// Allowlisted paths for the opencode proxy
const ALLOWED_PATH_PREFIXES = ["session", "event", "doc", "path", "config"];

// Headers to strip from forwarded requests
const HOP_BY_HOP_HEADERS = [
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
];

// Max request body size (5MB)
const MAX_BODY_SIZE = 5 * 1024 * 1024;

// Request timeout - longer for message endpoints since LLM responses can take a while
const REQUEST_TIMEOUT_MS = 30_000;
const MESSAGE_TIMEOUT_MS = 300_000; // 5 minutes for message endpoints

function isPathAllowed(proxyPath: string): boolean {
	// Always allow if path starts with one of the allowed prefixes
	const firstSegment = proxyPath.split("/")[0] ?? "";
	return ALLOWED_PATH_PREFIXES.includes(firstSegment);
}

function stripHeaders(headers: Headers): Headers {
	const newHeaders = new Headers();
	for (const [key, value] of headers.entries()) {
		if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
			newHeaders.set(key, value);
		}
	}
	// Remove cookies for security
	newHeaders.delete("cookie");
	return newHeaders;
}

function stripResponseHeaders(headers: Headers): Headers {
	const newHeaders = new Headers();
	for (const [key, value] of headers.entries()) {
		const lower = key.toLowerCase();
		if (!HOP_BY_HOP_HEADERS.includes(lower) && lower !== "set-cookie") {
			newHeaders.set(key, value);
		}
	}
	return newHeaders;
}

export const ALL: APIRoute = async ({ params, request, cookies }) => {
	// Validate session
	const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!sessionToken) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const session = await validateSession(sessionToken);
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const projectId = params.id;
	const proxyPath = params.path ?? "";

	if (!projectId) {
		return new Response(JSON.stringify({ error: "Project ID required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Check if path is allowed
	if (!isPathAllowed(proxyPath)) {
		logger.warn({ projectId, proxyPath }, "Blocked proxy path");
		return new Response(JSON.stringify({ error: "Path not allowed" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Verify project ownership
	const isOwner = await isProjectOwnedByUser(projectId, session.user.id);
	if (!isOwner) {
		return new Response(JSON.stringify({ error: "Not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	const project = await getProjectById(projectId);
	if (!project) {
		return new Response(JSON.stringify({ error: "Not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Build upstream URL
	const upstreamUrl = `http://127.0.0.1:${project.opencodePort}/${proxyPath}`;

	// Prepare request
	const method = request.method;
	const requestHeaders = stripHeaders(new Headers(request.headers));

	// Read body if present
	let body: BodyInit | null = null;
	if (method !== "GET" && method !== "HEAD") {
		const contentLength = request.headers.get("content-length");
		if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
			return new Response(JSON.stringify({ error: "Request body too large" }), {
				status: 413,
				headers: { "Content-Type": "application/json" },
			});
		}
		body = await request.arrayBuffer();
		if (body.byteLength > MAX_BODY_SIZE) {
			return new Response(JSON.stringify({ error: "Request body too large" }), {
				status: 413,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	try {
		const controller = new AbortController();
		// Use longer timeout for message endpoints (LLM responses can take a while)
		const isMessageEndpoint = proxyPath.includes("/message");
		const timeoutMs = isMessageEndpoint
			? MESSAGE_TIMEOUT_MS
			: REQUEST_TIMEOUT_MS;
		const timeout = setTimeout(() => controller.abort(), timeoutMs);

		const upstreamResponse = await fetch(upstreamUrl, {
			method,
			headers: requestHeaders,
			body,
			signal: controller.signal,
		});

		clearTimeout(timeout);

		logger.debug(
			{ method, proxyPath, status: upstreamResponse.status },
			"Proxy request",
		);

		// Return response with stripped headers
		const responseHeaders = stripResponseHeaders(upstreamResponse.headers);

		return new Response(upstreamResponse.body, {
			status: upstreamResponse.status,
			statusText: upstreamResponse.statusText,
			headers: responseHeaders,
		});
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return new Response(JSON.stringify({ error: "Request timeout" }), {
				status: 504,
				headers: { "Content-Type": "application/json" },
			});
		}

		logger.error({ error, projectId, proxyPath }, "Proxy error");

		// For session endpoints, return empty array instead of 502 error
		// This allows the frontend to treat "server not ready" as "no sessions yet"
		// and keep polling until the server is ready
		if (proxyPath.startsWith("session")) {
			return new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(JSON.stringify({ error: "Upstream error" }), {
			status: 502,
			headers: { "Content-Type": "application/json" },
		});
	}
};
