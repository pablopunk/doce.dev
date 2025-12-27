import * as fs from "node:fs/promises";
import * as path from "node:path";

export const ALLOWED_EXTENSIONS = new Set([
	// Images
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"svg",
	// Media
	"mp4",
	"webm",
	"mp3",
	"wav",
	// Documents
	"pdf",
	"json",
	"txt",
	"md",
	"csv",
]);

export function sanitizeFilename(filename: string): string {
	return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function getFileExtension(filename: string): string {
	const parts = filename.split(".");
	if (parts.length < 2) return "";
	const ext = parts[parts.length - 1];
	return (ext ?? "").toLowerCase();
}

export function isAllowedExtension(extension: string): boolean {
	return ALLOWED_EXTENSIONS.has(extension.toLowerCase());
}

interface AssetFile {
	name: string;
	path: string;
	size: number;
	mimeType: string;
	isImage: boolean;
}

export async function buildAssetsList(
	publicPath: string,
): Promise<AssetFile[]> {
	try {
		const entries = await fs.readdir(publicPath, { withFileTypes: true });
		const assets: AssetFile[] = [];

		for (const entry of entries) {
			// Skip hidden files and directories
			if (entry.name.startsWith(".")) {
				continue;
			}

			// Only include files, skip directories
			if (!entry.isFile()) {
				continue;
			}

			const fullPath = path.join(publicPath, entry.name);
			const stats = await fs.stat(fullPath);
			const ext = getFileExtension(entry.name);

			// Only include files with allowed extensions
			if (!isAllowedExtension(ext)) {
				continue;
			}

			const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
				ext.toLowerCase(),
			);

			assets.push({
				name: entry.name,
				path: entry.name,
				size: stats.size,
				mimeType: `application/${ext}`,
				isImage,
			});
		}

		// Sort alphabetically
		assets.sort((a, b) => a.name.localeCompare(b.name));
		return assets;
	} catch {
		return [];
	}
}
