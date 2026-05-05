import { useEffect, useRef, useState } from "react";
import { useEventSource } from "@/hooks/useEventSource";
import type { QueueJob } from "@/server/db/schema";

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

interface QueueStreamFilters {
	state?: string | undefined;
	type?: string | undefined;
	projectId?: string | undefined;
	q?: string | undefined;
}

export function useQueueStream(
	initialPage: number,
	initialJobs: QueueJob[],
	initialPaused: boolean,
	initialConcurrency: number,
	filters: QueueStreamFilters,
) {
	const [jobs, setJobs] = useState<QueueJob[]>(initialJobs);
	const [paused, setPaused] = useState(initialPaused);
	const [concurrency, setConcurrency] = useState(initialConcurrency);
	const [pagination, setPagination] = useState<PaginationData>({
		page: initialPage,
		pageSize: 25,
		totalCount: initialJobs.length,
		totalPages: 1,
	});
	const [hasNewJobs, setHasNewJobs] = useState(false);
	const totalCountRef = useRef(initialJobs.length);

	const streamKey = [
		pagination.page,
		filters.state ?? "",
		filters.type ?? "",
		filters.projectId ?? "",
		filters.q ?? "",
	].join("|");

	// biome-ignore lint/correctness/useExhaustiveDependencies: stream key changes intentionally clear the new-jobs indicator
	useEffect(() => {
		setHasNewJobs(false);
	}, [streamKey]);

	const params = new URLSearchParams();
	params.set("page", String(pagination.page));
	if (filters.state) params.set("state", filters.state);
	if (filters.type) params.set("type", filters.type);
	if (filters.projectId) params.set("projectId", filters.projectId);
	if (filters.q) params.set("q", filters.q);

	useEventSource({
		url: `/api/queue/jobs-stream?${params.toString()}`,
		listeners: {
			message: (event) => {
				try {
					const data = JSON.parse(event.data) as QueueStreamData;
					setJobs(data.jobs);
					setPaused(data.paused);
					setConcurrency(data.concurrency);

					const previousTotalCount = totalCountRef.current;
					if (
						pagination.page === 1 &&
						data.pagination.totalCount > previousTotalCount
					) {
						setHasNewJobs(true);
					}

					totalCountRef.current = data.pagination.totalCount;
					setPagination(data.pagination);
				} catch (err) {
					console.error("Failed to parse queue update:", err);
				}
			},
		},
	});

	return {
		jobs,
		paused,
		concurrency,
		pagination,
		hasNewJobs,
		setHasNewJobs,
		setPagination,
	};
}
