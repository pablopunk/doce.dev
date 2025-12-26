import {
	Brain,
	FileCode,
	FileText,
	FolderSearch,
	Globe,
	ListTree,
	type LucideIcon,
	Pencil,
	Search,
	Terminal,
	Trash2,
	Wrench,
} from "lucide-react";
import type React from "react";

/**
 * Tool metadata for display purposes.
 */
export interface ToolInfo {
	/** Display name for the tool */
	name: string;
	/** Icon component */
	icon: LucideIcon;
	/** Icon color class */
	iconClass?: string;
	/** Extract context string from tool input */
	getContext?: (input: unknown) => string | null;
	/** If true, clicking the tool opens the file in Files tab instead of expanding */
	openFileOnClick?: boolean;
	/** Extract file path from tool input for openFileOnClick */
	getFilePath?: (input: unknown) => string | null;
}

/**
 * Custom tool renderer component props.
 */
export interface ToolRendererProps {
	name: string;
	input: unknown;
	output: unknown;
	error?: unknown;
	status: "running" | "success" | "error";
}

/**
 * Registry of tool metadata and renderers.
 */
const toolRegistry: Map<string, ToolInfo> = new Map();
const toolRenderers: Map<
	string,
	React.ComponentType<ToolRendererProps>
> = new Map();

/**
 * Register a tool's display metadata.
 */
export function registerTool(toolName: string, info: ToolInfo): void {
	toolRegistry.set(toolName, info);
}

/**
 * Register a custom renderer for a tool's expanded content.
 */
export function registerToolRenderer(
	toolName: string,
	renderer: React.ComponentType<ToolRendererProps>,
): void {
	toolRenderers.set(toolName, renderer);
}

/**
 * Get tool metadata for display.
 */
export function getToolInfo(toolName: string): ToolInfo {
	return (
		toolRegistry.get(toolName) ?? {
			name: toolName,
			icon: Wrench,
			iconClass: "text-muted-foreground",
		}
	);
}

/**
 * Get custom renderer for a tool, if registered.
 */
export function getToolRenderer(
	toolName: string,
): React.ComponentType<ToolRendererProps> | null {
	return toolRenderers.get(toolName) ?? null;
}

// ============================================================================
// Helper functions for extracting context
// ============================================================================

function getFilePath(input: unknown): string | null {
	if (!input || typeof input !== "object") return null;
	const obj = input as Record<string, unknown>;

	if (typeof obj.filePath === "string") {
		return obj.filePath.split("/").pop() || null;
	}
	if (typeof obj.path === "string") {
		return obj.path.split("/").pop() || obj.path;
	}
	return null;
}

function getFullFilePath(input: unknown): string | null {
	if (!input || typeof input !== "object") return null;
	const obj = input as Record<string, unknown>;

	let filePath: string | null = null;
	if (typeof obj.filePath === "string") {
		filePath = obj.filePath;
	} else if (typeof obj.path === "string") {
		filePath = obj.path;
	}

	if (!filePath) return null;

	// Normalize path from container absolute to relative
	// OpenCode returns paths like /app/src/layouts/Layout.astro
	// Files API expects paths relative to src/ like layouts/Layout.astro
	if (filePath.startsWith("/app/src/")) {
		return filePath.replace("/app/src/", "");
	}
	// Handle case where path is already relative
	if (filePath.startsWith("src/")) {
		return filePath.replace("src/", "");
	}

	return filePath;
}

function getCommand(input: unknown, maxLength = 60): string | null {
	if (!input || typeof input !== "object") return null;
	const obj = input as Record<string, unknown>;

	if (typeof obj.command === "string") {
		const cmd = obj.command;
		return cmd.length > maxLength ? `${cmd.substring(0, maxLength)}...` : cmd;
	}
	return null;
}

function getPattern(input: unknown): string | null {
	if (!input || typeof input !== "object") return null;
	const obj = input as Record<string, unknown>;

	if (typeof obj.pattern === "string") {
		return obj.pattern;
	}
	return null;
}

function getDescription(input: unknown): string | null {
	if (!input || typeof input !== "object") return null;
	const obj = input as Record<string, unknown>;

	if (typeof obj.description === "string") {
		const desc = obj.description;
		return desc.length > 50 ? `${desc.substring(0, 50)}...` : desc;
	}
	return null;
}

// ============================================================================
// Register built-in tools
// ============================================================================

// File operations
registerTool("read", {
	name: "Read",
	icon: FileText,
	getContext: getFilePath,
	openFileOnClick: true,
	getFilePath: getFullFilePath,
});

registerTool("write", {
	name: "Write",
	icon: FileCode,
	getContext: getFilePath,
	openFileOnClick: true,
	getFilePath: getFullFilePath,
});

registerTool("edit", {
	name: "Edit",
	icon: Pencil,
	getContext: getFilePath,
	openFileOnClick: true,
	getFilePath: getFullFilePath,
});

registerTool("delete", {
	name: "Delete",
	icon: Trash2,
	getContext: getFilePath,
	openFileOnClick: true,
	getFilePath: getFullFilePath,
});

registerTool("list", {
	name: "List",
	icon: ListTree,
	getContext: getFilePath,
	openFileOnClick: true,
	getFilePath: getFullFilePath,
});

// Search tools
registerTool("glob", {
	name: "Glob",
	icon: FolderSearch,
	getContext: getPattern,
});

registerTool("grep", {
	name: "Grep",
	icon: Search,
	getContext: getPattern,
});

// Execution
registerTool("bash", {
	name: "Bash",
	icon: Terminal,
	getContext: getCommand,
});

// Task/Agent tools
registerTool("task", {
	name: "Task",
	icon: Brain,
	getContext: getDescription,
});

registerTool("thinking", {
	name: "Thinking...",
	icon: Brain,
});

// Web
registerTool("webfetch", {
	name: "Web Fetch",
	icon: Globe,
	getContext: (input) => {
		if (!input || typeof input !== "object") return null;
		const obj = input as Record<string, unknown>;
		if (typeof obj.url === "string") {
			try {
				const url = new URL(obj.url);
				return url.hostname;
			} catch {
				return obj.url.substring(0, 40);
			}
		}
		return null;
	},
});

// MCP tools (generic pattern)
registerTool("mcp", {
	name: "MCP",
	icon: Wrench,
});

// TodoWrite
registerTool("todowrite", {
	name: "Todo",
	icon: ListTree,
});

// Sequential thinking
registerTool("sequential-thinking_sequentialthinking", {
	name: "Thinking",
	icon: Brain,
});

// Context7
registerTool("context7_resolve-library-id", {
	name: "Context7",
	icon: Search,
	getContext: (input) => {
		if (!input || typeof input !== "object") return null;
		const obj = input as Record<string, unknown>;
		return typeof obj.libraryName === "string" ? obj.libraryName : null;
	},
});

registerTool("context7_get-library-docs", {
	name: "Context7 Docs",
	icon: FileText,
	getContext: (input) => {
		if (!input || typeof input !== "object") return null;
		const obj = input as Record<string, unknown>;
		return typeof obj.topic === "string" ? obj.topic : null;
	},
});
