import fs from "fs/promises";
import path from "path";

interface TemplateFile {
	path: string;
	content: string;
}

/**
 * Copies template files from the templates directory to a project
 */
export async function copyTemplateToProject(
	templateName: string,
): Promise<TemplateFile[]> {
	const templateDir = path.join(process.cwd(), "templates", templateName);
	const sharedDir = path.join(process.cwd(), "templates");
	const files: TemplateFile[] = [];

	async function walkDirectory(dir: string, baseDir = ""): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const relativePath = path.join(baseDir, entry.name);
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
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

	await walkDirectory(templateDir);

	// Also copy any shared docker-compose files that live alongside templates
	// (eg. templates/docker-compose.dev.yml, templates/docker-compose.prod.yml)
	try {
		const sharedEntries = await fs.readdir(sharedDir, { withFileTypes: true });
		for (const entry of sharedEntries) {
			if (!entry.isFile()) continue;
			if (!entry.name.startsWith("docker-compose.")) continue;
			const fullPath = path.join(sharedDir, entry.name);
			const content = await fs.readFile(fullPath, "utf-8");
			files.push({ path: entry.name, content });
		}
	} catch (error) {
		console.error("Failed to copy shared docker-compose files:", error);
	}

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
