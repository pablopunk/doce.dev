import { Activity, BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { ActivityMonitor } from "@/components/monitor/ActivityMonitor";
import { QueueMonitor } from "@/components/monitor/QueueMonitor";
import { cn } from "@/lib/utils";
import type { QueueJob } from "@/server/db/schema";
import type { SettingsStatusDiagnostics } from "@/server/settings/status";

export type MonitorTabId = "activity" | "queue";

interface MonitorWorkspaceProps {
	initialTab?: MonitorTabId;
	queueData: {
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
		selectedJob: QueueJob | undefined;
	};
	projects: Array<{ id: string; name: string; icon: string }>;
}

const tabs = [
	{
		id: "activity" as const,
		label: "Activity",
		description: "Container CPU and memory",
		icon: BarChart3,
	},
	{
		id: "queue" as const,
		label: "Queue",
		description: "Instance health and queue",
		icon: Activity,
	},
] as const;

export function MonitorWorkspace({
	initialTab = "activity",
	queueData,
	projects,
}: MonitorWorkspaceProps) {
	const [activeTab, setActiveTab] = useState<MonitorTabId>(initialTab);

	const selectTab = (tabId: MonitorTabId) => {
		setActiveTab(tabId);
		const url = new URL(window.location.href);
		url.searchParams.set("tab", tabId);
		window.history.replaceState({}, "", url);
	};

	const activeContent = useMemo(() => {
		switch (activeTab) {
			case "activity":
				return <ActivityMonitor projects={projects} />;
			case "queue":
				return (
					<QueueMonitor
						initialJobs={queueData.jobs}
						initialPaused={queueData.paused}
						initialConcurrency={queueData.concurrency}
						initialPagination={queueData.pagination}
						filters={queueData.filters}
						diagnostics={queueData.diagnostics}
						selectedJob={queueData.selectedJob}
					/>
				);
		}
	}, [activeTab, projects, queueData]);

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
