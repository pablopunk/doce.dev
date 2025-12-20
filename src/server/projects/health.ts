const HEALTH_CHECK_TIMEOUT_MS = 5_000;

/**
 * Check if the preview server is ready.
 */
export async function checkPreviewReady(devPort: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    const response = await fetch(`http://127.0.0.1:${devPort}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Any HTTP response means the server is up
    return response.status >= 100 && response.status < 600;
  } catch {
    return false;
  }
}

/**
 * Check if the opencode server is ready.
 */
export async function checkOpencodeReady(opencodePort: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    const response = await fetch(`http://127.0.0.1:${opencodePort}/doc`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return response.status === 200;
  } catch {
    return false;
  }
}
