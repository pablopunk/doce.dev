import { spawn } from "node:child_process";
import { logger } from "@/server/logger";
import { runCommand } from "@/server/utils/execAsync";

let daemonProcess: ReturnType<typeof spawn> | null = null;

export async function isTailscaleInstalled(): Promise<boolean> {
	const result = await runCommand("tailscale version", { timeout: 5000 });
	return result.success;
}

export async function isTailscaledRunning(): Promise<boolean> {
	const result = await runCommand("tailscale status --json", { timeout: 5000 });
	return result.success;
}

export async function startTailscaled(): Promise<void> {
	if (await isTailscaledRunning()) {
		logger.info("tailscaled already running");
		return;
	}

	logger.info("Starting tailscaled in userspace mode");

	daemonProcess = spawn(
		"tailscaled",
		["--tun=userspace-networking", "--statedir=/app/data/tailscale"],
		{
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
		},
	);

	daemonProcess.stdout?.on("data", (data: Buffer) => {
		logger.debug({ source: "tailscaled" }, data.toString().trim());
	});

	daemonProcess.stderr?.on("data", (data: Buffer) => {
		logger.debug({ source: "tailscaled" }, data.toString().trim());
	});

	daemonProcess.on("exit", (code) => {
		logger.info({ exitCode: code }, "tailscaled exited");
		daemonProcess = null;
	});

	daemonProcess.unref();

	// Wait for the socket to become available
	const maxAttempts = 20;
	for (let i = 0; i < maxAttempts; i++) {
		await new Promise((resolve) => setTimeout(resolve, 500));
		if (await isTailscaledRunning()) {
			logger.info("tailscaled is ready");
			return;
		}
	}

	throw new Error("tailscaled failed to start within 10 seconds");
}

export async function stopTailscaled(): Promise<void> {
	if (daemonProcess) {
		daemonProcess.kill("SIGTERM");
		daemonProcess = null;
	}

	// Also try killing any system-level tailscaled
	await runCommand("pkill tailscaled", { timeout: 3000 });
	logger.info("tailscaled stopped");
}
