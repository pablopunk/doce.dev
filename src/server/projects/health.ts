import {
	checkDockerContainerReady,
	checkHttpServerReady,
	checkOpencodeServerReady,
} from "@/server/health/checkHealthEndpoint";
import { getOpencodePort } from "@/server/opencode/runtime";
import { getPreviewContainerName } from "@/server/projects/paths";

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

/**
 * Check if the preview server is ready.
 * Uses container hostname to check health within the Docker network.
 * Falls back to Docker container status if HTTP check fails.
 */
export async function checkPreviewReady(projectId: string): Promise<boolean> {
	// Try HTTP check via container hostname on the shared network
	const hostname = `${getPreviewContainerName(projectId)}:4321`;
	const httpReady = await checkHttpServerReady(
		hostname,
		HEALTH_CHECK_TIMEOUT_MS,
	);
	if (httpReady) {
		return true;
	}

	// Fall back to checking Docker container status directly
	const containerName = getPreviewContainerName(projectId);
	return checkDockerContainerReady(containerName);
}

/**
 * Check if the central opencode server is ready.
 */
export async function checkOpencodeReady(): Promise<boolean> {
	return checkOpencodeServerReady(getOpencodePort(), HEALTH_CHECK_TIMEOUT_MS);
}
