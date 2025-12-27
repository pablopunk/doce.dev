import {
	checkHttpServerReady,
	checkOpencodeServerReady,
} from "@/server/health/checkHealthEndpoint";

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

/**
 * Check if the preview server is ready.
 */
export async function checkPreviewReady(devPort: number): Promise<boolean> {
	return checkHttpServerReady(devPort, HEALTH_CHECK_TIMEOUT_MS);
}

/**
 * Check if the opencode server is ready.
 */
export async function checkOpencodeReady(
	opencodePort: number,
): Promise<boolean> {
	return checkOpencodeServerReady(opencodePort, HEALTH_CHECK_TIMEOUT_MS);
}
