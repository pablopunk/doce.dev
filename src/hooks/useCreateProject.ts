import { useCallback } from "react";
import { useSWRConfig } from "swr";

interface CreateProjectInput {
	prompt: string;
	model: string;
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

		const result = (await response.json()) as unknown[];

		// Astro Actions return [data, ok, error] format
		const actionData = Array.isArray(result) ? result[0] : result;

		if (!actionData || typeof actionData !== "object") {
			throw new Error("Invalid response from server");
		}

		const { success, projectId } = actionData as {
			success?: boolean | number;
			projectId?: string;
		};

		if (!success || !projectId) {
			throw new Error("No project ID returned");
		}

			// Invalidate projects cache to trigger refetch
			await mutate("/api/projects");

			return projectId;
		},
		[mutate]
	);

	return { createProject };
}
