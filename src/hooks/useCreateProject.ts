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

		// Astro Actions with Devalue return [data, ok, projectId] format
		// where projectId is the actual hex string returned by the backend
		let projectId: string | undefined;

		if (Array.isArray(result)) {
			// The actual projectId is stored in the third element (index 2)
			projectId = result[2] as string | undefined;
		}

		if (!projectId) {
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
