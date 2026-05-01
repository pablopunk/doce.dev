import { userInfo } from "node:os";
import { logger } from "@/server/logger";
import { runCommand } from "@/server/utils/execAsync";
import { startTailscaled } from "./daemon";

function shellArg(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function getOperatorUsername(): string | null {
	try {
		return userInfo().username || null;
	} catch {
		return null;
	}
}

function buildPermissionHint(stderr: string): string {
	const username = getOperatorUsername();
	const command = username
		? `sudo tailscale set --operator=${username}`
		: "sudo tailscale set --operator=$USER";

	return `${stderr.trim()}\n\nOn Linux, allow this user to manage Tailscale once with: ${command}`;
}

function isPermissionError(stderr: string): boolean {
	return (
		stderr.includes("Access denied") ||
		stderr.includes("prefs write access denied")
	);
}

export async function tailscaleUp(
	authKey: string,
	hostname: string,
): Promise<void> {
	await startTailscaled();

	logger.info({ hostname }, "Connecting to Tailscale");

	// Do not use --reset here: on Linux it clears the operator setting required
	// for non-root processes to manage Tailscale Serve.
	const upResult = await runCommand(
		`tailscale up --auth-key=${shellArg(authKey)}`,
		{ timeout: 30000 },
	);

	if (!upResult.success) {
		const message = isPermissionError(upResult.stderr)
			? buildPermissionHint(upResult.stderr)
			: upResult.stderr;
		throw new Error(`tailscale up failed: ${message}`);
	}

	const setResult = await runCommand(
		`tailscale set --hostname=${shellArg(hostname)} --accept-dns=true`,
		{ timeout: 10000 },
	);

	if (!setResult.success) {
		const message = isPermissionError(setResult.stderr)
			? buildPermissionHint(setResult.stderr)
			: setResult.stderr;
		throw new Error(`tailscale set failed: ${message}`);
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
