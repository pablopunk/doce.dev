import { logger } from "@/server/logger";
import { runCommand } from "@/server/utils/execAsync";

/**
 * Register a local port with Tailscale Serve for HTTPS access.
 * Uses --bg to run in background mode.
 */
export async function registerServe(
	localPort: number,
	httpsPort = 443,
): Promise<void> {
	logger.info({ localPort, httpsPort }, "Registering Tailscale Serve");

	const result = await runCommand(
		`tailscale serve --bg --https=${httpsPort} localhost:${localPort}`,
		{ timeout: 10000 },
	);

	if (!result.success) {
		throw new Error(`tailscale serve failed: ${result.stderr}`);
	}

	logger.info({ localPort, httpsPort }, "Tailscale Serve registered");
}

/**
 * Unregister a Tailscale Serve entry.
 */
export async function unregisterServe(httpsPort = 443): Promise<void> {
	logger.info({ httpsPort }, "Unregistering Tailscale Serve");

	const result = await runCommand(`tailscale serve --https=${httpsPort} off`, {
		timeout: 10000,
	});

	if (!result.success) {
		logger.warn({ stderr: result.stderr }, "tailscale serve off failed");
	}
}

/**
 * Get current Tailscale Serve status as JSON.
 */
export async function getServeStatus(): Promise<unknown> {
	const result = await runCommand("tailscale serve status --json", {
		timeout: 5000,
	});

	if (!result.success) {
		return null;
	}

	try {
		return JSON.parse(result.stdout);
	} catch {
		return null;
	}
}
