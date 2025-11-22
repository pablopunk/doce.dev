import fs from "fs/promises";
import path from "path";

interface TemplateFile {
	path: string;
	content: string;
}

/**
 * Copies template files from the templates directory to a project
 * Always includes shadcn-tailwind design system
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

	// Copy base template files
	await walkDirectory(templateDir);

	// Always copy shadcn-tailwind design system files
	const designSystemDir = path.join(
		process.cwd(),
		"templates",
		"design-systems",
		"shadcn-tailwind",
	);

	try {
		// Copy components from design system
		const componentsDir = path.join(designSystemDir, "components");
		try {
			await walkDirectory(componentsDir, "src/components/ui");
		} catch (error) {
			console.warn(`No components found in shadcn-tailwind design system`);
		}

		// Copy layouts from design system
		const layoutsDir = path.join(designSystemDir, "layouts");
		try {
			await walkDirectory(layoutsDir, "src/layouts/ds");
		} catch (error) {
			console.warn(`No layouts found in shadcn-tailwind design system`);
		}

		// Copy styles from design system
		const stylesDir = path.join(designSystemDir, "styles");
		try {
			await walkDirectory(stylesDir, "src/styles/ds");
		} catch (error) {
			console.warn(`No styles found in shadcn-tailwind design system`);
		}
	} catch (error) {
		console.error(`Failed to copy design system files:`, error);
	}

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
