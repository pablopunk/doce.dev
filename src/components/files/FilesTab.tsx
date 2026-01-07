import { AlertTriangle, Loader2 } from "lucide-react";
import { useRef } from "react";
import { ResizableSeparator } from "@/components/preview/ResizableSeparator";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { FileTree } from "./FileTree";
import { ReadOnlyEditor } from "./ReadOnlyEditor";
import { useFilesTab } from "./useFilesTab";

interface FilesTabProps {
	projectId: string;
	lastSelectedFile?: string | null;
	onFileSelect?: (path: string) => void;
}

export function FilesTab({
	projectId,
	lastSelectedFile,
	onFileSelect,
}: FilesTabProps) {
	const {
		files,
		selectedPath,
		fileContent,
		isLoadingTree,
		isLoadingContent,
		error,
		expandedPaths,
		setExpandedPaths,
		fetchFileContent,
	} = useFilesTab({ projectId, lastSelectedFile, onFileSelect });

	const containerRef = useRef<HTMLDivElement>(null);

	const { leftPercent, rightPercent, isDragging, onSeparatorMouseDown } =
		useResizablePanel({
			projectId: `files_${projectId}`,
			minSize: 20,
			maxSize: 50,
			defaultSize: 25,
			containerRef,
		});

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
