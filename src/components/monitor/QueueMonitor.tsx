import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	Cpu,
	GitBranch,
	Heart,
	Layers3,
	Package,
	RefreshCw,
} from "lucide-react";
import { JobDetailLive } from "@/components/queue/JobDetailLive";
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

interface QueueMonitorProps {
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
	selectedJob: QueueJob | undefined;
}

const checkIcons = [Cpu, Activity, Layers3, Package] as const;

export function QueueMonitor({
	initialJobs,
	initialPaused,
	initialConcurrency,
	initialPagination,
	filters,
	diagnostics,
	selectedJob,
}: QueueMonitorProps) {
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
				diagnostics.queue.lastJobState === "failed"
					? ("warning" as const)
					: ("healthy" as const),
		},
		...diagnostics.checks.map((check, index) => ({
			...check,
			icon: checkIcons[index] ?? Activity,
		})),
	];

	if (selectedJob) {
		return (
			<JobDetailLive initialJob={selectedJob} backHref="/monitor?tab=queue" />
		);
	}

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

			{diagnostics.selfHealing?.lastSnapshot && (
				<Card>
					<CardHeader className="pb-4">
						<div className="flex items-center gap-2">
							<Heart className="size-5 text-status-success" />
							<CardTitle>Self-healing</CardTitle>
						</div>
						<CardDescription>
							Automatic recovery from state desyncs across projects, queue jobs,
							and infrastructure.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="flex items-start gap-3">
								<RefreshCw className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium">Last check</p>
										<p className="text-sm text-foreground/90">
											{diagnostics.selfHealing.lastSnapshot.takenAt
												? new Date(
														diagnostics.selfHealing.lastSnapshot.takenAt,
													).toLocaleString()
												: "Never"}
										</p>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										Reconciliation scans run automatically every 30 seconds.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium">Projects</p>
										<p className="text-sm text-foreground/90">
											{diagnostics.selfHealing.lastSnapshot.projectsRunning ??
												0}{" "}
											running /{" "}
											{diagnostics.selfHealing.lastSnapshot.projectsTotal ?? 0}{" "}
											total
										</p>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium">Queue</p>
										<p className="text-sm text-foreground/90">
											{diagnostics.selfHealing.lastSnapshot.queueJobsRunning ??
												0}{" "}
											running /{" "}
											{diagnostics.selfHealing.lastSnapshot.queueJobsQueued ??
												0}{" "}
											queued
										</p>
									</div>
								</div>
							</div>

							{(() => {
								const v = diagnostics.selfHealing.lastSnapshot.violationsFound;
								return v != null && v > 0;
							})() && (
								<div className="rounded-md bg-status-warning/10 p-3">
									<p className="text-sm font-medium text-status-warning">
										{diagnostics.selfHealing.lastSnapshot.violationsFound}{" "}
										violation
										{diagnostics.selfHealing.lastSnapshot.violationsFound === 1
											? ""
											: "s"}{" "}
										found,{" "}
										{diagnostics.selfHealing.lastSnapshot.violationsHealed}{" "}
										healed
									</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			<div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm">
				<QueueTableLive
					initialJobs={initialJobs}
					jobDetailHref={(jobId) => `/monitor?tab=queue&jobId=${jobId}`}
					initialPaused={initialPaused}
					initialConcurrency={initialConcurrency}
					initialPagination={initialPagination}
					filters={filters}
				/>
			</div>
		</div>
	);
}
