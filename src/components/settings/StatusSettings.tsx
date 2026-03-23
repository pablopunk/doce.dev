import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	Cpu,
	GitBranch,
	Layers3,
	Package,
} from "lucide-react";
import { QueueTableLive } from "@/components/queue/QueueTableLive";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { QueueJob } from "@/server/db/schema";
import type { SettingsStatusDiagnostics } from "@/server/settings/status";

interface StatusSettingsProps {
	initialJobs: QueueJob[];
	initialPaused: boolean;
	initialConcurrency: number;
	initialPagination: {
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
}

const checkIcons = [Cpu, Activity, Layers3, Package] as const;

export function StatusSettings({
	initialJobs,
	initialPaused,
	initialConcurrency,
	initialPagination,
	filters,
	diagnostics,
}: StatusSettingsProps) {
	const checklistItems = [
		{
			label: "App version",
			value: diagnostics.version,
			description: "Current deployed build running on this instance.",
			icon: GitBranch,
			status: "healthy" as const,
		},
		{
			label: "Queue",
			value: diagnostics.queue.paused ? "Paused" : "Running",
			description: `Concurrency ${diagnostics.queue.concurrency} - Queued ${diagnostics.queue.queuedJobs} - Running ${diagnostics.queue.runningJobs} - Failed ${diagnostics.queue.failedJobs}`,
			icon: Activity,
			status:
				diagnostics.queue.failedJobs > 0
					? ("warning" as const)
					: ("healthy" as const),
		},
		...diagnostics.checks.map((check, index) => ({
			...check,
			icon: checkIcons[index] ?? Activity,
		})),
	];

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="pb-4">
					<CardTitle>Instance health</CardTitle>
					<CardDescription>
						Quick status checklist for the app, queue, and runtime dependencies.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{checklistItems.map((item) => {
							const Icon = item.icon;
							const StatusIcon =
								item.status === "healthy" ? CheckCircle2 : AlertTriangle;

							return (
								<div
									key={item.label}
									className="flex items-start gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
								>
									<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="text-sm font-medium">{item.label}</p>
											<p className="text-sm text-foreground/90">{item.value}</p>
											<StatusIcon
												className={
													item.status === "healthy"
														? "size-4 text-status-success"
														: "size-4 text-status-warning"
												}
											/>
										</div>
										<p className="mt-1 text-sm text-muted-foreground">
											{item.description}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			<div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm">
				<QueueTableLive
					initialJobs={initialJobs}
					initialPaused={initialPaused}
					initialConcurrency={initialConcurrency}
					initialPagination={initialPagination}
					filters={filters}
				/>
			</div>
		</div>
	);
}
