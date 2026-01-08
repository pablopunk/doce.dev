import type { APIRoute } from "astro";
import { handlePresenceHeartbeat } from "@/server/presence/manager";
import { requireAuthenticatedProjectAccess } from "@/server/auth/validators";

export const POST: APIRoute = async ({ params, request, cookies }) => {
	// Authenticate and verify project access
	const authResult = await requireAuthenticatedProjectAccess(
		cookies,
		params.id ?? "",
	);
	if (!authResult.success) {
		const jsonResponse = JSON.stringify({
			error: authResult.response.status === 401 ? "Unauthorized" : "Not found",
		});
		return new Response(jsonResponse, {
			status: authResult.response.status,
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
		const response = await handlePresenceHeartbeat(
			authResult.project.id,
			viewerId,
		);
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
