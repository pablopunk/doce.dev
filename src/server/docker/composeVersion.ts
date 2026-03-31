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
 * Defaults to true (v1) before detection, since v1 is the legacy format.
 */
export function isComposeV1(): boolean {
	return detectedV1 ?? true;
}
