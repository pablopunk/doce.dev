/**
 * Generic health check endpoint utility.
 * Tests if a server is responding to HTTP requests or via Docker API.
 */

import { runCommand } from "@/server/utils/execAsync";

const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 5_000;

export interface HealthCheckOptions {
	/**
	 * Path to check (default: "/")
	 */
	path?: string;

	/**
	 * Timeout in milliseconds (default: 5000)
	 */
	timeoutMs?: number;

	/**
	 * Expected HTTP status codes (default: any 2xx or 3xx)
	 */
	expectedStatus?: (status: number) => boolean;
}

/**
 * Check if a health endpoint is responding.
 *
 * @param port Port number of the server
 * @param options Configuration for the health check
 * @returns true if server is healthy, false otherwise
 */
export async function checkHealthEndpoint(
	hostOrPort: string | number,
	options: HealthCheckOptions = {},
): Promise<boolean> {
	const {
		path = "/",
		timeoutMs = DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
		expectedStatus = (status) => status >= 100 && status < 600,
	} = options;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);

		// Support both hostname (string) and port (number)
		const url =
			typeof hostOrPort === "string"
				? `http://${hostOrPort}${path}`
				: `http://127.0.0.1:${hostOrPort}${path}`;

		const response = await fetch(url, {
			signal: controller.signal,
		});

		clearTimeout(timeout);

		return expectedStatus(response.status);
	} catch {
		// Network error, timeout, or abort
		return false;
	}
}

/**
 * Check if a generic HTTP server is ready (responds to GET /).
 * Used for preview servers and production deployments.
 * Supports both port (number) and hostname (string) for localhost and container names.
 */
export async function checkHttpServerReady(
	portOrHost: number | string,
	timeoutMs?: number,
): Promise<boolean> {
	const options: HealthCheckOptions = {
		path: "/",
		// Any response means server is up
		expectedStatus: (status) => status >= 100 && status < 600,
	};

	if (timeoutMs !== undefined) {
		options.timeoutMs = timeoutMs;
	}

	return checkHealthEndpoint(portOrHost, options);
}

/**
 * Check if an OpenCode server is ready (responds to GET /doc with 200).
 * Supports both port (number) and hostname (string) for localhost and container names.
 */
export async function checkOpencodeServerReady(
	portOrHost: number | string,
	timeoutMs?: number,
): Promise<boolean> {
	const options: HealthCheckOptions = {
		path: "/doc",
		// Only 200 means ready
		expectedStatus: (status) => status === 200,
	};

	if (timeoutMs !== undefined) {
		options.timeoutMs = timeoutMs;
	}

	return checkHealthEndpoint(portOrHost, options);
}

/**
 * Check if a Docker container is running and healthy.
 * Useful for containers that can't be reached via HTTP from the app container.
 */
export async function checkDockerContainerReady(
	containerName: string,
): Promise<boolean> {
	try {
		// Check if container exists and is running
		const result = await runCommand(
			`docker inspect --format='{{.State.Running}}' ${containerName}`,
		);

		if (!result.success) {
			return false;
		}

		const isRunning = result.stdout.trim() === "true";
		if (!isRunning) {
			return false;
		}

		// Also check health status if available
		const healthResult = await runCommand(
			`docker inspect --format='{{.State.Health.Status}}' ${containerName}`,
		);

		// If health check is configured, require healthy status
		if (healthResult.success && healthResult.stdout.trim()) {
			const healthStatus = healthResult.stdout.trim();
			return healthStatus === "healthy" || healthStatus === "none";
		}

		// No health check configured, just running is enough
		return true;
	} catch {
		return false;
	}
}
