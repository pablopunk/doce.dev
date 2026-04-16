import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";

const PROJECT_PROMPT_DIRECTORY = ".doce";
const PROJECT_PROMPT_FILENAME = "project-prompt.md";

function getProjectPromptFilePath(projectPreviewPath: string): string {
	return path.join(
		projectPreviewPath,
		PROJECT_PROMPT_DIRECTORY,
		PROJECT_PROMPT_FILENAME,
	);
}

function renderProjectPromptMarkdown(prompt: string): string {
	return `# Original Project Prompt\n\n${prompt.trim()}\n`;
}

export async function ensureProjectPromptFile(
	projectPreviewPath: string,
	prompt: string,
): Promise<void> {
	const promptFilePath = getProjectPromptFilePath(projectPreviewPath);

	try {
		await fs.mkdir(path.dirname(promptFilePath), { recursive: true });
		await fs.writeFile(promptFilePath, renderProjectPromptMarkdown(prompt));
		logger.debug({ promptFilePath }, "Ensured project prompt file");
	} catch (error) {
		logger.warn(
			{ promptFilePath, error },
			"Failed to ensure project prompt file",
		);
	}
}

export function getProjectPromptRelativePath(): string {
	return `${PROJECT_PROMPT_DIRECTORY}/${PROJECT_PROMPT_FILENAME}`;
}
