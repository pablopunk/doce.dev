import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import {
	getDataPath,
	getGlobalOpencodeConfigPath,
} from "@/server/projects/paths";

type PermissionAction = "allow" | "ask" | "deny";
type PermissionRule = PermissionAction | Record<string, PermissionAction>;

interface OpencodeConfig {
	$schema?: string;
	permission?: Record<string, PermissionRule>;
	[key: string]: unknown;
}

const DOCE_COMPACTION_PLUGIN_SOURCE_FILENAME = "doceCompactionPlugin.ts";
const DOCE_COMPACTION_PLUGIN_TARGET_FILENAME = "doce-compaction.ts";

function getDoceCompactionPluginSourcePath(): string {
	return path.join(
		process.cwd(),
		"src",
		"server",
		"opencode",
		DOCE_COMPACTION_PLUGIN_SOURCE_FILENAME,
	);
}

const PERMISSIVE_PERMISSION_CONFIG: Record<string, PermissionRule> = {
	read: { "*": "allow" },
	edit: { "*": "allow" },
	glob: "allow",
	grep: "allow",
	list: "allow",
	bash: { "*": "allow" },
	task: "allow",
	external_directory: { "*": "allow" },
	todoread: "allow",
	todowrite: "allow",
	webfetch: "allow",
	websearch: "allow",
	codesearch: "allow",
	lsp: { "*": "allow" },
	skill: { "*": "allow" },
	doom_loop: "allow",
	question: "allow",
	plan_enter: "allow",
	plan_exit: "allow",
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergePermissionRule(
	existing: PermissionRule | undefined,
	next: PermissionRule,
): PermissionRule {
	if (!isObject(existing) || !isObject(next)) {
		return next;
	}

	return {
		...existing,
		...next,
	};
}

function mergePermissionConfig(
	existing: Record<string, PermissionRule> | undefined,
): Record<string, PermissionRule> {
	const merged: Record<string, PermissionRule> = { ...(existing ?? {}) };

	for (const [key, value] of Object.entries(PERMISSIVE_PERMISSION_CONFIG)) {
		merged[key] = mergePermissionRule(merged[key], value);
	}

	return merged;
}

async function readExistingConfig(
	configPath: string,
): Promise<OpencodeConfig | null> {
	try {
		const content = await fs.readFile(configPath, "utf-8");
		const parsed = JSON.parse(content) as unknown;
		if (!isObject(parsed)) {
			return null;
		}

		return parsed as OpencodeConfig;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}

		logger.warn({ error, configPath }, "Failed to read global OpenCode config");
		return null;
	}
}

async function ensureGlobalDoceCompactionPlugin(): Promise<void> {
	const pluginDirectory = path.join(getDataPath(), "opencode", "plugins");
	const pluginPath = path.join(
		pluginDirectory,
		DOCE_COMPACTION_PLUGIN_TARGET_FILENAME,
	);
	await fs.mkdir(pluginDirectory, { recursive: true });
	await fs.copyFile(getDoceCompactionPluginSourcePath(), pluginPath);
	logger.debug(
		{ pluginPath },
		"Ensured global doce.dev OpenCode compaction plugin",
	);
}

export async function ensureGlobalOpencodeConfig(): Promise<void> {
	const configPath = getGlobalOpencodeConfigPath();
	await fs.mkdir(path.dirname(configPath), { recursive: true });

	const existing = await readExistingConfig(configPath);
	const nextConfig: OpencodeConfig = {
		...(existing ?? {}),
		$schema: "https://opencode.ai/config.json",
		permission: mergePermissionConfig(existing?.permission),
	};

	await fs.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
	await ensureGlobalDoceCompactionPlugin();
	logger.debug({ configPath }, "Ensured permissive global OpenCode config");
}
