import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { APIRoute } from "astro";
import { requireAuthenticatedProjectAccess } from "@/server/auth/validators";

interface FileTreeNode {
	name: string;
	type: "file" | "directory";
	path: string;
	children?: FileTreeNode[];
}

interface FilesTreeResponse {
	tree: FileTreeNode[];
	error?: string;
}

interface FileContentResponse {
	path: string;
	content: string;
	encoding: "utf-8";
	error?: string;
}

/**
 * Recursively build file tree from directory
 */
async function buildFileTree(
	dirPath: string,
	basePath: string,
): Promise<FileTreeNode[]> {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });
		const nodes: FileTreeNode[] = [];

		for (const entry of entries) {
			// Skip hidden files/folders
			if (entry.name.startsWith(".")) {
				continue;
			}

			const fullPath = path.join(dirPath, entry.name);
			const relativePath = path.relative(basePath, fullPath);

			if (entry.isDirectory()) {
				const children = await buildFileTree(fullPath, basePath);
				nodes.push({
					name: entry.name,
					type: "directory",
					path: relativePath,
					children,
				});
			} else {
				nodes.push({
					name: entry.name,
					type: "file",
					path: relativePath,
				});
			}
		}

		// Sort: directories first, then alphabetically
		nodes.sort((a, b) => {
			if (a.type === "directory" && b.type === "file") return -1;
			if (a.type === "file" && b.type === "directory") return 1;
			return a.name.localeCompare(b.name);
		});

		return nodes;
	} catch {
		return [];
	}
}

export const GET: APIRoute = async ({ params, request, cookies }) => {
	const authResult = await requireAuthenticatedProjectAccess(
		cookies,
		params.id ?? "",
	);
	if (!authResult.success) {
		return new Response(
			JSON.stringify({
				error:
					authResult.response.status === 401 ? "Unauthorized" : "Not found",
			} as FilesTreeResponse),
			{
				status: authResult.response.status,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const { project } = authResult;

	// Check if this is a file content request
	const url = new URL(request.url);
	const filePath = url.searchParams.get("path");

	if (filePath) {
		// Serve file content
		try {
			// Validate path doesn't escape src/
			const projectPath = project.path;
			const srcPath = path.join(projectPath, "src");
			// filePath is relative to src/, so join with srcPath
			const fullPath = path.join(srcPath, filePath);

			// Ensure the resolved path is within src/
			const resolvedPath = path.resolve(fullPath);
			const resolvedSrcPath = path.resolve(srcPath) + path.sep;

			if (!resolvedPath.startsWith(resolvedSrcPath)) {
				return new Response(
					JSON.stringify({
						error: `Invalid file path: ${resolvedPath} does not start with ${resolvedSrcPath}`,
					} as FileContentResponse),
					{
						status: 403,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			const content = await fs.readFile(fullPath, "utf-8");

			return new Response(
				JSON.stringify({
					path: filePath,
					content,
					encoding: "utf-8",
				} as FileContentResponse),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			return new Response(
				JSON.stringify({
					error: "Failed to read file",
				} as FileContentResponse),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

	// Serve file tree
	try {
		const projectPath = project.path;
		const srcPath = path.join(projectPath, "src");

		// Check if src directory exists
		try {
			await fs.access(srcPath);
		} catch {
			return new Response(
				JSON.stringify({
					tree: [],
				} as FilesTreeResponse),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const tree = await buildFileTree(srcPath, srcPath);

		return new Response(JSON.stringify({ tree } as FilesTreeResponse), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: "Failed to read files",
			} as FilesTreeResponse),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
