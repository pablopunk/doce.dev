import { logger } from "@/server/logger";
import {
	getProjectByIdIncludeDeleted,
	updateProjectDescription,
} from "./projects.db";

const MAX_PROJECT_DESCRIPTION_LENGTH = 160;
const DEFAULT_SESSION_TITLE_PATTERN =
	/^(New session|Child session) - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const IGNORED_SESSION_TITLES = new Set([
	"new conversation",
	"new session",
	"untitled session",
]);

export function normalizeSessionTitleForProjectDescription(
	title: unknown,
): string | null {
	if (typeof title !== "string") return null;

	const description = title.trim().replace(/\s+/g, " ");
	if (!description) return null;
	if (DEFAULT_SESSION_TITLE_PATTERN.test(description)) return null;
	if (IGNORED_SESSION_TITLES.has(description.toLowerCase())) return null;

	return description.slice(0, MAX_PROJECT_DESCRIPTION_LENGTH).trim();
}

export async function updateProjectDescriptionFromSessionTitle(
	projectId: string,
	title: unknown,
): Promise<boolean> {
	const description = normalizeSessionTitleForProjectDescription(title);
	if (!description) return false;

	const project = await getProjectByIdIncludeDeleted(projectId);
	if (!project || project.status === "deleting") return false;
	if (project.description === description) return true;

	await updateProjectDescription(projectId, description);
	logger.info(
		{ projectId, description },
		"Updated project description from OpenCode session title",
	);
	return true;
}
