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

/**
 * Get the container hostname for the preview service.
 * Uses the docker-compose service name which is accessible within the shared network.
 */
function getPreviewHostname(projectId: string): string {
	return `${getProjectName(projectId)}-preview-1`;
}

/**
 * Get the container hostname for the opencode service.
 * Uses the docker-compose service name which is accessible within the shared network.
 */
function getOpencodeHostname(projectId: string): string {
	return `${getProjectName(projectId)}-opencode-1`;
}

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

/**
 * Check if the preview server is ready.
 * Uses container hostname to check health within the Docker network.
 * Falls back to Docker container status if HTTP check fails.
 */
export async function checkPreviewReady(projectId: string): Promise<boolean> {
	// Try HTTP check via container hostname on the shared network
	const hostname = `${getPreviewHostname(projectId)}:4321`;
	const httpReady = await checkHttpServerReady(
		hostname,
		HEALTH_CHECK_TIMEOUT_MS,
	);
	if (httpReady) {
		return true;
	}

	// Fall back to checking Docker container status directly
	const containerName = getPreviewHostname(projectId);
	return checkDockerContainerReady(containerName);
}

/**
 * Check if the opencode server is ready.
 * Uses container hostname to check health within the Docker network.
 * Falls back to Docker container status if HTTP check fails.
 */
export async function checkOpencodeReady(projectId: string): Promise<boolean> {
	// Try HTTP check via container hostname on the shared network
	const hostname = `${getOpencodeHostname(projectId)}:3000`;
	const httpReady = await checkOpencodeServerReady(
		hostname,
		HEALTH_CHECK_TIMEOUT_MS,
	);
	if (httpReady) {
		return true;
	}

	// Fall back to checking Docker container status directly
	const containerName = getOpencodeHostname(projectId);
	return checkDockerContainerReady(containerName);
}
