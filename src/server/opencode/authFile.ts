import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Effect } from "effect";
import { AuthFileError } from "@/server/effect/errors";
import { logger } from "@/server/logger";
import { getDataPath, getOpencodePath } from "@/server/projects/paths";

export interface ProviderConfig {
	id: string;
	type: string;
	key: string;
}

export async function ensureAuthDirectory(): Promise<void> {
	const effect = Effect.tryPromise({
		try: async () => {
			const opencodeDir = path.join(getDataPath(), "opencode");
			await fs.mkdir(opencodeDir, { recursive: true });
			logger.debug({ opencodeDir }, "Ensured auth directory exists");
		},
		catch: (error) =>
			new AuthFileError({
				operation: "write",
				path: path.join(getDataPath(), "opencode"),
				message: "Failed to create auth directory",
				cause: error,
			}),
	});

	return Effect.runPromise(effect);
}

export async function listConnectedProviderIds(): Promise<string[]> {
	const effect = Effect.tryPromise({
		try: async () => {
			const authJsonPath = getOpencodePath();
			const content = await fs.readFile(authJsonPath, "utf-8");
			const config = JSON.parse(content) as Record<
				string,
				{ type: string; key: string }
			>;
			const providerIds = Object.keys(config).filter((key) => config[key]?.key);
			return providerIds;
		},
		catch: (error) =>
			new AuthFileError({
				operation: "read",
				path: getOpencodePath(),
				message: "Failed to list connected providers",
				cause: error,
			}),
	});

	const result = await Effect.runPromise(Effect.either(effect));

	if (result._tag === "Left") {
		logger.debug("No auth file found, returning no connected providers");
		return [];
	}

	return result.right;
}

export async function getApiKey(providerId: string): Promise<string | null> {
	const effect = Effect.tryPromise({
		try: async () => {
			const authJsonPath = getOpencodePath();
			const content = await fs.readFile(authJsonPath, "utf-8");
			const config = JSON.parse(content) as Record<
				string,
				{ type: string; key: string }
			>;
			const providerConfig = config[providerId];
			if (providerConfig?.key) {
				logger.debug({ providerId }, "Retrieved API key for provider");
				return providerConfig.key;
			}
			logger.debug({ providerId }, "No API key found for provider");
			return null;
		},
		catch: (error) =>
			new AuthFileError({
				operation: "read",
				path: getOpencodePath(),
				message: `Failed to get API key for provider ${providerId}`,
				cause: error,
			}),
	});

	const result = await Effect.runPromise(Effect.either(effect));

	if (result._tag === "Left") {
		logger.debug("No auth file found");
		return null;
	}

	return result.right;
}

export async function setApiKey(
	providerId: string,
	apiKey: string,
): Promise<void> {
	const effect = Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => ensureAuthDirectory(),
			catch: (error) =>
				new AuthFileError({
					operation: "write",
					path: path.join(getDataPath(), "opencode"),
					message: "Failed to ensure auth directory",
					cause: error,
				}),
		});

		const authJsonPath = getOpencodePath();
		let config: Record<string, { type: string; key: string }> = {};

		const readResult = yield* Effect.either(
			Effect.tryPromise({
				try: async () => {
					const content = await fs.readFile(authJsonPath, "utf-8");
					return JSON.parse(content) as Record<
						string,
						{ type: string; key: string }
					>;
				},
				catch: (error) =>
					new AuthFileError({
						operation: "read",
						path: authJsonPath,
						message: "Failed to read existing auth file",
						cause: error,
					}),
			}),
		);

		if (readResult._tag === "Right") {
			config = readResult.right;
		} else {
			logger.debug("No existing auth file, creating new one");
		}

		config[providerId] = { type: "api", key: apiKey };

		yield* Effect.tryPromise({
			try: () => fs.writeFile(authJsonPath, JSON.stringify(config, null, 2)),
			catch: (error) =>
				new AuthFileError({
					operation: "write",
					path: authJsonPath,
					message: `Failed to write API key for provider ${providerId}`,
					cause: error,
				}),
		});

		logger.debug({ providerId }, "Set API key for provider");
	});

	return Effect.runPromise(effect);
}

export async function removeProvider(providerId: string): Promise<void> {
	const effect = Effect.gen(function* () {
		const authJsonPath = getOpencodePath();

		const readResult = yield* Effect.either(
			Effect.tryPromise({
				try: async () => {
					const content = await fs.readFile(authJsonPath, "utf-8");
					return JSON.parse(content) as Record<
						string,
						{ type: string; key: string }
					>;
				},
				catch: (error) =>
					new AuthFileError({
						operation: "read",
						path: authJsonPath,
						message: "Failed to read auth file for provider removal",
						cause: error,
					}),
			}),
		);

		if (readResult._tag === "Left") {
			logger.debug("No existing auth file");
			return;
		}

		const config = readResult.right;
		delete config[providerId];

		yield* Effect.tryPromise({
			try: () => fs.writeFile(authJsonPath, JSON.stringify(config, null, 2)),
			catch: (error) =>
				new AuthFileError({
					operation: "write",
					path: authJsonPath,
					message: `Failed to remove provider ${providerId}`,
					cause: error,
				}),
		});

		logger.debug({ providerId }, "Removed provider");
	});

	return Effect.runPromise(effect);
}
