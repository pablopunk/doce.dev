/**
 * Tracks which Docker Compose version is in use.
 * Separated to avoid circular dependencies between compose.ts and paths.ts.
 *
 * Docker Compose v1 (docker-compose) uses underscores in container names.
 * Docker Compose v2 (docker compose) uses hyphens in container names.
 */

let detectedV1: boolean | null = null;

/**
 * Called by compose.ts after detecting the compose command.
 */
export function setComposeV1(isV1: boolean): void {
	detectedV1 = isV1;
}

/**
 * Returns true if using Docker Compose v1 (underscores in container names).
 * Defaults to false (v2) before detection, since modern Docker installations
 * typically use `docker compose` and several health checks need the expected
 * container name before compose detection has run.
 */
export function isComposeV1(): boolean {
	return detectedV1 ?? false;
}
