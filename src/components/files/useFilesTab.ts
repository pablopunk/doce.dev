import { useCallback, useEffect, useState } from "react";

interface FileTreeNode {
	name: string;
	type: "file" | "directory";
	path: string;
	children?: FileTreeNode[];
}

interface FileContentResponse {
	path: string;
	content: string;
	encoding: "utf-8";
	error?: string;
}

interface FilesTreeResponse {
	tree: FileTreeNode[];
	error?: string;
}

interface UseFilesTabOptions {
	projectId: string;
	lastSelectedFile?: string | null;
	onFileSelect?: (path: string) => void;
}

interface UseFilesTabReturn {
	files: FileTreeNode[];
	selectedPath: string | null;
	fileContent: string;
	isLoadingTree: boolean;
	isLoadingContent: boolean;
	error: string | null;
	expandedPaths: Set<string>;
	setExpandedPaths: (paths: Set<string>) => void;
	fetchFileContent: (path: string) => Promise<void>;
}

export function useFilesTab({
	projectId,
	lastSelectedFile,
	onFileSelect,
}: UseFilesTabOptions): UseFilesTabReturn {
	const [files, setFiles] = useState<FileTreeNode[]>([]);
	const [selectedPath, setSelectedPath] = useState<string | null>(
		lastSelectedFile ?? null,
	);
	const [fileContent, setFileContent] = useState<string>("");
	const [isLoadingTree, setIsLoadingTree] = useState(true);
	const [isLoadingContent, setIsLoadingContent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

	const fetchFileContent = useCallback(
		async (path: string) => {
			try {
				setSelectedPath(path);
				setIsLoadingContent(true);
				setError(null);

				const response = await fetch(
					`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
				);

				if (!response.ok) {
					throw new Error("Failed to fetch file content");
				}

				const data = (await response.json()) as FileContentResponse;

				if (data.error) {
					setError(data.error);
					setFileContent("");
				} else {
					setFileContent(data.content);
					onFileSelect?.(path);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load file");
				setFileContent("");
			} finally {
				setIsLoadingContent(false);
			}
		},
		[projectId, onFileSelect],
	);

	const fetchFileTree = useCallback(async () => {
		try {
			setIsLoadingTree(true);
			setError(null);

			const response = await fetch(`/api/projects/${projectId}/files`);
			if (!response.ok) {
				throw new Error("Failed to fetch file tree");
			}

			const data = (await response.json()) as FilesTreeResponse;

			if (data.error) {
				setError(data.error);
				setFiles([]);
			} else {
				setFiles(data.tree || []);

				if (lastSelectedFile && data.tree && data.tree.length > 0) {
					const ancestors = getAncestorPaths(lastSelectedFile);
					setExpandedPaths((prev) => {
						const newPaths = new Set(prev);
						for (const ancestor of ancestors) {
							newPaths.add(ancestor);
						}
						return newPaths;
					});
					await fetchFileContent(lastSelectedFile);
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch files");
			setFiles([]);
		} finally {
			setIsLoadingTree(false);
		}
	}, [projectId, lastSelectedFile, fetchFileContent]);

	useEffect(() => {
		fetchFileTree();
	}, [fetchFileTree]);

	return {
		files,
		selectedPath,
		fileContent,
		isLoadingTree,
		isLoadingContent,
		error,
		expandedPaths,
		setExpandedPaths,
		fetchFileContent,
	};
}

function getAncestorPaths(filePath: string): string[] {
	const parts = filePath.split("/");
	parts.pop();

	const ancestors: string[] = [];
	let currentPath = "";
	for (const part of parts) {
		currentPath = currentPath ? `${currentPath}/${part}` : part;
		ancestors.push(currentPath);
	}
	return ancestors;
}
