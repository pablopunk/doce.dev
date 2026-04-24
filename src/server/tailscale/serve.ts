import { logger } from "@/server/logger";
import { runCommand } from "@/server/utils/execAsync";
import { readFile } from "node:fs/promises";

let cachedHostIp: string | null = null;

/**
 * Detect the host IP from within a Docker container.
 * Uses /proc/net/route to find the default gateway (which is the host).
 */
async function detectHostIp(): Promise<string | null> {
	try {
		// Read the routing table
		const route = await readFile("/proc/net/route", "utf-8");
		// Find the default gateway (destination 00000000)
		const lines = route.split("\n");
		for (const line of lines) {
			const parts = line.trim().split(/\s+/);
			// Format: Iface Destination Gateway Flags RefCnt Use Metric Mask MTU Window IRTT
			if (parts[1] === "00000000" && parts[2] && parts[2] !== "00000000") {
				// Convert hex IP to dotted decimal
				const hexIp = parts[2];
				const ip = [
					parseInt(hexIp.substring(6, 8), 16),
					parseInt(hexIp.substring(4, 6), 16),
					parseInt(hexIp.substring(2, 4), 16),
					parseInt(hexIp.substring(0, 2), 16),
				].join(".");
				return ip;
			}
		}
	} catch {
		// Not in a container or can't read route
	}
	return null;
}

/**
 * Get the target host for Tailscale Serve.
 * When running inside Docker, detects the host IP from routing table.
 * Otherwise uses localhost.
 */
async function getServeTargetHost(): Promise<string> {
	if (cachedHostIp) return cachedHostIp;

	// Try to detect if running in Docker by checking for docker-specific files
	try {
		await readFile("/proc/self/cgroup", "utf-8");
		const hostIp = await detectHostIp();
		if (hostIp) {
			cachedHostIp = hostIp;
			return hostIp;
		}
	} catch {
		// Not in Docker
	}
	return "localhost";
}

/**
 * Register a local port with Tailscale Serve for HTTPS access.
 * Uses --bg to run in background mode.
 */
export async function registerServe(
	localPort: number,
	httpsPort = 443,
): Promise<void> {
	logger.info({ localPort, httpsPort }, "Registering Tailscale Serve");

	const targetHost = await getServeTargetHost();
	const result = await runCommand(
		`tailscale serve --bg --https=${httpsPort} ${targetHost}:${localPort}`,
		{ timeout: 10000 },
	);

	if (!result.success) {
		throw new Error(`tailscale serve failed: ${result.stderr}`);
	}

	logger.info({ localPort, httpsPort, targetHost }, "Tailscale Serve registered");
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
