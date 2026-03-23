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
	return (
		<div className="space-y-6">
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<Card>
					<CardHeader className="pb-3">
						<CardDescription>App version</CardDescription>
						<CardTitle className="flex items-center gap-2 text-base">
							<GitBranch className="size-4" />
							{diagnostics.version}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						Current deployed build running on this instance.
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Queue</CardDescription>
						<CardTitle className="text-base">
							{diagnostics.queue.paused ? "Paused" : "Running"}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-1 text-sm text-muted-foreground">
						<p>Concurrency: {diagnostics.queue.concurrency}</p>
						<p>Queued jobs: {diagnostics.queue.queuedJobs}</p>
						<p>Running jobs: {diagnostics.queue.runningJobs}</p>
						<p>Failed jobs: {diagnostics.queue.failedJobs}</p>
					</CardContent>
				</Card>

				{diagnostics.checks.map((check, index) => {
					const Icon = checkIcons[index] ?? Activity;
					const StatusIcon =
						check.status === "healthy" ? CheckCircle2 : AlertTriangle;

					return (
						<Card key={check.label}>
							<CardHeader className="pb-3">
								<CardDescription>{check.label}</CardDescription>
								<CardTitle className="flex items-center gap-2 text-base">
									<Icon className="size-4" />
									<span>{check.value}</span>
									<StatusIcon
										className={
											check.status === "healthy"
												? "size-4 text-status-success"
												: "size-4 text-status-warning"
										}
									/>
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								{check.description}
							</CardContent>
						</Card>
					);
				})}
			</div>

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
