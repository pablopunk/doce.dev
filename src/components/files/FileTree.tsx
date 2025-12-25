import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeNode {
	name: string;
	type: "file" | "directory";
	path: string;
	children?: FileTreeNode[];
}

interface FileTreeProps {
	files: FileTreeNode[];
	onFileSelect: (path: string) => void;
	selectedPath?: string | undefined;
}

export function FileTree({
	files,
	onFileSelect,
	selectedPath,
}: FileTreeProps) {
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

	const toggleExpanded = (path: string) => {
		const newExpanded = new Set(expandedPaths);
		if (newExpanded.has(path)) {
			newExpanded.delete(path);
		} else {
			newExpanded.add(path);
		}
		setExpandedPaths(newExpanded);
	};

	const renderNode = (node: FileTreeNode, depth: number = 0) => {
		const isDirectory = node.type === "directory";
		const isExpanded = expandedPaths.has(node.path);
		const isSelected = selectedPath === node.path;

		return (
			<div key={node.path}>
				<button
					onClick={() => {
						if (isDirectory) {
							toggleExpanded(node.path);
						} else {
							onFileSelect(node.path);
						}
					}}
					className={cn(
						// Base styles from sidebarMenuButton
						"ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground gap-2 rounded-md p-2 text-left text-sm transition-[width,height,padding] focus-visible:ring-2 peer/menu-button flex w-full items-center overflow-hidden outline-hidden [&>span:last-child]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
						// Active state
						isSelected && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
						// Disabled state
						"disabled:pointer-events-none disabled:opacity-50"
					)}
					style={{ paddingLeft: `${depth * 12 + 8}px` }}
				>
					{isDirectory && (
						<ChevronRight
							className={`h-4 w-4 flex-shrink-0 transition-transform ${
								isExpanded ? "rotate-90" : ""
							}`}
						/>
					)}
					{!isDirectory && <div className="h-4 w-4 flex-shrink-0" />}

					{isDirectory ? (
						isExpanded ? (
							<FolderOpen className="h-4 w-4 flex-shrink-0 text-blue-400" />
						) : (
							<Folder className="h-4 w-4 flex-shrink-0 text-blue-400" />
						)
					) : (
						<File className="h-4 w-4 flex-shrink-0 text-gray-400" />
					)}

					<span className="truncate">{node.name}</span>
				</button>

				{isDirectory && isExpanded && node.children && (
					<div>
						{node.children.map((child) => renderNode(child, depth + 1))}
					</div>
				)}
			</div>
		);
	};

	if (files.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
				No files found
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full overflow-y-auto p-2">
			{files.map((node) => renderNode(node))}
		</div>
	);
}
