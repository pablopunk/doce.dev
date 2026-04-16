import { logger } from "@/server/logger";
import { runCommand } from "@/server/utils/execAsync";
import { startTailscaled } from "./daemon";

export async function tailscaleUp(
	authKey: string,
	hostname: string,
): Promise<void> {
	await startTailscaled();

	logger.info({ hostname }, "Connecting to Tailscale");

	const result = await runCommand(
		`tailscale up --auth-key=${authKey} --hostname=${hostname} --reset`,
		{ timeout: 30000 },
	);

	if (!result.success) {
		throw new Error(`tailscale up failed: ${result.stderr}`);
	}

	logger.info({ hostname }, "Connected to Tailscale");
}

export async function tailscaleDown(): Promise<void> {
	logger.info("Disconnecting from Tailscale");

	const result = await runCommand("tailscale down", { timeout: 10000 });

	if (!result.success) {
		logger.warn({ stderr: result.stderr }, "tailscale down failed");
	}

	logger.info("Disconnected from Tailscale");
}
