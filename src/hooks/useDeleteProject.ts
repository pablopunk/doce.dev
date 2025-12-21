import { useCallback } from "react";
import { useSWRConfig } from "swr";
import type { Project } from "@/server/db/schema";

/**
 * Hook for deleting a project
 * Automatically updates projects cache after deletion
 */
export function useDeleteProject() {
	const { mutate } = useSWRConfig();

	const deleteProject = useCallback(
		async (projectId: string) => {
			// Optimistically update cache
			await mutate(
				"/api/projects",
				(data: Project[] | undefined) => {
					if (!data) return data;
					return data.filter((p) => p.id !== projectId);
				},
				false
			);

			try {
				const response = await fetch("/_actions/projects.delete", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ projectId }),
				});

				if (!response.ok) {
					// Revert optimistic update on error
					await mutate("/api/projects");
					throw new Error("Failed to delete project");
				}

				// Confirm deletion by refetching
				await mutate("/api/projects");
			} catch (error) {
				// Revert on any error
				await mutate("/api/projects");
				throw error;
			}
		},
		[mutate]
	);

	return { deleteProject };
}
