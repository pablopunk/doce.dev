import useSWR from "swr";
import type { SWRConfiguration } from "swr";
import type { Project } from "@/server/db/schema";

/**
 * Hook to fetch projects list for current user
 * Automatically refetches on window focus and with 30 second polling
 */
export function useProjects(fallbackData?: Project[]) {
	const config: SWRConfiguration<Project[]> = {
		revalidateOnMount: true,
		refreshInterval: 30000, // Revalidate every 30 seconds
	};

	if (fallbackData) {
		config.fallbackData = fallbackData;
	}

	const { data, error, isLoading, mutate } = useSWR<Project[]>(
		"/api/projects",
		config
	);

	return {
		projects: data,
		isLoading: isLoading && !data,
		error,
		mutate,
	};
}
