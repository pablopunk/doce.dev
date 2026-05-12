import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Project } from "@/server/db/schema";
import { createOpencodeClient } from "@/server/opencode/client";
import { getProjectPreviewPathFromRoot } from "@/server/projects/paths";

interface SessionInfoShape {
	id?: string;
	directory?: string | null;
}

export interface RestoreSafetyStatus {
	canRestore: boolean;
	reason: string | null;
	expectedDirectory: string;
	actualDirectory: string | null;
}

async function canonicalizeDirectory(directory: string): Promise<string> {
	try {
		return await fs.realpath(directory);
	} catch {
		return path.resolve(directory);
	}
}

export async function getRestoreSafetyStatus(
	project: Pick<Project, "pathOnDisk" | "bootstrapSessionId">,
): Promise<RestoreSafetyStatus> {
	const expectedDirectory = getProjectPreviewPathFromRoot(project.pathOnDisk);
	const sessionId = project.bootstrapSessionId;

	if (!sessionId) {
		return {
			canRestore: false,
			reason: "No active session for this project.",
			expectedDirectory,
			actualDirectory: null,
		};
	}

	const client = createOpencodeClient();
	const response = await client.session.get({ sessionID: sessionId });
	const info = (response.data ?? null) as SessionInfoShape | null;
	const actualDirectory = info?.directory ?? null;

	if (!actualDirectory) {
		return {
			canRestore: false,
			reason: "Session directory could not be verified.",
			expectedDirectory,
			actualDirectory: null,
		};
	}

	const [expectedCanonical, actualCanonical] = await Promise.all([
		canonicalizeDirectory(expectedDirectory),
		canonicalizeDirectory(actualDirectory),
	]);

	if (expectedCanonical !== actualCanonical) {
		return {
			canRestore: false,
			reason:
				"Restore is disabled because this session is attached to a different directory.",
			expectedDirectory: expectedCanonical,
			actualDirectory: actualCanonical,
		};
	}

	return {
		canRestore: true,
		reason: null,
		expectedDirectory: expectedCanonical,
		actualDirectory: actualCanonical,
	};
}
