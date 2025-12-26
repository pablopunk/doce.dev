import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { isProjectOwnedByUser } from "@/server/projects/projects.model";
import { handlePresenceHeartbeat } from "@/server/presence/manager";

const SESSION_COOKIE_NAME = "doce_session";

export const POST: APIRoute = async ({ params, request, cookies }) => {
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
	if (!projectId) {
		return new Response(JSON.stringify({ error: "Project ID required" }), {
			status: 400,
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

	// Parse request body
	let viewerId: string;
	try {
		const body = await request.json();
		viewerId = body.viewerId;
		if (!viewerId || typeof viewerId !== "string") {
			throw new Error("viewerId required");
		}
	} catch {
		return new Response(JSON.stringify({ error: "Invalid request body" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const response = await handlePresenceHeartbeat(projectId, viewerId);
		return new Response(JSON.stringify(response), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
