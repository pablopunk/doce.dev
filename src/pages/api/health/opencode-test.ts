import type { APIRoute } from "astro";
import { logger } from "@/server/logger";
import { getOpencodeClient } from "@/server/opencode/client";
import { getProjectById } from "@/server/projects/projects.model";

/**
 * Diagnostic endpoint to test OpenCode SDK connectivity.
 * Useful for debugging container communication issues.
 *
 * Usage: GET /api/health/opencode-test?projectId=<id>
 */
export const GET: APIRoute = async ({ url }) => {
	const projectId = url.searchParams.get("projectId");

	if (!projectId) {
		return new Response(
			JSON.stringify({
				error: "Missing projectId query parameter",
				usage: "/api/health/opencode-test?projectId=<project-id>",
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	try {
		// Verify project exists
		const project = await getProjectById(projectId);
		if (!project) {
			return new Response(
				JSON.stringify({
					error: "Project not found",
					projectId,
				}),
				{ status: 404, headers: { "Content-Type": "application/json" } },
			);
		}

		logger.info({ projectId }, "Running OpenCode diagnostic test");

		const results: Record<string, unknown> = {
			projectId,
			timestamp: new Date().toISOString(),
			tests: {},
		};

		// Test 1: Create client
		try {
			logger.info({ projectId }, "Test 1: Creating OpenCode client");
			getOpencodeClient(projectId, project.opencodePort);
			(results.tests as Record<string, unknown>)["client_creation"] = {
				status: "success",
			};
		} catch (error) {
			(results.tests as Record<string, unknown>)["client_creation"] = {
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
			};
			return new Response(JSON.stringify(results), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Test 2: Health check
		try {
			logger.info({ projectId }, "Test 2: Checking OpenCode health");
			const client = getOpencodeClient(projectId, project.opencodePort);
			const health = await client.global.health();
			(results.tests as Record<string, unknown>)["health_check"] = {
				status: health.response?.ok ? "success" : "failed",
				responseOk: health.response?.ok,
			};
		} catch (error) {
			(results.tests as Record<string, unknown>)["health_check"] = {
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
			};
		}

		// Test 3: Create session
		try {
			logger.info({ projectId }, "Test 3: Creating session");
			const client = getOpencodeClient(projectId, project.opencodePort);
			const session = await client.session.create();
			const sessionId = (session.data as Record<string, unknown>)?.id;
			(results.tests as Record<string, unknown>)["session_creation"] = {
				status: sessionId ? "success" : "failed",
				sessionId,
				hasData: !!session.data,
			};

			// Test 4: Fetch session messages (only if session was created)
			if (sessionId) {
				try {
					logger.info(
						{ projectId, sessionId },
						"Test 4: Fetching session messages",
					);
					const messages = await client.session.messages({
						sessionID: sessionId as string,
					});
					(results.tests as Record<string, unknown>)["fetch_messages"] = {
						status: "success",
						hasData: !!messages.data,
						messageCount: Array.isArray(messages.data)
							? messages.data.length
							: 0,
					};
				} catch (error) {
					(results.tests as Record<string, unknown>)["fetch_messages"] = {
						status: "failed",
						error: error instanceof Error ? error.message : String(error),
					};
				}
			}
		} catch (error) {
			(results.tests as Record<string, unknown>)["session_creation"] = {
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
			};
		}

		logger.info({ projectId, results }, "OpenCode diagnostic test completed");

		return new Response(JSON.stringify(results), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		logger.error(
			{
				projectId,
				error: error instanceof Error ? error.message : String(error),
			},
			"OpenCode diagnostic test failed",
		);

		return new Response(
			JSON.stringify({
				error: "Diagnostic test failed",
				projectId,
				message: error instanceof Error ? error.message : String(error),
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
};
