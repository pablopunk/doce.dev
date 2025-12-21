import useSWR from "swr";
import type { SWRConfiguration } from "swr";

interface QueueJob {
	id: string;
	type: string;
	status: string;
	createdAt: string;
	completedAt?: string;
	error?: string;
}

interface UseQueueJobsOptions {
	projectId?: string;
	fallbackData?: QueueJob[];
	refreshInterval?: number; // Override default poll interval
}

/**
 * Hook to fetch queue jobs for a project or globally
 * Polls every 5 seconds by default for live status updates
 */
export function useQueueJobs(options?: UseQueueJobsOptions) {
	const endpoint = options?.projectId
		? `/api/queue/jobs?projectId=${options.projectId}`
		: "/api/queue/jobs";

	const config: SWRConfiguration<QueueJob[]> = {
		revalidateOnMount: true,
		refreshInterval: options?.refreshInterval ?? 5000, // Poll every 5 seconds by default
	};

	if (options?.fallbackData) {
		config.fallbackData = options.fallbackData;
	}

	const { data, error, isLoading, mutate } = useSWR<QueueJob[]>(
		endpoint,
		config
	);

	return {
		jobs: data,
		isLoading: isLoading && !data,
		error,
		mutate,
	};
}
