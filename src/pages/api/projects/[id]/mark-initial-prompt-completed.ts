import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { logger } from "@/server/logger";
import {
	getProjectById,
	isProjectOwnedByUser,
	markInitialPromptCompleted,
} from "@/server/projects/projects.model";

const SESSION_COOKIE_NAME = "doce_session";

export const POST: APIRoute = async ({ params, cookies }) => {
	// Validate session
	const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!sessionToken) {
		return new Response("Unauthorized", { status: 401 });
	}

	const session = await validateSession(sessionToken);
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const projectId = params.id;
	if (!projectId) {
		return new Response("Project ID required", { status: 400 });
	}

	// Verify project ownership
	const isOwner = await isProjectOwnedByUser(projectId, session.user.id);
	if (!isOwner) {
		return new Response("Not found", { status: 404 });
	}

	const project = await getProjectById(projectId);
	if (!project) {
		return new Response("Not found", { status: 404 });
	}

	try {
		await markInitialPromptCompleted(projectId);
		logger.info({ projectId }, "Marked initial prompt as completed");
		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		logger.error(
			{ error, projectId },
			"Failed to mark initial prompt as completed",
		);
		return new Response("Failed to mark initial prompt as completed", {
			status: 500,
		});
	}
};
