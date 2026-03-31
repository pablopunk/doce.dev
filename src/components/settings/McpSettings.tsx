import { Cable } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function McpSettings() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>MCP Servers</CardTitle>
				<CardDescription>
					Manage default Model Context Protocol servers available to all
					projects.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
					<Cable className="size-10 stroke-1" />
					<p className="text-sm">No MCP servers configured yet.</p>
					<p className="max-w-sm text-xs">
						MCP servers give your AI agent access to external tools and data
						sources like documentation search, web browsing, and code analysis.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
