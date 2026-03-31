import {
	Activity,
	Cable,
	Settings,
	Sparkles,
	WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { McpSettings } from "@/components/settings/McpSettings";
import { ProvidersSettings } from "@/components/settings/ProvidersSettings";
import { SkillsSettings } from "@/components/settings/SkillsSettings";
import { StatusSettings } from "@/components/settings/StatusSettings";
import { cn } from "@/lib/utils";
import type { QueueJob } from "@/server/db/schema";
import type { SettingsStatusDiagnostics } from "@/server/settings/status";

export type SettingsTabId =
	| "general"
	| "providers"
	| "mcps"
	| "skills"
	| "status";

interface SettingsWorkspaceProps {
	initialTab?: SettingsTabId;
	statusData: {
		jobs: QueueJob[];
		paused: boolean;
		concurrency: number;
		pagination: {
			page: number;
			pageSize: number;
			totalCount: number;
			totalPages: number;
		};
		filters: {
			state?: string;
			type?: string;
			projectId?: string;
			q?: string;
		};
		diagnostics: SettingsStatusDiagnostics;
	};
}

const tabs = [
	{
		id: "general",
		label: "General",
		description: "Base URL and account",
		icon: Settings,
	},
	{
		id: "providers",
		label: "Providers",
		description: "Models, API keys, and subscriptions",
		icon: WandSparkles,
	},
	{
		id: "mcps",
		label: "MCPs",
		description: "Model Context Protocol servers",
		icon: Cable,
	},
	{
		id: "skills",
		label: "Skills",
		description: "Agent skills from skills.sh",
		icon: Sparkles,
	},
	{
		id: "status",
		label: "Status",
		description: "Instance health and queue",
		icon: Activity,
	},
] as const satisfies Array<{
	id: SettingsTabId;
	label: string;
	description: string;
	icon: typeof WandSparkles;
}>;

export function SettingsWorkspace({
	initialTab = "providers",
	statusData,
}: SettingsWorkspaceProps) {
	const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

	const selectTab = (tabId: SettingsTabId) => {
		setActiveTab(tabId);
		const url = new URL(window.location.href);
		url.searchParams.set("tab", tabId);
		window.history.replaceState({}, "", url);
	};

	const activeContent = useMemo(() => {
		switch (activeTab) {
			case "general":
				return <GeneralSettings />;
			case "providers":
				return <ProvidersSettings />;
			case "mcps":
				return <McpSettings />;
			case "skills":
				return <SkillsSettings />;
			case "status":
				return (
					<StatusSettings
						initialJobs={statusData.jobs}
						initialPaused={statusData.paused}
						initialConcurrency={statusData.concurrency}
						initialPagination={statusData.pagination}
						filters={statusData.filters}
						diagnostics={statusData.diagnostics}
					/>
				);
		}
	}, [activeTab, statusData]);

	return (
		<div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
			<aside className="lg:sticky lg:top-6">
				<div className="rounded-2xl border border-border/60 bg-card/80 p-2 backdrop-blur-sm">
					<nav className="grid gap-1">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							const isActive = activeTab === tab.id;

							return (
								<button
									key={tab.id}
									type="button"
									onClick={() => selectTab(tab.id)}
									className={cn(
										"flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
										isActive
											? "bg-foreground text-background shadow-sm"
											: "text-foreground hover:bg-muted",
									)}
								>
									<Icon className="mt-0.5 size-4 shrink-0" />
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											{tab.label}
										</span>
										<span
											className={cn(
												"mt-0.5 block text-xs",
												isActive
													? "text-background/80"
													: "text-muted-foreground",
											)}
										>
											{tab.description}
										</span>
									</span>
								</button>
							);
						})}
					</nav>
				</div>
			</aside>

			<div className="min-w-0">{activeContent}</div>
		</div>
	);
}
