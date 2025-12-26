import { execSync } from "node:child_process";
import { logger } from "@/server/logger";

const DOCKER_CHECK_TIMEOUT_MS = 2_000;

/**
 * Check if Docker daemon is available.
 * Uses `docker info` command which is the fastest way to verify Docker is running.
 */
export async function checkDockerHealth(): Promise<{ ok: boolean }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOCKER_CHECK_TIMEOUT_MS);

    try {
      execSync("docker info", { stdio: "ignore", timeout: DOCKER_CHECK_TIMEOUT_MS });
      clearTimeout(timeoutId);
      return { ok: true };
    } catch {
      clearTimeout(timeoutId);
      logger.warn("Docker health check failed - Docker daemon may not be running");
      return { ok: false };
    }
  } catch (error) {
    logger.warn({ error }, "Docker health check error");
    return { ok: false };
  }
}
