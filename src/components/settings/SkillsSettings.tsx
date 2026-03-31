import { Download, Loader2, Search, Sparkles, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { useSkills } from "@/hooks/useSkills";

function SkillsEmptyState() {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
			<Sparkles className="size-10 stroke-1" />
			<p className="text-sm">No skills installed yet.</p>
			<p className="max-w-sm text-xs">
				Search below to discover and install skills from skills.sh. Skills teach
				your AI agent specialized knowledge like framework best practices and
				coding patterns.
			</p>
		</div>
	);
}

function InstalledSkillRow({
	name,
	path,
	onRemove,
	isRemoving,
}: {
	name: string;
	path: string;
	onRemove: () => void;
	isRemoving: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-3 py-2">
			<div className="min-w-0">
				<p className="text-sm font-medium truncate">{name}</p>
				<p className="text-xs text-muted-foreground truncate">{path}</p>
			</div>
			<Button
				variant="ghost"
				size="icon"
				onClick={onRemove}
				disabled={isRemoving}
				className="shrink-0 text-destructive hover:text-destructive"
			>
				{isRemoving ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Trash2 className="size-4" />
				)}
			</Button>
		</div>
	);
}

function SearchResultRow({
	name,
	source,
	installs,
	onInstall,
	isInstalling,
	isInstalled,
}: {
	name: string;
	source: string;
	installs: number;
	onInstall: () => void;
	isInstalling: boolean;
	isInstalled: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-3 py-2">
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<p className="text-sm font-medium truncate">{name}</p>
					<Badge variant="secondary" className="text-xs shrink-0">
						{installs.toLocaleString()} installs
					</Badge>
				</div>
				<p className="text-xs text-muted-foreground truncate">{source}</p>
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={onInstall}
				disabled={isInstalling || isInstalled}
				className="shrink-0"
			>
				{isInstalling ? (
					<Loader2 className="mr-1.5 size-3.5 animate-spin" />
				) : (
					<Download className="mr-1.5 size-3.5" />
				)}
				{isInstalled ? "Installed" : "Install"}
			</Button>
		</div>
	);
}

export function SkillsSettings() {
	const {
		installedSkills,
		searchResults,
		isLoading,
		isSearching,
		pendingAction,
		search,
		install,
		remove,
	} = useSkills();

	const [query, setQuery] = useState("");

	const installedNames = new Set(installedSkills.map((s) => s.name));

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		search(query);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Installed Skills</CardTitle>
					<CardDescription>
						Global skills available to all projects via OpenCode.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : installedSkills.length === 0 ? (
						<SkillsEmptyState />
					) : (
						<div className="divide-y divide-border">
							{installedSkills.map((skill) => (
								<InstalledSkillRow
									key={skill.name}
									name={skill.name}
									path={skill.path}
									onRemove={() => remove(skill.name)}
									isRemoving={pendingAction === skill.name}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Discover Skills</CardTitle>
					<CardDescription>
						Search the skills.sh registry to find and install new skills.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSearch} className="flex gap-2">
						<Input
							placeholder="Search skills (e.g. react, astro, tailwind)..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
						<Button
							type="submit"
							variant="outline"
							disabled={isSearching || !query.trim()}
						>
							{isSearching ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Search className="size-4" />
							)}
						</Button>
					</form>

					{searchResults.length > 0 && (
						<>
							<Separator className="my-4" />
							<div className="divide-y divide-border">
								{searchResults.slice(0, 20).map((skill) => (
									<SearchResultRow
										key={skill.id}
										name={skill.name}
										source={skill.source}
										installs={skill.installs}
										onInstall={() => install(skill.source, skill.skillId)}
										isInstalling={
											pendingAction === `${skill.source}/${skill.skillId}`
										}
										isInstalled={installedNames.has(skill.name)}
									/>
								))}
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
