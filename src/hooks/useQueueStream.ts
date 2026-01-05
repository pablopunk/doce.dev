import { useEffect, useState } from "react";
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

	useEffect(() => {
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
	}, [pagination.page, pagination.totalCount, filters]);

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
