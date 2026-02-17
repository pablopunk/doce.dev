import {
	AlertCircle,
	Check,
	Clock,
	Loader,
	Play,
	RotateCcw,
	StopCircle,
	Trash2,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQueueActions } from "@/hooks/useQueueActions";
import { useQueueStream } from "@/hooks/useQueueStream";
import type { QueueJob } from "@/server/db/schema";
import { ConfirmQueueActionDialog } from "./ConfirmQueueActionDialog";
import { ConfirmStopAllDialog } from "./ConfirmStopAllDialog";
import { Pagination } from "./Pagination";
import { QueuePlayerControl } from "./QueuePlayerControl";

interface QueueTableLiveProps {
	initialJobs: QueueJob[];
	initialPage?: number;
	initialPagination?: {
		page: number;
		pageSize: number;
		totalCount: number;
		totalPages: number;
	};
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
	initialPagination: _initialPagination,
	initialPaused,
	initialConcurrency = 2,
	filters = {},
}: QueueTableLiveProps) {
	const { jobs, paused, concurrency, pagination, hasNewJobs, setPagination } =
		useQueueStream(
			initialPage,
			initialJobs,
			initialPaused,
			initialConcurrency,
			filters,
		);

	const {
		isLoading,
		pendingAction,
		dialogOpen,
		stopAllDialogOpen,
		setDialogOpen,
		setStopAllDialogOpen,
		handleToggleQueue,
		handleStopAll,
		handleConfirmStopAll,
		handleBulkDelete,
		handleConfirmAction,
		handleAction,
	} = useQueueActions();

	const getJobsByState = (state: QueueJob["state"]) => {
		return jobs.filter((j) => j.state === state);
	};

	const getStateIcon = (state: QueueJob["state"]) => {
		switch (state) {
			case "succeeded":
				return <Check className="w-3 h-3 text-success" />;
			case "failed":
				return <X className="w-3 h-3 text-destructive" />;
			case "running":
				return <Loader className="w-3 h-3 animate-spin" />;
			case "cancelled":
				return <AlertCircle className="w-3 h-3" />;
			default:
				return <Clock className="w-3 h-3" />;
		}
	};

	const formatCreatedAt = (createdAt: QueueJob["createdAt"]) => {
		return new Date(createdAt).toLocaleString("en-US", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		});
	};

	const renderMobileActions = (job: QueueJob) => (
		<div className="mt-3 flex flex-wrap gap-2">
			{job.state === "queued" && (
				<Button
					onClick={() => handleAction("runNow", job.id)}
					variant="secondary"
					size="xs"
				>
					<Play className="w-3 h-3 mr-1" />
					Run
				</Button>
			)}
			{(job.state === "queued" || job.state === "running") && (
				<Button
					onClick={() => handleAction("cancel", job.id)}
					variant="destructive"
					size="xs"
				>
					<X className="w-3 h-3 mr-1" />
					Cancel
				</Button>
			)}
			{job.state === "failed" && (
				<Button
					onClick={() => handleAction("retry", job.id)}
					variant="secondary"
					size="xs"
				>
					<RotateCcw className="w-3 h-3 mr-1" />
					Retry
				</Button>
			)}
			{job.state === "running" && (
				<Button
					onClick={() => handleAction("forceUnlock", job.id)}
					variant="secondary"
					size="xs"
				>
					<AlertCircle className="w-3 h-3 mr-1" />
					Unlock
				</Button>
			)}
			{(job.state === "succeeded" ||
				job.state === "failed" ||
				job.state === "cancelled") && (
				<Button
					onClick={() => handleAction("delete", job.id)}
					variant="ghost"
					size="xs"
				>
					<Trash2 className="w-3 h-3 mr-1" />
					Delete
				</Button>
			)}
		</div>
	);

	const handlePageChange = (newPage: number) => {
		const params = new URLSearchParams();
		params.set("page", newPage.toString());
		if (filters.state) params.set("state", filters.state);
		if (filters.type) params.set("type", filters.type);
		if (filters.projectId) params.set("projectId", filters.projectId);
		if (filters.q) params.set("q", filters.q);

		setPagination((prev) => ({ ...prev, page: newPage }));

		window.history.pushState({}, "", `?${params.toString()}`);
	};

	const stats = {
		queued: getJobsByState("queued").length,
		running: getJobsByState("running").length,
	};

	return (
		<>
			<div className="px-3 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
				<h1 className="text-2xl font-semibold mb-6">Queue</h1>

				<div className="mb-6">
					<QueuePlayerControl
						paused={paused}
						concurrency={concurrency}
						stats={stats}
						onToggleQueue={() => handleToggleQueue(paused)}
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
									className="w-full sm:w-auto"
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
									onClick={() =>
										handleBulkDelete(
											"succeeded",
											getJobsByState("succeeded").length,
										)
									}
									variant="ghost"
									size="sm"
								>
									<Trash2 className="w-3 h-3" />
									Delete {getJobsByState("succeeded").length} Succeeded
								</Button>
							)}
							{jobs.some((j) => j.state === "failed") && (
								<Button
									onClick={() =>
										handleBulkDelete("failed", getJobsByState("failed").length)
									}
									variant="ghost"
									size="sm"
								>
									<Trash2 className="w-3 h-3" />
									Delete {getJobsByState("failed").length} Failed
								</Button>
							)}
							{jobs.some((j) => j.state === "cancelled") && (
								<Button
									onClick={() =>
										handleBulkDelete(
											"cancelled",
											getJobsByState("cancelled").length,
										)
									}
									variant="ghost"
									size="sm"
								>
									<Trash2 className="w-3 h-3" />
									Delete {getJobsByState("cancelled").length} Cancelled
								</Button>
							)}
						</>
					)}
				</div>

				<div className="md:hidden space-y-3">
					{jobs.length === 0 ? (
						<div className="py-8 px-2 text-center text-muted-foreground rounded-lg border">
							No jobs found
						</div>
					) : (
						jobs.map((job) => (
							<div key={job.id} className="rounded-lg border p-3 bg-card/40">
								<div className="flex items-start justify-between gap-2">
									<div className="flex items-center gap-2 min-w-0">
										<span className="inline-flex items-center justify-center text-muted-foreground">
											{getStateIcon(job.state)}
										</span>
										<a
											href={`/queue/${job.id}`}
											className="hover:underline text-status-info font-mono text-xs"
										>
											{job.id.slice(0, 8)}
										</a>
									</div>
									<span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
										{job.state}
									</span>
								</div>
								<div className="mt-2 space-y-1 text-xs text-muted-foreground">
									<div className="break-all">
										<span className="font-medium text-foreground">Type:</span>{" "}
										{job.type}
									</div>
									<div className="break-all">
										<span className="font-medium text-foreground">
											Project:
										</span>{" "}
										{job.projectId || "—"}
									</div>
									<div>
										<span className="font-medium text-foreground">
											Created:
										</span>{" "}
										{formatCreatedAt(job.createdAt)}
									</div>
								</div>
								{renderMobileActions(job)}
							</div>
						))
					)}
				</div>

				<div className="hidden md:block overflow-x-auto">
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
												className="hover:underline text-status-info"
											>
												{job.id.slice(0, 8)}
											</a>
										</td>
										<td className="py-2 px-2">{job.type}</td>
										<td className="py-2 px-2 text-xs text-muted-foreground">
											{job.projectId || "—"}
										</td>
										<td className="py-2 px-2 text-xs text-muted-foreground">
											{formatCreatedAt(job.createdAt)}
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

			<ConfirmStopAllDialog
				isOpen={stopAllDialogOpen}
				onOpenChange={setStopAllDialogOpen}
				onConfirm={handleConfirmStopAll}
				isLoading={isLoading}
			/>
		</>
	);
}
