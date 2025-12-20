import { createOpencodeClient as createClient, type OpencodeClient } from "@opencode-ai/sdk";
import { logger } from "@/server/logger";

/**
 * Create an opencode client for a project.
 */
export function createOpencodeClient(opencodePort: number): OpencodeClient {
  const baseUrl = `http://127.0.0.1:${opencodePort}`;

  logger.debug({ baseUrl }, "Creating opencode client");

  return createClient({
    baseUrl,
  });
}

/**
 * Check if opencode server is healthy.
 */
export async function isOpencodeHealthy(opencodePort: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${opencodePort}/doc`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Check session status directly from OpenCode server.
 * Returns true if session is idle, false if busy or error.
 * This is independent of the event stream and provides a robust fallback.
 */
export async function checkSessionStatusDirectly(
  sessionId: string,
  opencodePort: number
): Promise<boolean> {
  try {
    const response = await fetch(
      `http://127.0.0.1:${opencodePort}/session/status`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (!response.ok) {
      logger.debug(
        { sessionId, status: response.status },
        "Session status check returned non-OK response"
      );
      return false;
    }

    const data = (await response.json()) as Record<string, { type: string }>;
    const sessionStatus = data[sessionId];

    if (!sessionStatus) {
      logger.debug({ sessionId }, "Session not found in status response");
      return false;
    }

    const isIdle = sessionStatus.type === "idle";
    logger.debug(
      { sessionId, status: sessionStatus.type, isIdle },
      "Session status checked directly"
    );
    return isIdle;
  } catch (error) {
    logger.debug(
      { error, sessionId },
      "Failed to check session status directly, will fall back to event stream"
    );
    return false;
  }
}

export type { OpencodeClient };
