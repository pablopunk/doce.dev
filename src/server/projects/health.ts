import {
	checkHttpServerReady,
	checkOpencodeServerReady,
	checkDockerContainerReady,
} from "@/server/health/checkHealthEndpoint";

/**
 * Get the Docker Compose project name for a project (must match compose.ts)
 */
function getProjectName(projectId: string): string {
	return `doce_${projectId}`;
}

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

/**
 * Check if the preview server is ready.
 * First tries HTTP check, then falls back to Docker container check if that fails.
 */
export async function checkPreviewReady(
	devPort: number,
	projectId?: string,
): Promise<boolean> {
	// First try HTTP check (works if container is on host network or accessible via port)
	const httpReady = await checkHttpServerReady(
		devPort,
		HEALTH_CHECK_TIMEOUT_MS,
	);
	if (httpReady) {
		return true;
	}

	// If HTTP fails and we have project ID, check Docker container directly
	if (projectId) {
		const containerName = `${getProjectName(projectId)}-preview-1`;
		return checkDockerContainerReady(containerName);
	}

	return false;
}

/**
 * Check if the opencode server is ready.
 * First tries HTTP check, then falls back to Docker container check if that fails.
 */
export async function checkOpencodeReady(
	opencodePort: number,
	projectId?: string,
): Promise<boolean> {
	// First try HTTP check (works if container is on host network or accessible via port)
	const httpReady = await checkOpencodeServerReady(
		opencodePort,
		HEALTH_CHECK_TIMEOUT_MS,
	);
	if (httpReady) {
		return true;
	}

	// If HTTP fails and we have project ID, check Docker container directly
	if (projectId) {
		const containerName = `${getProjectName(projectId)}-opencode-1`;
		return checkDockerContainerReady(containerName);
	}

	return false;
}
