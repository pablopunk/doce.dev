import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import { ensureGlobalOpencodeStarted } from "@/server/opencode/runtime";
import { generateUniqueSlug, nameToSlug } from "@/server/projects/slug";

const NAMING_SYSTEM_PROMPT = `You are a project naming assistant. Given a project description, generate a short project name (2-4 words).

Requirements:
- Use only lowercase letters, numbers, and hyphens
- No spaces or special characters
- Maximum 40 characters
- Must be suitable as a URL slug
- Be creative and descriptive

Return only the project name, nothing else. No quotes, no explanation.`;

const TIMEOUT_MS = 10_000;

function extractTextFromParts(
	parts: Array<{ type: string; text?: string }>,
): string {
	for (const part of parts) {
		if (part.type === "text" && part.text) {
			return part.text.trim();
		}
	}
	return "";
}

async function generateNameViaOpenCode(prompt: string): Promise<string> {
	await ensureGlobalOpencodeStarted();
	const client = createOpencodeClient();

	const session = await client.session.create({});
	const sessionId = session.data?.id;

	if (!sessionId) {
		throw new Error("Failed to create temporary session for auto-naming");
	}

	try {
		const response = await Promise.race([
			client.session.prompt({
				sessionID: sessionId,
				parts: [{ type: "text" as const, text: prompt }],
				system: NAMING_SYSTEM_PROMPT,
				tools: {},
			}),
			new Promise<never>((_, reject) =>
				setTimeout(
					() => reject(new Error("Auto-naming timed out")),
					TIMEOUT_MS,
				),
			),
		]);

		const rawName = extractTextFromParts(
			(response.data?.parts as Array<{ type: string; text?: string }>) ?? [],
		);

		if (!rawName) {
			throw new Error("Empty response from OpenCode");
		}

		return rawName;
	} finally {
		client.session.delete({ sessionID: sessionId }).catch((err) => {
			logger.debug({ sessionId, err }, "Failed to delete temp naming session");
		});
	}
}

/**
 * Generate a project name using AI via the global OpenCode server.
 * Falls back to slug-based naming from the prompt if AI fails.
 */
export async function generateProjectName(prompt: string): Promise<string> {
	try {
		const rawName = await generateNameViaOpenCode(prompt);
		const normalized = nameToSlug(rawName);

		if (!normalized) {
			throw new Error("Empty normalized name");
		}

		logger.info(
			{ prompt: prompt.slice(0, 80), name: normalized },
			"Auto-named project via OpenCode",
		);
		return normalized;
	} catch (error) {
		logger.warn(
			{ error: error instanceof Error ? error.message : String(error) },
			"Auto-naming failed, using fallback slug",
		);
		return generateUniqueSlug(prompt);
	}
}
