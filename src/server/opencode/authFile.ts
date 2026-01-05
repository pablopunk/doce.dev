import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { getOpencodePath } from "@/server/projects/paths";

export interface ProviderConfig {
	id: string;
	apiKey: string;
}

export async function ensureAuthDirectory(): Promise<void> {
	const opencodeDir = path.join(process.cwd(), "data", "opencode");
	await fs.mkdir(opencodeDir, { recursive: true });
	logger.debug({ opencodeDir }, "Ensured auth directory exists");
}

export async function listConnectedProviderIds(): Promise<string[]> {
	const authJsonPath = getOpencodePath();

	try {
		const content = await fs.readFile(authJsonPath, "utf-8");
		const config = JSON.parse(content) as Record<string, { apiKey: string }>;
		const providerIds = Object.keys(config).filter(
			(key) => config[key]?.apiKey,
		);
		logger.debug({ providerIds }, "Listed connected providers");
		return providerIds;
	} catch {
		logger.debug("No auth file found, returning no connected providers");
		return [];
	}
}

export async function setApiKey(
	providerId: string,
	apiKey: string,
): Promise<void> {
	await ensureAuthDirectory();

	const authJsonPath = getOpencodePath();
	let config: Record<string, { apiKey: string }> = {};

	try {
		const content = await fs.readFile(authJsonPath, "utf-8");
		config = JSON.parse(content) as Record<string, { apiKey: string }>;
	} catch {
		logger.debug("No existing auth file, creating new one");
	}

	config[providerId] = { apiKey };

	await fs.writeFile(authJsonPath, JSON.stringify(config, null, 2));
	logger.debug({ providerId }, "Set API key for provider");
}

export async function removeProvider(providerId: string): Promise<void> {
	const authJsonPath = getOpencodePath();

	try {
		const content = await fs.readFile(authJsonPath, "utf-8");
		const config = JSON.parse(content) as Record<string, { apiKey: string }>;
		delete config[providerId];
		await fs.writeFile(authJsonPath, JSON.stringify(config, null, 2));
		logger.debug({ providerId }, "Removed provider");
	} catch {
		logger.debug("No existing auth file");
	}
}
