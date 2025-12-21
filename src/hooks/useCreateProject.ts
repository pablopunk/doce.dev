import { useCallback } from "react";
import { useSWRConfig } from "swr";

interface CreateProjectInput {
	prompt: string;
	model: string;
}

interface CreateProjectResult {
	projectId: string;
}

/**
 * Hook for creating a new project
 * Automatically updates projects cache after creation
 */
export function useCreateProject() {
	const { mutate } = useSWRConfig();

	const createProject = useCallback(
		async (input: CreateProjectInput) => {
			const formData = new FormData();
			formData.append("prompt", input.prompt);
			formData.append("model", input.model);

			const response = await fetch("/_actions/projects.create", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new Error("Failed to create project");
			}

			const result = (await response.json()) as {
				data: CreateProjectResult | null;
				error?: { message: string };
			};

			if (result.error) {
				throw new Error(result.error.message);
			}

			if (!result.data?.projectId) {
				throw new Error("No project ID returned");
			}

			// Invalidate projects cache to trigger refetch
			await mutate("/api/projects");

			return result.data.projectId;
		},
		[mutate]
	);

	return { createProject };
}
