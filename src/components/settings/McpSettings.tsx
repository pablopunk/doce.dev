import { Cable, Globe, Loader2, Plus, Terminal, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { type McpServerEntry, useMcps } from "@/hooks/useMcps";

function McpEmptyState() {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
			<Cable className="size-10 stroke-1" />
			<p className="text-sm">No MCP servers configured yet.</p>
			<p className="max-w-sm text-xs">
				MCP servers give your AI agent access to external tools and data sources
				like documentation search, web browsing, and code analysis.
			</p>
		</div>
	);
}

function McpServerRow({
	entry,
	onToggle,
	onRemove,
	isPending,
}: {
	entry: McpServerEntry;
	onToggle: (enabled: boolean) => void;
	onRemove: () => void;
	isPending: boolean;
}) {
	const { name, config } = entry;
	const isEnabled = config.enabled !== false;
	const descriptor =
		config.type === "remote"
			? (config.url ?? "—")
			: (config.command ?? []).join(" ");

	return (
		<div className="flex items-center justify-between gap-3 py-2.5">
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<p className="text-sm font-medium truncate">{name}</p>
					<Badge variant="outline" className="text-xs shrink-0">
						{config.type === "remote" ? (
							<Globe className="mr-1 size-3" />
						) : (
							<Terminal className="mr-1 size-3" />
						)}
						{config.type}
					</Badge>
				</div>
				<p className="text-xs text-muted-foreground truncate">{descriptor}</p>
			</div>
			<div className="flex items-center gap-1 shrink-0">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onToggle(!isEnabled)}
					disabled={isPending}
					className={isEnabled ? "text-green-600" : "text-muted-foreground"}
				>
					{isPending ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : isEnabled ? (
						"On"
					) : (
						"Off"
					)}
				</Button>
				<Button
					variant="ghost"
					size="icon"
					onClick={onRemove}
					disabled={isPending}
					className="text-destructive hover:text-destructive"
				>
					{isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Trash2 className="size-4" />
					)}
				</Button>
			</div>
		</div>
	);
}

function AddMcpForm({
	onAdd,
	onCancel,
}: {
	onAdd: (
		name: string,
		config: {
			type: "remote" | "local";
			url?: string;
			command?: string[];
			enabled: boolean;
		},
	) => void;
	onCancel: () => void;
}) {
	const [name, setName] = useState("");
	const [type, setType] = useState<"remote" | "local">("remote");
	const [url, setUrl] = useState("");
	const [command, setCommand] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		if (type === "remote") {
			if (!url.trim()) return;
			onAdd(name.trim(), { type: "remote", url: url.trim(), enabled: true });
		} else {
			if (!command.trim()) return;
			onAdd(name.trim(), {
				type: "local",
				command: command.trim().split(/\s+/),
				enabled: true,
			});
		}
	};

	const isValid =
		name.trim() && (type === "remote" ? url.trim() : command.trim());

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="mcp-name">Name</Label>
				<Input
					id="mcp-name"
					placeholder="e.g. context7"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
			</div>

			<div className="space-y-2">
				<Label>Type</Label>
				<div className="flex gap-2">
					<Button
						type="button"
						variant={type === "remote" ? "default" : "outline"}
						size="sm"
						onClick={() => setType("remote")}
					>
						<Globe className="mr-1.5 size-3.5" />
						Remote
					</Button>
					<Button
						type="button"
						variant={type === "local" ? "default" : "outline"}
						size="sm"
						onClick={() => setType("local")}
					>
						<Terminal className="mr-1.5 size-3.5" />
						Local
					</Button>
				</div>
			</div>

			{type === "remote" ? (
				<div className="space-y-2">
					<Label htmlFor="mcp-url">URL</Label>
					<Input
						id="mcp-url"
						placeholder="https://mcp.example.com/mcp"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
					/>
				</div>
			) : (
				<div className="space-y-2">
					<Label htmlFor="mcp-command">Command</Label>
					<Input
						id="mcp-command"
						placeholder="npx -y @modelcontextprotocol/server-everything"
						value={command}
						onChange={(e) => setCommand(e.target.value)}
					/>
					<p className="text-xs text-muted-foreground">
						Space-separated command and arguments.
					</p>
				</div>
			)}

			<div className="flex gap-2 justify-end">
				<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
					<X className="mr-1.5 size-3.5" />
					Cancel
				</Button>
				<Button type="submit" size="sm" disabled={!isValid}>
					<Plus className="mr-1.5 size-3.5" />
					Add Server
				</Button>
			</div>
		</form>
	);
}

export function McpSettings() {
	const {
		servers,
		isLoading,
		pendingAction,
		addServer,
		removeServer,
		toggleServer,
	} = useMcps();
	const [showAddForm, setShowAddForm] = useState(false);

	const handleAdd = (
		name: string,
		config: {
			type: "remote" | "local";
			url?: string;
			command?: string[];
			enabled: boolean;
		},
	) => {
		addServer(name, config);
		setShowAddForm(false);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>MCP Servers</CardTitle>
							<CardDescription>
								Model Context Protocol servers available to all projects via
								OpenCode.
							</CardDescription>
						</div>
						{!showAddForm && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowAddForm(true)}
							>
								<Plus className="mr-1.5 size-3.5" />
								Add
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{showAddForm && (
						<>
							<AddMcpForm
								onAdd={handleAdd}
								onCancel={() => setShowAddForm(false)}
							/>
							<Separator className="my-4" />
						</>
					)}

					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : servers.length === 0 ? (
						<McpEmptyState />
					) : (
						<div className="divide-y divide-border">
							{servers.map((entry) => (
								<McpServerRow
									key={entry.name}
									entry={entry}
									onToggle={(enabled) => toggleServer(entry.name, enabled)}
									onRemove={() => removeServer(entry.name)}
									isPending={pendingAction === entry.name}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
