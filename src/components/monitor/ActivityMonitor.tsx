import { actions } from "astro:actions";
import { Activity, BarChart3, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useMonitorStream } from "@/hooks/useMonitorStream";
import type { ContainerStats } from "@/types/monitor";

interface ProjectInfo {
	id: string;
	name: string;
	icon: string;
}

interface ActivityMonitorProps {
	projects: ProjectInfo[];
}

function useStopProject() {
	const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());

	const stopProject = async (projectId: string) => {
		setStoppingIds((prev) => new Set(prev).add(projectId));
		try {
			const result = await actions.projects.stop({ projectId });
			if (result.error) {
				toast.error(result.error.message ?? "Failed to stop project");
			} else {
				toast.success("Project stopped");
			}
		} catch {
			toast.error("Failed to stop project");
		} finally {
			setStoppingIds((prev) => {
				const next = new Set(prev);
				next.delete(projectId);
				return next;
			});
		}
	};

	const isStopping = (projectId: string) => stoppingIds.has(projectId);

	return { stopProject, isStopping };
}

function StopProjectButton({ projectId }: { projectId: string }) {
	const { stopProject, isStopping } = useStopProject();

	return (
		<Button
			variant="ghost"
			size="sm"
			className="h-7 px-2 text-xs text-muted-foreground hover:text-status-error shrink-0"
			onClick={() => void stopProject(projectId)}
			disabled={isStopping(projectId)}
		>
			{isStopping(projectId) ? (
				<span className="animate-pulse">Stopping…</span>
			) : (
				<>
					<Square className="size-3 mr-1" />
					Stop
				</>
			)}
		</Button>
	);
}

function ProgressBar({
	value,
	colorClass = "bg-primary",
}: {
	value: number;
	colorClass?: string;
}) {
	const clamped = Math.max(0, Math.min(100, value));
	return (
		<div className="h-2 w-full rounded-full bg-muted overflow-hidden">
			<div
				className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
				style={{ width: `${clamped}%` }}
			/>
		</div>
	);
}

function ServiceBadge({ service }: { service: ContainerStats["service"] }) {
	const variants: Record<ContainerStats["service"], string> = {
		preview: "bg-blue-500/10 text-blue-600 border-blue-500/20",
		opencode: "bg-purple-500/10 text-purple-600 border-purple-500/20",
		production: "bg-green-500/10 text-green-600 border-green-500/20",
		unknown: "bg-muted text-muted-foreground",
	};

	return (
		<Badge variant="outline" className={variants[service]}>
			{service}
		</Badge>
	);
}

function MetricBar({
	label,
	value,
	colorClass,
	suffix,
}: {
	label: string;
	value: number;
	colorClass: string;
	suffix?: string;
}) {
	return (
		<div className="space-y-1">
			<div className="flex items-baseline justify-between gap-2 text-xs">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-medium tabular-nums">
					{suffix && (
						<span className="text-muted-foreground font-normal mr-1">
							{suffix}
						</span>
					)}
					{value.toFixed(1)}%
				</span>
			</div>
			<ProgressBar value={value} colorClass={colorClass} />
		</div>
	);
}

function ContainerRow({ container }: { container: ContainerStats }) {
	const cpuColor =
		container.cpuPercent > 80
			? "bg-status-error"
			: container.cpuPercent > 50
				? "bg-status-warning"
				: "bg-primary";
	const memColor =
		container.memPercent > 80
			? "bg-status-error"
			: container.memPercent > 50
				? "bg-status-warning"
				: "bg-primary";

	return (
		<div className="space-y-3 py-3 border-b border-border/40 last:border-b-0">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<ServiceBadge service={container.service} />
					<span className="text-sm font-medium truncate">{container.name}</span>
				</div>
				<span className="text-xs text-muted-foreground whitespace-nowrap">
					{container.pids} PIDs
				</span>
			</div>
			<div className="grid grid-cols-[1fr_2fr] gap-4">
				<MetricBar label="CPU" value={container.cpuPercent} colorClass={cpuColor} />
				<MetricBar
					label="Mem"
					value={container.memPercent}
					colorClass={memColor}
					suffix={container.memUsage}
				/>
			</div>
		</div>
	);
}

export function ActivityMonitor({ projects }: ActivityMonitorProps) {
	const { snapshot, connected, reconnecting } = useMonitorStream();

	const projectMap = useMemo(() => {
		const map = new Map<string, ProjectInfo>();
		for (const p of projects) {
			map.set(p.id, p);
		}
		return map;
	}, [projects]);

	const { grouped, unknown } = useMemo(() => {
		const grouped = new Map<string, ContainerStats[]>();
		const unknown: ContainerStats[] = [];

		if (!snapshot) return { grouped, unknown };

		for (const container of snapshot.containers) {
			if (container.projectId && container.service !== "unknown") {
				const list = grouped.get(container.projectId) ?? [];
				list.push(container);
				grouped.set(container.projectId, list);
			} else {
				unknown.push(container);
			}
		}

		// Sort containers within each group by service order
		const serviceOrder = { preview: 0, opencode: 1, production: 2, unknown: 3 };
		for (const [, list] of grouped) {
			list.sort((a, b) => serviceOrder[a.service] - serviceOrder[b.service]);
		}

		return { grouped, unknown };
	}, [snapshot]);

	const totalContainers = snapshot?.containers.length ?? 0;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="pb-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<BarChart3 className="size-5 text-primary" />
							<CardTitle>Container activity</CardTitle>
						</div>
						<div className="flex items-center gap-2">
							{reconnecting && (
								<Badge variant="outline" className="text-status-warning">
									Reconnecting…
								</Badge>
							)}
							{connected ? (
								<Badge variant="outline" className="text-status-success">
									<Activity className="size-3 mr-1" />
									Live
								</Badge>
							) : (
								<Badge variant="outline" className="text-status-error">
									Disconnected
								</Badge>
							)}
						</div>
					</div>
					<CardDescription>
						Real-time CPU and memory usage for all project containers.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-2 text-sm">
						<span className="text-muted-foreground">Running containers</span>
						<span className="font-medium">{totalContainers}</span>
					</div>
				</CardContent>
			</Card>

			{!snapshot && (
				<div className="rounded-2xl border border-border/60 bg-card/80 p-8 text-center backdrop-blur-sm">
					<p className="text-sm text-muted-foreground">
						Waiting for container data…
					</p>
				</div>
			)}

			<div className="grid gap-4 md:grid-cols-2">
				{Array.from(grouped.entries()).map(([projectId, containers]) => {
					const project = projectMap.get(projectId);
					return (
						<Card key={projectId}>
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2">
									{project ? (
										<div className="flex items-center justify-between flex-1 min-w-0 gap-2">
											<div className="flex items-center gap-2 min-w-0">
												<span className="inline-flex size-7 items-center justify-center rounded-lg bg-muted text-sm">
													{project.icon}
												</span>
												<CardTitle className="text-base truncate">
													{project.name}
												</CardTitle>
											</div>
											<StopProjectButton projectId={project.id} />
										</div>
									) : (
										<CardTitle className="text-base">{projectId}</CardTitle>
									)}
								</div>
								<CardDescription>
									{containers.length} container
									{containers.length === 1 ? "" : "s"}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{containers.map((c) => (
									<ContainerRow key={c.name} container={c} />
								))}
							</CardContent>
						</Card>
					);
				})}
			</div>

			{unknown.length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Other</CardTitle>
						<CardDescription>Unmatched containers</CardDescription>
					</CardHeader>
					<CardContent>
						{unknown.map((c) => (
							<ContainerRow key={c.name} container={c} />
						))}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
