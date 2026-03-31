/**
 * Skills service — wraps the `npx skills` CLI and skills.sh search API.
 * OpenCode's filesystem is the source of truth (no DB).
 */

import { getRequiredGlobalSkillReason } from "@/lib/skills";
import { logger } from "@/server/logger";
import { getDataPath } from "@/server/projects/paths";
import { runCommand } from "@/server/utils/execAsync";

const SKILLS_SEARCH_API = "https://skills.sh/api/search";
const CLI_TIMEOUT_MS = 60_000;
const SEARCH_TIMEOUT_MS = 10_000;

export interface InstalledSkill {
	name: string;
	path: string;
	scope: string;
	agents: string[];
}

export interface SearchResultSkill {
	id: string;
	skillId: string;
	name: string;
	installs: number;
	source: string;
}

interface SkillsSearchResponse {
	query: string;
	skills: SearchResultSkill[];
	count: number;
}

function getSkillsEnv(): NodeJS.ProcessEnv {
	const dataPath = getDataPath();
	return {
		...process.env,
		HOME: dataPath,
		XDG_CONFIG_HOME: dataPath,
		XDG_DATA_HOME: dataPath,
		XDG_STATE_HOME: dataPath,
		XDG_CACHE_HOME: `${dataPath}/cache`,
	};
}

export async function searchSkills(
	query: string,
): Promise<SearchResultSkill[]> {
	try {
		const url = `${SKILLS_SEARCH_API}?q=${encodeURIComponent(query)}`;
		const response = await fetch(url, {
			signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
		});

		if (!response.ok) {
			logger.warn(
				{ status: response.status },
				"[Skills] Search API returned non-OK status",
			);
			return [];
		}

		const data = (await response.json()) as SkillsSearchResponse;
		return data.skills ?? [];
	} catch (error) {
		logger.error({ error }, "[Skills] Search failed");
		return [];
	}
}

export async function listInstalledSkills(): Promise<InstalledSkill[]> {
	const env = getSkillsEnv();
	const result = await runCommand(
		`env HOME=${env.HOME} XDG_CONFIG_HOME=${env.XDG_CONFIG_HOME} npx skills list -g --json`,
		{ cwd: getDataPath(), timeout: CLI_TIMEOUT_MS },
	);

	if (!result.success) {
		logger.warn(
			{ stderr: result.stderr },
			"[Skills] Failed to list installed skills",
		);
		return [];
	}

	try {
		const parsed = JSON.parse(result.stdout) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed as InstalledSkill[];
	} catch {
		logger.warn("[Skills] Failed to parse skills list output");
		return [];
	}
}

export async function installSkill(
	source: string,
	skillName?: string,
): Promise<{ success: boolean; error?: string }> {
	const env = getSkillsEnv();
	const skillFlag = skillName ? ` -s ${skillName}` : "";
	const command = `env HOME=${env.HOME} XDG_CONFIG_HOME=${env.XDG_CONFIG_HOME} npx skills add ${source} -g -a opencode -y${skillFlag}`;

	logger.info({ source, skillName }, "[Skills] Installing skill");
	const result = await runCommand(command, {
		cwd: getDataPath(),
		timeout: CLI_TIMEOUT_MS,
	});

	if (!result.success) {
		logger.error(
			{ source, skillName, stderr: result.stderr },
			"[Skills] Install failed",
		);
		return { success: false, error: result.stderr || "Install failed" };
	}

	logger.info({ source, skillName }, "[Skills] Skill installed successfully");
	return { success: true };
}

export async function removeSkill(
	skillName: string,
): Promise<{ success: boolean; error?: string }> {
	const requiredSkillReason = getRequiredGlobalSkillReason(skillName);
	if (requiredSkillReason) {
		logger.warn(
			{ skillName },
			"[Skills] Attempted to remove a required global skill",
		);
		return {
			success: false,
			error: `${skillName} cannot be removed: ${requiredSkillReason.toLowerCase()}`,
		};
	}

	const env = getSkillsEnv();
	const command = `env HOME=${env.HOME} XDG_CONFIG_HOME=${env.XDG_CONFIG_HOME} npx skills remove ${skillName} -g -a opencode -y`;

	logger.info({ skillName }, "[Skills] Removing skill");
	const result = await runCommand(command, {
		cwd: getDataPath(),
		timeout: CLI_TIMEOUT_MS,
	});

	if (!result.success) {
		logger.error(
			{ skillName, stderr: result.stderr },
			"[Skills] Remove failed",
		);
		return { success: false, error: result.stderr || "Remove failed" };
	}

	logger.info({ skillName }, "[Skills] Skill removed successfully");
	return { success: true };
}
