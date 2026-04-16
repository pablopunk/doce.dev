import {
	Cable,
	Globe,
	KeyRound,
	Loader2,
	Pencil,
	Plus,
	Terminal,
	Trash2,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
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

const EXA_MCP_BASE_URL = "https://mcp.exa.ai/mcp";

function getRemoteDescriptor(name: string, url?: string): string {
	if (!url) {
		return "—";
	}

	if (name !== "exa") {
		return url;
	}

	try {
		const parsed = new URL(url);
		const hasApiKey = parsed.searchParams.has("exaApiKey");
		return hasApiKey
			? `${parsed.origin}${parsed.pathname} (API key configured)`
			: `${parsed.origin}${parsed.pathname} (free tier)`;
	} catch {
		return "Exa MCP";
	}
}

function getExaApiKey(url?: string): string {
	if (!url) {
		return "";
	}

	try {
		const parsed = new URL(url);
		return parsed.searchParams.get("exaApiKey") ?? "";
	} catch {
		return "";
	}
}

function buildExaUrl(apiKey: string): string {
	const trimmedApiKey = apiKey.trim();
	if (!trimmedApiKey) {
		return EXA_MCP_BASE_URL;
	}

	const parsed = new URL(EXA_MCP_BASE_URL);
	parsed.searchParams.set("exaApiKey", trimmedApiKey);
	return parsed.toString();
}

function ExaApiKeyForm({
	currentUrl,
	onSave,
	onCancel,
	isSaving,
}: {
	currentUrl?: string | undefined;
	onSave: (url: string) => void;
	onCancel: () => void;
	isSaving: boolean;
}) {
	const [apiKey, setApiKey] = useState(() => getExaApiKey(currentUrl));
	const hasExistingApiKey = useMemo(
		() => Boolean(getExaApiKey(currentUrl)),
		[currentUrl],
	);

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		onSave(buildExaUrl(apiKey));
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3"
		>
			<div className="space-y-2">
				<Label htmlFor="exa-api-key">Optional Exa API key</Label>
				<Input
					id="exa-api-key"
					type="password"
					placeholder="Paste your Exa API key"
					value={apiKey}
					onChange={(event) => setApiKey(event.target.value)}
				/>
				<p className="text-xs text-muted-foreground">
					Without a key, Exa works on the free tier and may be rate limited.
					Save a key to write it into OpenCode&apos;s <code>opencode.json</code>{" "}
					for this MCP.
				</p>
			</div>
			<div className="mt-3 flex flex-wrap justify-end gap-2">
				{hasExistingApiKey && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onSave(buildExaUrl(""))}
						disabled={isSaving}
					>
						Clear key
					</Button>
				)}
				<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" size="sm" disabled={isSaving}>
					{isSaving ? (
						<Loader2 className="mr-1.5 size-3.5 animate-spin" />
					) : (
						<KeyRound className="mr-1.5 size-3.5" />
					)}
					Save API key
				</Button>
			</div>
		</form>
	);
}

function McpServerRow({
	entry,
	onToggle,
	onRemove,
	onUpdate,
	isPending,
}: {
	entry: McpServerEntry;
	onToggle: (enabled: boolean) => void;
	onRemove: () => void;
	onUpdate: (config: McpServerEntry["config"]) => void;
	isPending: boolean;
}) {
	const { name, config } = entry;
	const isEnabled = config.enabled !== false;
	const [isEditingExa, setIsEditingExa] = useState(false);
	const descriptor =
		config.type === "remote"
			? getRemoteDescriptor(name, config.url)
			: (config.command ?? []).join(" ");

	return (
		<div className="py-2.5">
			<div className="flex items-center justify-between gap-3">
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
					{name === "exa" && config.type === "remote" && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setIsEditingExa((value) => !value)}
							disabled={isPending}
						>
							<Pencil className="mr-1.5 size-3.5" />
							Edit
						</Button>
					)}
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
			{name === "exa" && config.type === "remote" && isEditingExa && (
				<ExaApiKeyForm
					currentUrl={config.url}
					onSave={(url) => {
						onUpdate({ ...config, url });
						setIsEditingExa(false);
					}}
					onCancel={() => setIsEditingExa(false)}
					isSaving={isPending}
				/>
			)}
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
		updateServer,
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
									onUpdate={(config) => updateServer(entry.name, config)}
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
