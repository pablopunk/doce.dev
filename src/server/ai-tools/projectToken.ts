import { randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getProjectPreviewPath } from "@/server/projects/paths";

const TOKEN_FILENAME = ".doce-internal-token";
const TOKEN_BYTES = 32;

function getTokenPath(projectId: string): string {
	return path.join(getProjectPreviewPath(projectId), TOKEN_FILENAME);
}

export async function ensureProjectInternalToken(
	projectId: string,
): Promise<string> {
	const tokenPath = getTokenPath(projectId);

	try {
		const existing = (await fs.readFile(tokenPath, "utf-8")).trim();
		if (existing.length >= 32) {
			return existing;
		}
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code !== "ENOENT") {
			throw error;
		}
	}

	const token = randomBytes(TOKEN_BYTES).toString("hex");
	await fs.mkdir(path.dirname(tokenPath), { recursive: true });
	await fs.writeFile(tokenPath, `${token}\n`, { mode: 0o600 });
	return token;
}

export async function readProjectInternalToken(
	projectId: string,
): Promise<string | null> {
	try {
		const token = (await fs.readFile(getTokenPath(projectId), "utf-8")).trim();
		return token.length >= 32 ? token : null;
	} catch {
		return null;
	}
}

export async function verifyProjectInternalToken(
	projectId: string,
	candidate: string | null | undefined,
): Promise<boolean> {
	if (!candidate) return false;
	const stored = await readProjectInternalToken(projectId);
	if (!stored) return false;
	if (stored.length !== candidate.length) return false;

	let mismatch = 0;
	for (let i = 0; i < stored.length; i += 1) {
		mismatch |= stored.charCodeAt(i) ^ candidate.charCodeAt(i);
	}
	return mismatch === 0;
}
