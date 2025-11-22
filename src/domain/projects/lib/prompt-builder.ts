import fs from "fs/promises";
import path from "path";

/**
 * Loads the astro-starter AGENTS.md file (single source of truth
 * for generation rules for the astro-starter template).
 */
export async function loadStarterAgentsFile(): Promise<string> {
	const agentsPath = path.join(
		process.cwd(),
		"templates",
		"astro-starter",
		"AGENTS.md",
	);
	try {
		return await fs.readFile(agentsPath, "utf-8");
	} catch (error) {
		console.error("Failed to load astro-starter AGENTS.md:", error);
		return "";
	}
}

/**
 * Loads the markdown template used to build the AI generation prompt.
 */
export async function loadGenerationTemplateFile(): Promise<string> {
	const templatePath = path.join(
		process.cwd(),
		"src",
		"domain",
		"projects",
		"lib",
		"generation-prompt-template.md",
	);
	try {
		return await fs.readFile(templatePath, "utf-8");
	} catch (error) {
		console.error("Failed to load generation prompt template markdown:", error);
		return "";
	}
}

/**
 * Builds the complete prompt for AI generation using the unified astro-starter template.
 */
export async function buildGenerationPrompt(
	userPrompt: string,
): Promise<{ prompt: string }> {
	const [starterAgents, template] = await Promise.all([
		loadStarterAgentsFile(),
		loadGenerationTemplateFile(),
	]);

	const fullPrompt = template
		.replaceAll("{{USER_PROMPT}}", userPrompt)
		.replaceAll("{{STARTER_AGENTS}}", starterAgents);

	return {
		prompt: fullPrompt,
	};
}
