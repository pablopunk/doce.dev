import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Loader,
	Play,
	RotateCcw,
	StopCircle,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { QueueJob } from "@/server/db/schema";
import { ConfirmQueueActionDialog } from "./ConfirmQueueActionDialog";
import { Pagination } from "./Pagination";
import { QueuePlayerControl } from "./QueuePlayerControl";

interface PaginationData {
	page: number;
	pageSize: number;
	totalCount: number;
	totalPages: number;
}

interface QueueStreamData {
	type: "init" | "update";
	jobs: QueueJob[];
	paused: boolean;
	concurrency: number;
	pagination: PaginationData;
	timestamp: string;
}

interface QueueTableLiveProps {
	initialJobs: QueueJob[];
	initialPage?: number;
	initialPagination?: PaginationData;
	initialPaused: boolean;
	initialConcurrency?: number;
	filters?: {
		state?: string | undefined;
		type?: string | undefined;
		projectId?: string | undefined;
		q?: string | undefined;
	};
}

export function QueueTableLive({
	initialJobs,
	initialPage = 1,
	initialPagination,
	initialPaused,
	initialConcurrency = 2,
	filters = {},
}: QueueTableLiveProps) {
	const [jobs, setJobs] = useState<QueueJob[]>(initialJobs);
	const [paused, setPaused] = useState(initialPaused);
	const [concurrency, setConcurrency] = useState(initialConcurrency);
	const [pagination, setPagination] = useState<PaginationData>(
		initialPagination || {
			page: initialPage,
			pageSize: 25,
			totalCount: initialJobs.length,
			totalPages: 1,
		},
	);
	const [hasNewJobs, setHasNewJobs] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [pendingAction, setPendingAction] = useState<{
		jobId?: string;
		action: "cancel" | "forceUnlock" | "delete" | "deleteByState";
		state?: "succeeded" | "failed" | "cancelled";
		jobCount?: number;
	} | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		// Clear new jobs indicator when changing pages
		setHasNewJobs(false);

		const params = new URLSearchParams();
		params.set("page", String(pagination.page));
		if (filters.state) params.set("state", filters.state);
		if (filters.type) params.set("type", filters.type);
		if (filters.projectId) params.set("projectId", filters.projectId);
		if (filters.q) params.set("q", filters.q);

		const eventSource = new EventSource(
			`/api/queue/jobs-stream?${params.toString()}`,
		);

		eventSource.addEventListener("message", (event) => {
			try {
				const data = JSON.parse(event.data) as QueueStreamData;
				setJobs(data.jobs);
				setPaused(data.paused);
				setConcurrency(data.concurrency);

				// Show new jobs indicator: only if on page 1 AND total count increased
				if (
					pagination.page === 1 &&
					data.pagination.totalCount > pagination.totalCount
				) {
					setHasNewJobs(true);
				}

				setPagination(data.pagination);
			} catch (err) {
				console.error("Failed to parse queue update:", err);
			}
		});

		eventSource.addEventListener("error", (err) => {
			console.error("Queue stream error:", err);
			eventSource.close();
		});

		return () => {
			eventSource.close();
		};
	}, [pagination.page, filters]);

	const getStateIcon = (state: QueueJob["state"]) => {
		const iconProps = { className: "w-3 h-3" };
		switch (state) {
			case "succeeded":
				return <CheckCircle2 {...iconProps} />;
			case "failed":
				return <X {...iconProps} />;
			case "running":
				return <Loader {...iconProps} className="w-3 h-3 animate-spin" />;
			case "cancelled":
				return <AlertCircle {...iconProps} />;
			case "queued":
			default:
				return <Clock {...iconProps} />;
		}
	};

	const handleToggleQueue = async () => {
		try {
			const action = paused
				? "/_actions/queue.resume"
				: "/_actions/queue.pause";
			const res = await fetch(action, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			if (!res.ok) {
				throw new Error("Failed to toggle queue");
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to toggle queue");
		}
	};

	const handleStopAll = async () => {
		if (!confirm("Are you sure you want to stop all projects?")) {
			return;
		}

		setIsLoading(true);
		try {
			const res = await fetch("/_actions/queue.stopAll", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			if (!res.ok) {
				throw new Error("Failed to stop all projects");
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to stop all projects");
		} finally {
			setIsLoading(false);
		}
	};

	const handleActionClick = (
		action: "cancel" | "forceUnlock" | "delete",
		jobId: string,
	) => {
		setPendingAction({ jobId, action });
		setDialogOpen(true);
	};

	const handleBulkDelete = (state: "succeeded" | "failed" | "cancelled") => {
		const jobCount = jobs.filter((j) => j.state === state).length;
		setPendingAction({ action: "deleteByState", state, jobCount });
		setDialogOpen(true);
	};

	const handleConfirmAction = async () => {
		if (!pendingAction) return;

		setIsLoading(true);
		try {
			let path = "";
			let body: Record<string, string> = {};

			switch (pendingAction.action) {
				case "cancel":
					path = "/_actions/queue.cancel";
					body = { jobId: pendingAction.jobId! };
					break;
				case "forceUnlock":
					path = "/_actions/queue.forceUnlock";
					body = { jobId: pendingAction.jobId! };
					break;
				case "delete":
					path = "/_actions/queue.deleteJob";
					body = { jobId: pendingAction.jobId! };
					break;
				case "deleteByState":
					path = "/_actions/queue.deleteByState";
					body = { state: pendingAction.state! };
					break;
				default:
					throw new Error("Invalid action");
			}

			const res = await fetch(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				throw new Error("Failed to perform action");
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to perform action");
		} finally {
			setIsLoading(false);
			setPendingAction(null);
		}
	};

	const handleAction = async (action: string, jobId: string) => {
		if (action === "runNow") {
			try {
				const res = await fetch("/_actions/queue.runNow", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jobId }),
				});

				if (!res.ok) {
					throw new Error("Failed to run job");
				}
			} catch (err) {
				alert(err instanceof Error ? err.message : "Failed to run job");
			}
		} else if (action === "retry") {
			try {
				const res = await fetch("/_actions/queue.retry", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jobId }),
				});

				if (!res.ok) {
					throw new Error("Failed to retry job");
				}
			} catch (err) {
				alert(err instanceof Error ? err.message : "Failed to retry job");
			}
		} else if (
			action === "cancel" ||
			action === "forceUnlock" ||
			action === "delete"
		) {
			handleActionClick(action, jobId);
		}
	};

	const handlePageChange = (newPage: number) => {
		const params = new URLSearchParams();
		params.set("page", newPage.toString());
		if (filters.state) params.set("state", filters.state);
		if (filters.type) params.set("type", filters.type);
		if (filters.projectId) params.set("projectId", filters.projectId);
		if (filters.q) params.set("q", filters.q);

		// Optimistically update pagination state for immediate feedback
		setPagination((prev) => ({ ...prev, page: newPage }));

		window.history.pushState({}, "", `?${params.toString()}`);
	};

	const stats = {
		queued: jobs.filter((j) => j.state === "queued").length,
		running: jobs.filter((j) => j.state === "running").length,
	};

	return (
		<>
			<div className="px-8 py-6 max-w-7xl mx-auto">
				<h1 className="text-2xl font-semibold mb-6">Queue</h1>

				<div className="mb-6">
					<QueuePlayerControl
						paused={paused}
						concurrency={concurrency}
						stats={stats}
						onToggleQueue={handleToggleQueue}
					/>
				</div>

				<div className="mb-6 flex gap-2 items-center flex-wrap">
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									onClick={handleStopAll}
									variant="destructive"
									size="sm"
									disabled={isLoading}
								>
									<StopCircle className="w-4 h-4 mr-2" />
									Stop All Projects
								</Button>
							}
						/>
						<TooltipContent>Stop all running projects</TooltipContent>
					</Tooltip>

					{stats.queued === 0 && (
						<>
							{jobs.some((j) => j.state === "succeeded") && (
								<Button
									onClick={() => handleBulkDelete("succeeded")}
									variant="ghost"
									size="sm"
								>
									<Trash2 className="w-3 h-3" />
									Delete {jobs.filter((j) => j.state === "succeeded").length}{" "}
									Succeeded
								</Button>
							)}
							{jobs.some((j) => j.state === "failed") && (
								<Button
									onClick={() => handleBulkDelete("failed")}
									variant="ghost"
									size="sm"
								>
									<Trash2 className="w-3 h-3" />
									Delete {jobs.filter((j) => j.state === "failed").length}{" "}
									Failed
								</Button>
							)}
							{jobs.some((j) => j.state === "cancelled") && (
								<Button
									onClick={() => handleBulkDelete("cancelled")}
									variant="ghost"
									size="sm"
								>
									<Trash2 className="w-3 h-3" />
									Delete {jobs.filter((j) => j.state === "cancelled").length}{" "}
									Cancelled
								</Button>
							)}
						</>
					)}
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b">
								<th className="text-center py-2 px-2 w-8">State</th>
								<th className="text-left py-2 px-2">ID</th>
								<th className="text-left py-2 px-2">Type</th>
								<th className="text-left py-2 px-2">Project</th>
								<th className="text-left py-2 px-2">Created</th>
								<th className="text-left py-2 px-2">Actions</th>
							</tr>
						</thead>
						<tbody>
							{jobs.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className="py-8 px-2 text-center text-muted-foreground"
									>
										No jobs found
									</td>
								</tr>
							) : (
								jobs.map((job) => (
									<tr key={job.id} className="border-b hover:bg-muted/50">
										<td className="py-2 px-2 text-center">
											<Tooltip>
												<TooltipTrigger className="text-muted-foreground hover:text-foreground transition-colors cursor-help inline-flex items-center justify-center">
													{getStateIcon(job.state)}
												</TooltipTrigger>
												<TooltipContent>{job.state}</TooltipContent>
											</Tooltip>
										</td>
										<td className="py-2 px-2 font-mono text-xs">
											<a
												href={`/queue/${job.id}`}
												className="hover:underline text-blue-500"
											>
												{job.id.slice(0, 8)}
											</a>
										</td>
										<td className="py-2 px-2">{job.type}</td>
										<td className="py-2 px-2 text-xs text-muted-foreground">
											{job.projectId || "—"}
										</td>
										<td className="py-2 px-2 text-xs text-muted-foreground">
											{new Date(job.createdAt).toLocaleString("en-US", {
												year: "numeric",
												month: "2-digit",
												day: "2-digit",
												hour: "2-digit",
												minute: "2-digit",
												second: "2-digit",
												hour12: false,
											})}
										</td>
										<td className="py-2 px-2 space-x-2 flex">
											{job.state === "queued" && (
												<Tooltip>
													<TooltipTrigger
														render={
															<Button
																onClick={() => handleAction("runNow", job.id)}
																variant="secondary"
																size="xs"
															>
																<Play className="w-3 h-3" />
															</Button>
														}
													/>
													<TooltipContent>Run now</TooltipContent>
												</Tooltip>
											)}
											{(job.state === "queued" || job.state === "running") && (
												<Tooltip>
													<TooltipTrigger
														render={
															<Button
																onClick={() => handleAction("cancel", job.id)}
																variant="destructive"
																size="xs"
															>
																<X className="w-3 h-3" />
															</Button>
														}
													/>
													<TooltipContent>Cancel job</TooltipContent>
												</Tooltip>
											)}
											{job.state === "failed" && (
												<Tooltip>
													<TooltipTrigger
														render={
															<Button
																onClick={() => handleAction("retry", job.id)}
																variant="secondary"
																size="xs"
															>
																<RotateCcw className="w-3 h-3" />
															</Button>
														}
													/>
													<TooltipContent>Retry job</TooltipContent>
												</Tooltip>
											)}
											{job.state === "running" && (
												<Tooltip>
													<TooltipTrigger
														render={
															<Button
																onClick={() =>
																	handleAction("forceUnlock", job.id)
																}
																variant="secondary"
																size="xs"
															>
																<AlertCircle className="w-3 h-3" />
															</Button>
														}
													/>
													<TooltipContent>Force unlock</TooltipContent>
												</Tooltip>
											)}
											{(job.state === "succeeded" ||
												job.state === "failed" ||
												job.state === "cancelled") && (
												<Tooltip>
													<TooltipTrigger
														render={
															<Button
																onClick={() => handleAction("delete", job.id)}
																variant="ghost"
																size="xs"
															>
																<Trash2 className="w-3 h-3" />
															</Button>
														}
													/>
													<TooltipContent>Delete job</TooltipContent>
												</Tooltip>
											)}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{pagination.totalPages > 1 && (
					<div className="mt-6">
						<Pagination
							currentPage={pagination.page}
							totalPages={pagination.totalPages}
							onPageChange={handlePageChange}
						/>
					</div>
				)}

				{hasNewJobs && pagination.page === 1 && (
					<div className="mt-4 p-3 bg-card text-card-foreground rounded-lg text-sm ring-1 ring-foreground/10">
						New jobs available. Refresh to see latest.
					</div>
				)}
			</div>

			{pendingAction && (
				<ConfirmQueueActionDialog
					isOpen={dialogOpen}
					onOpenChange={setDialogOpen}
					onConfirm={handleConfirmAction}
					actionType={pendingAction.action}
					isLoading={isLoading}
					jobCount={pendingAction.jobCount ?? 1}
				/>
			)}
		</>
	);
}
