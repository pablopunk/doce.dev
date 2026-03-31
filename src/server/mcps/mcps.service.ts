/**
 * MCPs service — reads/writes the `mcp` key in the global OpenCode config.
 * OpenCode's opencode.json is the source of truth (no DB).
 */

import * as fs from "node:fs/promises";
import { logger } from "@/server/logger";
import { getGlobalOpencodeConfigPath } from "@/server/projects/paths";

export interface McpServerConfig {
	type: "remote" | "local";
	url?: string;
	command?: string[];
	enabled?: boolean;
	environment?: Record<string, string>;
	headers?: Record<string, string>;
	timeout?: number;
}

type OpencodeConfig = Record<string, unknown>;

async function readOpencodeConfig(): Promise<OpencodeConfig> {
	const configPath = getGlobalOpencodeConfigPath();
	try {
		const content = await fs.readFile(configPath, "utf-8");
		const parsed = JSON.parse(content) as unknown;
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
		) {
			return parsed as OpencodeConfig;
		}
		return {};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {};
		}
		logger.warn({ error }, "[MCPs] Failed to read OpenCode config");
		return {};
	}
}

async function writeOpencodeConfig(config: OpencodeConfig): Promise<void> {
	const configPath = getGlobalOpencodeConfigPath();
	await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function getMcpBlock(config: OpencodeConfig): Record<string, McpServerConfig> {
	const mcp = config.mcp;
	if (typeof mcp === "object" && mcp !== null && !Array.isArray(mcp)) {
		return mcp as Record<string, McpServerConfig>;
	}
	return {};
}

export async function listMcpServers(): Promise<
	Record<string, McpServerConfig>
> {
	const config = await readOpencodeConfig();
	return getMcpBlock(config);
}

export async function addMcpServer(
	name: string,
	serverConfig: McpServerConfig,
): Promise<void> {
	const config = await readOpencodeConfig();
	const mcpBlock = getMcpBlock(config);
	mcpBlock[name] = serverConfig;
	config.mcp = mcpBlock;
	await writeOpencodeConfig(config);
	logger.info({ name, type: serverConfig.type }, "[MCPs] Added MCP server");
}

export async function removeMcpServer(name: string): Promise<void> {
	const config = await readOpencodeConfig();
	const mcpBlock = getMcpBlock(config);

	if (!(name in mcpBlock)) {
		logger.warn({ name }, "[MCPs] Server not found for removal");
		return;
	}

	delete mcpBlock[name];
	config.mcp = mcpBlock;
	await writeOpencodeConfig(config);
	logger.info({ name }, "[MCPs] Removed MCP server");
}

export async function toggleMcpServer(
	name: string,
	enabled: boolean,
): Promise<void> {
	const config = await readOpencodeConfig();
	const mcpBlock = getMcpBlock(config);

	if (!(name in mcpBlock)) {
		logger.warn({ name }, "[MCPs] Server not found for toggle");
		return;
	}

	mcpBlock[name].enabled = enabled;
	config.mcp = mcpBlock;
	await writeOpencodeConfig(config);
	logger.info({ name, enabled }, "[MCPs] Toggled MCP server");
}
