import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "@opencode-ai/plugin";

function getProjectId(directory) {
	return path.basename(path.dirname(directory));
}

function getEnvFilePath(directory) {
	return path.join(directory, "..", ".env");
}

async function detectComposeCommand() {
	const dockerCompose = await runCommand("docker", ["compose", "version"]);
	if (dockerCompose.exitCode === 0) {
		return { command: "docker", baseArgs: ["compose"], separator: "-" };
	}

	const dockerComposeV1 = await runCommand("docker-compose", ["version"]);
	if (dockerComposeV1.exitCode === 0) {
		return { command: "docker-compose", baseArgs: [], separator: "_" };
	}

	throw new Error(
		"Neither 'docker compose' nor 'docker-compose' is available.",
	);
}

function runCommand(command, args, options = {}) {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			cwd: options.cwd,
			env: options.env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		proc.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});

		proc.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		proc.on("close", (code) => {
			resolve({ exitCode: code ?? 1, stdout, stderr });
		});

		proc.on("error", (error) => {
			resolve({
				exitCode: 1,
				stdout,
				stderr: error.message,
			});
		});
	});
}

async function readDevPort(directory) {
	try {
		const envContent = await fs.readFile(getEnvFilePath(directory), "utf-8");
		const match = envContent.match(/^DEV_PORT=(\d+)$/m);
		return match ? Number.parseInt(match[1], 10) : null;
	} catch {
		return null;
	}
}

async function readRecentAppLogs(directory, maxLines = 30) {
	try {
		const logPath = path.join(directory, "logs", "docker.log");
		const content = await fs.readFile(logPath, "utf-8");
		const lines = content
			.split(/\r?\n/)
			.filter((line) => line.startsWith("[app]"));
		return lines.slice(-maxLines);
	} catch {
		return [];
	}
}

export default tool({
	description:
		"Restart the Astro preview dev server for this doce.dev project. Use this when the preview is stuck, not refreshing, or the dev container needs to be bounced.",
	args: {},
	async execute(_args, context) {
		const projectId = getProjectId(context.directory);
		const envFile = getEnvFilePath(context.directory);
		const compose = await detectComposeCommand();
		const projectName = `doce_${projectId}`;

		context.metadata({
			title: "Restarting dev server",
			metadata: { projectId },
		});

		const commonArgs = [
			...compose.baseArgs,
			"--project-name",
			projectName,
			"--ansi",
			"never",
			"--env-file",
			envFile,
		];

		let action = "restart";
		let result = await runCommand(
			compose.command,
			[...commonArgs, "restart", "preview"],
			{ cwd: context.directory },
		);

		if (result.exitCode !== 0) {
			action = "up";
			result = await runCommand(
				compose.command,
				[...commonArgs, "up", "-d", "--build", "preview"],
				{ cwd: context.directory },
			);
		}

		if (result.exitCode !== 0) {
			return [
				`Failed to ${action} the preview service for project ${projectId}.`,
				result.stderr.trim() || result.stdout.trim() || "No command output.",
			].join("\n\n");
		}

		const devPort = await readDevPort(context.directory);
		const recentAppLogs = await readRecentAppLogs(context.directory);
		const serviceName = `doce_${projectId}${compose.separator}preview${compose.separator}1`;

		const response = [
			`Preview dev server ${action === "restart" ? "restarted" : "started"} for project ${projectId}.`,
			`Docker service: ${serviceName}`,
			devPort ? `Preview URL: http://localhost:${devPort}` : null,
			result.stdout.trim() ? `Command output:\n${result.stdout.trim()}` : null,
			recentAppLogs.length > 0
				? `Recent app logs:\n${recentAppLogs.join("\n")}`
				: null,
		]
			.filter(Boolean)
			.join("\n\n");

		return response;
	},
});
