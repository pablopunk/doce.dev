import path from "node:path";
import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { runComposeCommand } from "@/server/docker/compose";
import { logger } from "@/server/logger";
import { getProjectById } from "@/server/projects/projects.model";

const SESSION_COOKIE_NAME = "doce_session";

export const POST: APIRoute = async ({ params, cookies }) => {
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
	if (!projectId) {
		return new Response(JSON.stringify({ error: "Project ID required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const project = await getProjectById(projectId);

		if (!project || project.ownerUserId !== session.user.id) {
			return new Response(JSON.stringify({ error: "Not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		const previewPath = path.join(project.pathOnDisk, "preview");
		logger.info({ projectId }, "Restarting preview container");

		const result = await runComposeCommand(projectId, previewPath, [
			"restart",
			"preview",
		]);

		if (!result.success) {
			logger.error(
				{ projectId, error: result.stderr },
				"Failed to restart preview container",
			);
			return new Response(
				JSON.stringify({
					error: "Failed to restart preview container",
					details: result.stderr,
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		logger.info({ projectId }, "Preview container restarted successfully");

		return new Response(
			JSON.stringify({
				success: true,
				message: "Preview container restarted",
				output: result.stdout,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		logger.error(
			{ projectId, error: message },
			"Error restarting preview container",
		);
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
