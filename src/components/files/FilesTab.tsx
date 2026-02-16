import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResizableSeparator } from "@/components/preview/ResizableSeparator";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { FileTree } from "./FileTree";
import { ReadOnlyEditor } from "./ReadOnlyEditor";

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

interface FilesTabProps {
	projectId: string;
	lastSelectedFile?: string | null;
	onFileSelect?: (path: string) => void;
}

/**
 * Get all ancestor directory paths for a file path.
 * e.g., "pages/api/index.ts" => ["pages", "pages/api"]
 */
function getAncestorPaths(filePath: string): string[] {
	const parts = filePath.split("/");
	// Remove the filename (last part)
	parts.pop();

	const ancestors: string[] = [];
	let currentPath = "";
	for (const part of parts) {
		currentPath = currentPath ? `${currentPath}/${part}` : part;
		ancestors.push(currentPath);
	}
	return ancestors;
}

export function FilesTab({
	projectId,
	lastSelectedFile,
	onFileSelect,
}: FilesTabProps) {
	const [files, setFiles] = useState<FileTreeNode[]>([]);
	const [selectedPath, setSelectedPath] = useState<string | null>(
		lastSelectedFile ?? null,
	);
	const [fileContent, setFileContent] = useState<string>("");
	const [isLoadingTree, setIsLoadingTree] = useState(true);
	const [isLoadingContent, setIsLoadingContent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
	const containerRef = useRef<HTMLDivElement>(null);

	const { leftPercent, rightPercent, isDragging, onSeparatorMouseDown } =
		useResizablePanel({
			projectId: `files_${projectId}`,
			minSize: 20,
			maxSize: 50,
			defaultSize: 25,
			containerRef,
		});

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
		[onFileSelect, projectId],
	);

	// Fetch file tree on mount
	useEffect(() => {
		const fetchFileTree = async () => {
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

					// If we have a last selected file and it exists, fetch it
					if (lastSelectedFile && data.tree && data.tree.length > 0) {
						// Expand ancestors to reveal the file in tree
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
		};

		fetchFileTree();
	}, [projectId, lastSelectedFile, fetchFileContent]);

	if (isLoadingTree) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="flex flex-col items-center gap-2 text-muted-foreground">
					<Loader2 className="h-8 w-8 animate-spin" />
					<p className="text-sm">Loading files...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="flex flex-col items-center gap-2 text-center p-4">
					<AlertTriangle className="h-8 w-8 text-status-error" />
					<p className="text-sm text-status-error font-medium">Error</p>
					<p className="text-xs text-muted-foreground max-w-xs">{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col h-full overflow-hidden">
			<div
				className="flex-1 flex overflow-hidden relative"
				data-resizable-group
				ref={containerRef}
			>
				{/* File Tree (left) */}
				<div
					className="flex flex-col h-full border-r overflow-hidden bg-muted/20"
					style={{ width: `${leftPercent}%` }}
				>
					<FileTree
						files={files}
						onFileSelect={fetchFileContent}
						selectedPath={selectedPath || undefined}
						expandedPaths={expandedPaths}
						onExpandedPathsChange={setExpandedPaths}
					/>
				</div>

				{/* Draggable separator */}
				<ResizableSeparator onMouseDown={onSeparatorMouseDown} />

				{/* Editor (right) */}
				<div
					className="flex flex-col h-full overflow-hidden"
					style={{ width: `${rightPercent}%` }}
				>
					{selectedPath ? (
						<ReadOnlyEditor
							filePath={selectedPath}
							content={fileContent}
							isLoading={isLoadingContent}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground">
							<p className="text-sm">Select a file to view its contents</p>
						</div>
					)}
				</div>

				{/* Transparent overlay to capture mouse events during drag */}
				{isDragging && (
					<div
						style={{
							position: "fixed",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							zIndex: 50,
							cursor: "col-resize",
							backgroundColor: "transparent",
						}}
					/>
				)}
			</div>
		</div>
	);
}
