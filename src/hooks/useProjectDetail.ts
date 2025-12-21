import useSWR from "swr";
import type { SWRConfiguration } from "swr";
import type { Project } from "@/server/db/schema";

interface UseProjectDetailOptions {
	fallbackData?: Project;
}

/**
 * Hook to fetch a single project's details and status
 * Polls every 10 seconds to keep status updated
 */
export function useProjectDetail(
	projectId: string,
	options?: UseProjectDetailOptions
) {
	const config: SWRConfiguration<Project> = {
		revalidateOnMount: true,
		refreshInterval: 10000, // Poll every 10 seconds
	};

	if (options?.fallbackData) {
		config.fallbackData = options.fallbackData;
	}

	const { data, error, isLoading, mutate } = useSWR<Project>(
		`/api/projects/${projectId}`,
		config
	);

	return {
		project: data,
		isLoading: isLoading && !data,
		error,
		mutate,
	};
}
