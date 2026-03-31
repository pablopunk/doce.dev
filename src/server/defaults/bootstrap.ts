/**
 * Bootstrap — install default MCPs and skills on first setup.
 * Idempotent: safe to run multiple times. Skips already-configured items.
 * Non-blocking: runs in the background.
 */

import { logger } from "@/server/logger";
import { addMcpServer, listMcpServers } from "@/server/mcps/mcps.service";
import {
	installSkill,
	listInstalledSkills,
} from "@/server/skills/skills.service";

interface DefaultMcp {
	name: string;
	type: "remote" | "local";
	url?: string;
	command?: string[];
}

interface DefaultSkill {
	source: string;
	skillName: string;
}

const DEFAULT_MCPS: DefaultMcp[] = [
	{ name: "context7", type: "remote", url: "https://mcp.context7.com/mcp" },
	{ name: "exa", type: "remote", url: "https://mcp.exa.ai/mcp" },
	{ name: "gh_grep", type: "remote", url: "https://mcp.grep.app" },
];

const DEFAULT_SKILLS: DefaultSkill[] = [
	{ source: "anthropics/skills", skillName: "frontend-design" },
	{ source: "vercel-labs/skills", skillName: "find-skills" },
	{ source: "vercel-labs/agent-skills", skillName: "web-design-guidelines" },
	{
		source: "vercel-labs/agent-skills",
		skillName: "vercel-react-best-practices",
	},
	{ source: "astrolicious/agent-skills", skillName: "astro" },
];

async function ensureDefaultMcps(): Promise<void> {
	const existing = await listMcpServers();

	for (const mcp of DEFAULT_MCPS) {
		if (existing[mcp.name]) {
			logger.debug({ name: mcp.name }, "[Bootstrap] MCP already configured");
			continue;
		}

		try {
			await addMcpServer(mcp.name, {
				type: mcp.type,
				url: mcp.url,
				command: mcp.command,
				enabled: true,
			});
			logger.info({ name: mcp.name }, "[Bootstrap] Added default MCP");
		} catch (error) {
			logger.warn(
				{ name: mcp.name, error },
				"[Bootstrap] Failed to add default MCP",
			);
		}
	}
}

async function ensureDefaultSkills(): Promise<void> {
	const installed = await listInstalledSkills();
	const installedNames = new Set(installed.map((s) => s.name));

	for (const skill of DEFAULT_SKILLS) {
		if (installedNames.has(skill.skillName)) {
			logger.debug(
				{ skill: skill.skillName },
				"[Bootstrap] Skill already installed",
			);
			continue;
		}

		try {
			const result = await installSkill(skill.source, skill.skillName);
			if (result.success) {
				logger.info(
					{ source: skill.source, skill: skill.skillName },
					"[Bootstrap] Installed default skill",
				);
			} else {
				logger.warn(
					{ source: skill.source, skill: skill.skillName, error: result.error },
					"[Bootstrap] Failed to install default skill",
				);
			}
		} catch (error) {
			logger.warn(
				{ source: skill.source, skill: skill.skillName, error },
				"[Bootstrap] Failed to install default skill",
			);
		}
	}
}

async function runBootstrap(): Promise<void> {
	logger.info("[Bootstrap] Starting defaults bootstrap");
	const start = Date.now();

	await ensureDefaultMcps();
	await ensureDefaultSkills();

	const durationMs = Date.now() - start;
	logger.info({ durationMs }, "[Bootstrap] Defaults bootstrap completed");
}

let bootstrapStarted = false;

/**
 * Start the defaults bootstrap (non-blocking, fire-and-forget).
 * Safe to call multiple times — only runs once per process.
 */
export function startDefaultsBootstrap(): void {
	if (bootstrapStarted) return;
	bootstrapStarted = true;

	runBootstrap().catch((error) => {
		logger.error({ error }, "[Bootstrap] Defaults bootstrap failed");
	});
}
