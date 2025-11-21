import fs from "fs/promises";
import path from "path";
import env from "./env";

export async function getProjectPath(projectId: string): Promise<string> {
	return path.join(env.projectsDir, projectId);
}

export async function ensureProjectDirectory(
	projectId: string,
): Promise<string> {
	const projectPath = await getProjectPath(projectId);
	await fs.mkdir(projectPath, { recursive: true });
	return projectPath;
}

export async function writeProjectFile(
	projectId: string,
	filePath: string,
	content: string,
): Promise<void> {
	const projectPath = await ensureProjectDirectory(projectId);
	const fullPath = path.join(projectPath, filePath);
	const fileDir = path.dirname(fullPath);

	// Ensure directory exists
	await fs.mkdir(fileDir, { recursive: true });

	// Write file
	await fs.writeFile(fullPath, content, "utf-8");
}

export async function writeProjectFiles(
	projectId: string,
	files: Array<{ path: string; content: string }>,
): Promise<void> {
	const projectPath = await ensureProjectDirectory(projectId);

	for (const file of files) {
		const filePath = path.join(projectPath, file.path);
		const fileDir = path.dirname(filePath);

		// Ensure directory exists
		await fs.mkdir(fileDir, { recursive: true });

		// Write file
		await fs.writeFile(filePath, file.content, "utf-8");
	}
}

export async function readProjectFile(
	projectId: string,
	filePath: string,
): Promise<string | null> {
	try {
		const projectPath = await getProjectPath(projectId);
		const fullPath = path.join(projectPath, filePath);
		return await fs.readFile(fullPath, "utf-8");
	} catch (error) {
		return null;
	}
}

export async function deleteProjectFiles(projectId: string): Promise<void> {
	const projectPath = await getProjectPath(projectId);
	try {
		await fs.rm(projectPath, { recursive: true, force: true });
	} catch (error) {
		console.error(`Failed to delete project files for ${projectId}:`, error);
	}
}

export async function listProjectFiles(projectId: string): Promise<string[]> {
	const projectPath = await getProjectPath(projectId);
	const files: string[] = [];

	async function walk(dir: string, baseDir = "") {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				const relativePath = path.join(baseDir, entry.name);

				if (entry.isDirectory()) {
					// Skip node_modules and .next
					if (entry.name !== "node_modules" && entry.name !== ".next") {
						await walk(path.join(dir, entry.name), relativePath);
					}
				} else {
					files.push(relativePath);
				}
			}
		} catch (error) {
			// Directory doesn't exist yet
		}
	}

	await walk(projectPath);
	return files;
}

// Helper for code browser: list only files under src/ to keep
// the payload small and avoid walking build output, node_modules, etc.
export async function listProjectSrcFiles(
	projectId: string,
): Promise<string[]> {
	const projectPath = await getProjectPath(projectId);
	const srcRoot = path.join(projectPath, "src");
	const files: string[] = [];

	async function walk(dir: string, baseDir = "") {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				const relativePath = path.join(baseDir, entry.name);

				if (entry.isDirectory()) {
					await walk(path.join(dir, entry.name), relativePath);
				} else {
					files.push(path.join("src", relativePath));
				}
			}
		} catch (error) {
			// src directory may not exist yet; treat as empty
		}
	}

	await walk(srcRoot);
	return files;
}

// Helper to read a file under src/ by its src-relative path.
export async function readProjectSrcFile(
	projectId: string,
	srcRelativePath: string,
): Promise<string | null> {
	// Normalise to ensure we always read from src/ and not allow escaping.
	const projectPath = await getProjectPath(projectId);
	const safeRelative = srcRelativePath.replace(/^src\//, "");
	const fullPath = path.join(projectPath, "src", safeRelative);

	try {
		return await fs.readFile(fullPath, "utf-8");
	} catch {
		return null;
	}
}
