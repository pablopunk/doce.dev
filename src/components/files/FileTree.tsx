import { ChevronRight, File } from "lucide-react";
import { motion } from "motion/react";
import React, { useState } from "react";
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
	/** Paths to expand initially (e.g., to reveal a selected file) */
	expandedPaths?: Set<string>;
	/** Callback when expanded paths change */
	onExpandedPathsChange?: (paths: Set<string>) => void;
}

export const FileTree = React.memo(function FileTree({
	files,
	onFileSelect,
	selectedPath,
	expandedPaths: controlledExpandedPaths,
	onExpandedPathsChange,
}: FileTreeProps) {
	// Use controlled or uncontrolled mode
	const [internalExpandedPaths, setInternalExpandedPaths] = useState<
		Set<string>
	>(new Set());
	const expandedPaths = controlledExpandedPaths ?? internalExpandedPaths;

	const toggleExpanded = (path: string) => {
		const newExpanded = new Set(expandedPaths);
		if (newExpanded.has(path)) {
			newExpanded.delete(path);
		} else {
			newExpanded.add(path);
		}
		// Update either controlled or internal state
		if (onExpandedPathsChange) {
			onExpandedPathsChange(newExpanded);
		} else {
			setInternalExpandedPaths(newExpanded);
		}
	};

	const renderNode = (node: FileTreeNode, depth: number = 0) => {
		const isDirectory = node.type === "directory";
		const isExpanded = expandedPaths.has(node.path);
		const isSelected = selectedPath === node.path;

		return (
			<div key={node.path}>
				<button
					type="button"
					onClick={() => {
						if (isDirectory) {
							toggleExpanded(node.path);
						} else {
							onFileSelect(node.path);
						}
					}}
					className={cn(
						"ring-sidebar-ring hover:bg-muted active:bg-muted active:text-sidebar-accent-foreground gap-1 rounded-md px-2 py-1 text-left text-sm transition-[width,height,padding] focus-visible:ring-2 peer/menu-button flex w-full items-center overflow-hidden outline-hidden [&>span:last-child]:truncate [&_svg]:shrink-0",
						isSelected && "font-medium bg-muted",
						"disabled:pointer-events-none disabled:opacity-50",
					)}
					style={{ paddingLeft: `${depth * 12 + 8}px` }}
				>
					{isDirectory && (
						<motion.div
							animate={{ rotate: isExpanded ? 90 : 0 }}
							transition={{ duration: 0.15 }}
						>
							<ChevronRight size={12} className="flex-shrink-0" />
						</motion.div>
					)}

					{!isDirectory && (
						<File size={12} className="flex-shrink-0 text-gray-400" />
					)}

					<span className="truncate">{node.name}</span>
				</button>

				{isDirectory && node.children && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{
							height: isExpanded ? "auto" : 0,
							opacity: isExpanded ? 1 : 0,
						}}
						transition={{ duration: 0.2, ease: "easeOut" }}
						style={{ overflow: "hidden" }}
					>
						{node.children.map((child) => renderNode(child, depth + 1))}
					</motion.div>
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
});
