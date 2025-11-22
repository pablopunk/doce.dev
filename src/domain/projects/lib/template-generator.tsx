import fs from "fs/promises";
import path from "path";

interface TemplateFile {
	path: string;
	content: string;
}

/**
 * Copies template files from the templates directory to a project
 * Uses a single, self-contained astro-starter template
 */
export async function copyTemplateToProject(
	templateName: string,
): Promise<TemplateFile[]> {
	const templateDir = path.join(process.cwd(), "templates", templateName);
	const files: TemplateFile[] = [];

	async function walkDirectory(dir: string, baseDir = ""): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const relativePath = path.join(baseDir, entry.name);
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip heavy or generated directories
				if (
					entry.name === "node_modules" ||
					entry.name === ".pnpm-store" ||
					entry.name === ".git"
				) {
					continue;
				}
				await walkDirectory(fullPath, relativePath);
			} else if (entry.isFile()) {
				const content = await fs.readFile(fullPath, "utf-8");
				files.push({
					path: relativePath,
					content,
				});
			}
		}
	}

	// Copy base template files (excluding node_modules/.pnpm-store/.git)
	await walkDirectory(templateDir);

	return files;
}

/**
 * Lists available templates
 */
export async function listTemplates(): Promise<string[]> {
	const templatesDir = path.join(process.cwd(), "templates");
	try {
		const entries = await fs.readdir(templatesDir, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);
	} catch (error) {
		console.error("Failed to list templates:", error);
		return [];
	}
}
