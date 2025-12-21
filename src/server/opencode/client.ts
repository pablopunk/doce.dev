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



export type { OpencodeClient };
