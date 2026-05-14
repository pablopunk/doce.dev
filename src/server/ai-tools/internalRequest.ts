import { logger } from "@/server/logger";
import { getProjectById } from "@/server/projects/projects.model";
import { verifyProjectInternalToken } from "./projectToken";

export interface InternalCallResult {
	projectId: string;
	ownerUserId: string;
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export interface InternalRequestBody {
	projectId?: unknown;
	token?: unknown;
}

export async function parseInternalRequest(
	request: Request,
): Promise<
	{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }
> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return { ok: false, response: jsonResponse(400, { error: "Invalid JSON" }) };
	}

	if (typeof raw !== "object" || raw === null) {
		return {
			ok: false,
			response: jsonResponse(400, { error: "Body must be an object" }),
		};
	}

	return { ok: true, body: raw as Record<string, unknown> };
}

export async function authorizeInternalCall(
	body: Record<string, unknown>,
): Promise<
	{ ok: true; result: InternalCallResult } | { ok: false; response: Response }
> {
	const projectId =
		typeof body.projectId === "string" ? body.projectId : undefined;
	const token = typeof body.token === "string" ? body.token : undefined;

	if (!projectId) {
		return {
			ok: false,
			response: jsonResponse(400, { error: "projectId is required" }),
		};
	}

	if (!token) {
		return {
			ok: false,
			response: jsonResponse(401, { error: "token is required" }),
		};
	}

	const valid = await verifyProjectInternalToken(projectId, token);
	if (!valid) {
		logger.warn({ projectId }, "Rejected internal tool call: invalid token");
		return {
			ok: false,
			response: jsonResponse(403, { error: "Invalid project token" }),
		};
	}

	const project = await getProjectById(projectId);
	if (!project) {
		return {
			ok: false,
			response: jsonResponse(404, { error: "Project not found" }),
		};
	}

	return {
		ok: true,
		result: { projectId, ownerUserId: project.ownerUserId },
	};
}

export { jsonResponse };
