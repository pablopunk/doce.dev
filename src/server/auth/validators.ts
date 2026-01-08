import { cookies } from "astro";
import type { AstroCookies } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projects } from "@/server/db/schema";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";
import type { Session } from "./sessions";
import { validateSession } from "./sessions";

const SESSION_COOKIE_NAME = "doce_session";

/**
 * Response types for validation errors
 */
export type ValidationError = {
	success: false;
	response: Response;
};

export type AuthResult = {
	success: true;
	session: Session;
	user: Session["user"];
};
export type ProjectAccessResult = {
	success: true;
	project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>;
};

/**
 * Authenticate a request using session cookie
 * @param cookies - Astro cookies object
 * @returns AuthResult or ValidationError
 */
export async function requireAuthenticatedRequest(
	cookies: AstroCookies,
): Promise<AuthResult | ValidationError> {
	const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!sessionToken) {
		return {
			success: false,
			response: new Response("Unauthorized", { status: 401 }),
		};
	}

	const session = await validateSession(sessionToken);
	if (!session) {
		return {
			success: false,
			response: new Response("Unauthorized", { status: 401 }),
		};
	}

	return { success: true, session, user: session.user };
}

/**
 * Verify project access and return project
 * @param userId - User ID from session
 * @param projectId - Project ID to verify
 * @returns ProjectAccessResult or ValidationError
 */
export async function requireProjectAccess(
	userId: string,
	projectId: string,
): Promise<ProjectAccessResult | ValidationError> {
	if (!projectId) {
		return {
			success: false,
			response: new Response("Project ID required", { status: 400 }),
		};
	}

	const isOwner = await isProjectOwnedByUser(projectId, userId);
	if (!isOwner) {
		return {
			success: false,
			response: new Response("Not found", { status: 404 }),
		};
	}

	const project = await getProjectById(projectId);
	if (!project) {
		return {
			success: false,
			response: new Response("Not found", { status: 404 }),
		};
	}

	return { success: true, project };
}

/**
 * Combined helper: authenticate and verify project access
 * @param cookies - Astro cookies object
 * @param projectId - Project ID to verify
 * @returns Object with session, user, and project, or ValidationError
 */
export async function requireAuthenticatedProjectAccess(
	cookies: AstroCookies,
	projectId: string,
): Promise<
	| {
			success: true;
			session: Session;
			user: Session["user"];
			project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>;
	  }
	| ValidationError
> {
	const authResult = await requireAuthenticatedRequest(cookies);
	if (!authResult.success) {
		return authResult;
	}

	const projectResult = await requireProjectAccess(
		authResult.user.id,
		projectId,
	);
	if (!projectResult.success) {
		return projectResult;
	}

	return {
		success: true,
		session: authResult.session,
		user: authResult.user,
		project: projectResult.project,
	};
}
