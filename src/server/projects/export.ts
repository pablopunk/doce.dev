import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ZipFile } from "yazl";
import type { Project } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { getProjectPreviewPathFromRoot } from "@/server/projects/paths";

const PREVIEW_EXPORT_EXCLUDED_PATHS = new Set([
	".astro",
	"dist",
	"logs",
	"node_modules",
]);

const PREVIEW_EXPORT_EXCLUDED_FILENAMES = new Set([".DS_Store"]);

function sanitizeArchiveName(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9-_]+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "") || "project"
	);
}

function shouldExcludeRelativePath(relativePath: string): boolean {
	const segments = relativePath.split(path.sep);
	return segments.some((segment) => PREVIEW_EXPORT_EXCLUDED_PATHS.has(segment));
}

async function collectPreviewFiles(
	rootPath: string,
	currentRelativePath = "",
): Promise<string[]> {
	const currentPath = path.join(rootPath, currentRelativePath);
	const entries = await fs.readdir(currentPath, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		if (PREVIEW_EXPORT_EXCLUDED_FILENAMES.has(entry.name)) {
			continue;
		}

		const nextRelativePath = currentRelativePath
			? path.join(currentRelativePath, entry.name)
			: entry.name;

		if (shouldExcludeRelativePath(nextRelativePath)) {
			continue;
		}

		if (entry.isDirectory()) {
			files.push(...(await collectPreviewFiles(rootPath, nextRelativePath)));
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		files.push(nextRelativePath);
	}

	return files;
}

async function buildPreviewArchiveBuffer(
	previewPath: string,
	archiveRootName: string,
): Promise<Buffer> {
	const zip = new ZipFile();
	const chunks: Buffer[] = [];
	const outputCompleted = new Promise<void>((resolve, reject) => {
		zip.outputStream.on("data", (chunk: Buffer) => {
			chunks.push(chunk);
		});
		zip.outputStream.on("end", () => resolve());
		zip.outputStream.on("error", reject);
	});

	const files = await collectPreviewFiles(previewPath);

	for (const relativeFilePath of files) {
		const sourcePath = path.join(previewPath, relativeFilePath);
		const archivePath = path.posix.join(
			archiveRootName,
			relativeFilePath.split(path.sep).join(path.posix.sep),
		);
		zip.addFile(sourcePath, archivePath);
	}

	zip.end();
	await outputCompleted;

	return Buffer.concat(chunks);
}

export async function exportProjectPreviewSource(project: Project): Promise<{
	fileName: string;
	buffer: Buffer;
}> {
	const previewPath = getProjectPreviewPathFromRoot(project.pathOnDisk);
	const archiveBaseName = sanitizeArchiveName(project.slug || project.name);
	const archiveRootName = `${archiveBaseName}-preview-source`;
	const fileName = `${archiveRootName}.zip`;

	logger.info(
		{ projectId: project.id, previewPath },
		"[ProjectExport] Building preview source archive",
	);

	const buffer = await buildPreviewArchiveBuffer(previewPath, archiveRootName);

	logger.info(
		{ projectId: project.id, fileName, sizeBytes: buffer.byteLength },
		"[ProjectExport] Built preview source archive",
	);

	return { fileName, buffer };
}
