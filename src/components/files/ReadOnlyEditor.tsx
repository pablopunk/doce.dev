import Editor from "@monaco-editor/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ReadOnlyEditorProps {
	filePath: string;
	content: string;
	isLoading?: boolean;
}

/**
 * Get Monaco language ID from file extension
 */
function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

	const languageMap: Record<string, string> = {
		ts: "typescript",
		tsx: "typescript",
		js: "javascript",
		jsx: "javascript",
		json: "json",
		md: "markdown",
		css: "css",
		scss: "scss",
		html: "html",
		xml: "xml",
		yaml: "yaml",
		yml: "yaml",
		py: "python",
		java: "java",
		c: "c",
		cpp: "cpp",
		cs: "csharp",
		go: "go",
		rs: "rust",
		php: "php",
		rb: "ruby",
		sh: "shell",
		bash: "shell",
		sql: "sql",
		toml: "toml",
		astro: "typescript", // Astro uses TypeScript syntax
		vue: "vue",
		svelte: "svelte",
	};

	return languageMap[ext] ?? "plaintext";
}

export function ReadOnlyEditor({
	filePath,
	content,
	isLoading = false,
}: ReadOnlyEditorProps) {
	const [isMounted, setIsMounted] = useState(false);
	const [isDark, setIsDark] = useState(true);

	// Ensure Monaco only renders on client
	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Detect theme changes
	useEffect(() => {
		const updateTheme = () => {
			if (typeof document !== "undefined") {
				const isDarkMode = document.documentElement.classList.contains("dark");
				setIsDark(isDarkMode);
			}
		};

		updateTheme();

		// Watch for theme changes
		const observer = new MutationObserver(updateTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	const language = getLanguageFromPath(filePath);
	const monacoTheme = isDark ? "vs-dark" : "vs";

	if (!isMounted) {
		return (
			<div className="flex flex-col h-full bg-background">
				<div className="flex items-center gap-2 px-4 py-2 border-b text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading editor...
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-background overflow-hidden">
			{/* File header */}
			<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
				<div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
					<span className="truncate max-w-xs">{filePath}</span>
				</div>
				{isLoading && (
					<Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
				)}
			</div>

			{/* Monaco Editor */}
			<div className="flex-1 overflow-hidden">
				<Editor
					height="100%"
					language={language}
					value={content}
					theme={monacoTheme}
					options={{
						readOnly: true,
						minimap: { enabled: false },
						fontSize: 13,
						fontFamily: "Monaco, Courier, monospace",
						scrollBeyondLastLine: false,
						wordWrap: "on",
						automaticLayout: true,
					}}
					loading={
						<div className="flex items-center justify-center h-full">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					}
				/>
			</div>
		</div>
	);
}
