import { logger } from "@/server/logger";
import { tailscaleUp } from "./auth";
import { getTailscaleConfig, setTailscaleConfig } from "./config";
import { isTailscaleInstalled } from "./daemon";
import { registerServe } from "./serve";
import { getTailscaleStatus } from "./status";

/**
 * Auto-start Tailscale if it was previously enabled.
 * Called during app startup — non-blocking and non-fatal.
 */
export async function ensureTailscaleStarted(): Promise<void> {
	const installed = await isTailscaleInstalled();
	if (!installed) {
		logger.debug("Tailscale not installed, skipping auto-start");
		return;
	}

	const config = await getTailscaleConfig();
	if (!config.enabled || !config.authKey || !config.hostname) {
		logger.debug("Tailscale not enabled or missing config, skipping");
		return;
	}

	try {
		logger.info("Auto-starting Tailscale from saved config");
		await tailscaleUp(config.authKey, config.hostname);

		// Refresh tailnet name in case it changed
		const status = await getTailscaleStatus();
		if (status.tailnetName && status.tailnetName !== config.tailnetName) {
			await setTailscaleConfig({ tailnetName: status.tailnetName });
		}

		// Register the main app
		await registerServe(4321, 443);
		logger.info("Tailscale auto-start complete");
	} catch (error) {
		logger.warn(
			{ error },
			"Tailscale auto-start failed (will retry on next request)",
		);
	}
}
