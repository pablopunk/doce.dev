import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import { ensureGlobalOpencodeStarted } from "@/server/opencode/runtime";
import {
	generateUniqueCreativeSlug,
	isSlugTaken,
	nameToSlug,
} from "@/server/projects/slug";

const NAMING_SYSTEM_PROMPT = `You are a creative project naming assistant. Given a project description, generate a short, memorable project name (2-4 words).

Requirements:
- Use only lowercase letters, numbers, and hyphens
- No spaces or special characters
- Maximum 40 characters
- Must be suitable as a URL slug
- Be creative, imaginative, and unique
- Use adjectives, colors, metaphors, or evocative concepts
- Even for similar projects, suggest different angles or descriptors

Examples:
- "minimal clock" → "chrono-minimal", "amber-ticker", "sleek-time"
- "todo app" → "task-flow", "done-daily", "check-mate"

Return only the project name, nothing else. No quotes, no explanation.`;

const TIMEOUT_MS = 10_000;

// Priority 1: Always try this model first - it's free and reliable
const PRIMARY_MODEL = {
	providerID: "opencode",
	modelID: "minimax-m2.5-free",
};

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

async function ensureUniqueProjectName(
	name: string,
	prompt: string,
): Promise<string> {
	if (!(await isSlugTaken(name))) {
		return name;
	}

	logger.info(
		{ name, prompt: prompt.slice(0, 80) },
		"Auto-generated project name already exists, generating creative variant",
	);
	return generateUniqueCreativeSlug(`${prompt} ${name}`);
}

function parseModelString(
	model: string,
): { providerID: string; modelID: string } | null {
	// Handle formats like "provider/model" or "provider/model/name"
	const [providerID, ...modelParts] = model.split("/");
	if (providerID && modelParts.length > 0) {
		return {
			providerID,
			modelID: modelParts.join("/"),
		};
	}
	return null;
}

async function generateNameWithModel(
	prompt: string,
	model: { providerID: string; modelID: string },
): Promise<string> {
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
				model,
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
 * Priority 1: Use opencode/minimax-m2.5-free (always works, free)
 * Priority 2: Use the fallback model if provided and different from primary
 * Priority 3: Use creative random fallback with variety
 *
 * @param prompt - The project description/prompt
 * @param fallbackModel - Optional model string (format: "provider/model") to try if primary fails
 * @returns A unique, creative project name
 */
export async function generateProjectName(
	prompt: string,
	fallbackModel?: string | null,
): Promise<string> {
	// Try primary model first
	try {
		const rawName = await generateNameWithModel(prompt, PRIMARY_MODEL);
		const normalized = nameToSlug(rawName);

		if (!normalized) {
			throw new Error("Empty normalized name from primary model");
		}

		const uniqueName = await ensureUniqueProjectName(normalized, prompt);

		logger.info(
			{
				prompt: prompt.slice(0, 80),
				name: uniqueName,
				model: PRIMARY_MODEL.modelID,
			},
			"Auto-named project via primary model",
		);
		return uniqueName;
	} catch (primaryError) {
		logger.warn(
			{
				error:
					primaryError instanceof Error
						? primaryError.message
						: String(primaryError),
			},
			"Primary auto-naming model failed, trying fallback",
		);
	}

	// Try fallback model if provided and different from primary
	if (fallbackModel) {
		const fallbackModelParsed = parseModelString(fallbackModel);
		if (
			fallbackModelParsed &&
			(fallbackModelParsed.providerID !== PRIMARY_MODEL.providerID ||
				fallbackModelParsed.modelID !== PRIMARY_MODEL.modelID)
		) {
			try {
				const rawName = await generateNameWithModel(
					prompt,
					fallbackModelParsed,
				);
				const normalized = nameToSlug(rawName);

				if (!normalized) {
					throw new Error("Empty normalized name from fallback model");
				}

				const uniqueName = await ensureUniqueProjectName(normalized, prompt);

				logger.info(
					{
						prompt: prompt.slice(0, 80),
						name: uniqueName,
						model: fallbackModel,
					},
					"Auto-named project via fallback model",
				);
				return uniqueName;
			} catch (fallbackError) {
				logger.warn(
					{
						error:
							fallbackError instanceof Error
								? fallbackError.message
								: String(fallbackError),
						model: fallbackModel,
					},
					"Fallback auto-naming model also failed",
				);
			}
		}
	}

	// Final fallback: creative random naming
	logger.info(
		{ prompt: prompt.slice(0, 80) },
		"Using creative random fallback for project naming",
	);
	return generateUniqueCreativeSlug(prompt);
}
