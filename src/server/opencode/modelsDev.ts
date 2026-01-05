import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getOrSet } from "@/server/cache/memory";
import { logger } from "@/server/logger";

const CACHE_FILE_PATH = path.join(
	process.cwd(),
	"data",
	"opencode",
	"models.dev.json",
);
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDERS_CACHE_KEY = "cache:v1:fn:modelsDev.providersIndex:{}";
const MODELS_CACHE_KEY = "cache:v1:fn:modelsDev.modelsIndex:{}";

interface ModelsDevProvider {
	id: string;
	name: string;
	env: string[];
}

interface ModelsDevModelCost {
	input?: number;
	output?: number;
	cache_read?: number;
	cache_write?: number;
}

interface ModelsDevModelLimit {
	context?: number;
	output?: number;
}

export interface ModelsDevModel {
	id: string;
	name: string;
	modalities: {
		input: string[];
		output: string[];
	};
	cost: ModelsDevModelCost;
	limit: ModelsDevModelLimit;
}

type RawModelRecord = Record<
	string,
	{
		id: string;
		name: string;
		modalities: { input: string[]; output: string[] };
		cost: ModelsDevModelCost;
		limit: ModelsDevModelLimit;
	}
>;

type RawProviderRecord = Record<
	string,
	{
		id: string;
		name: string;
		env?: string[];
		models?: RawModelRecord;
	}
>;

export async function getProvidersIndex(): Promise<ModelsDevProvider[]> {
	return getOrSet(PROVIDERS_CACHE_KEY, { ttlMs: CACHE_TTL_MS }, async () => {
		try {
			return await fetchProvidersFromRemote();
		} catch (fetchError) {
			logger.error(
				{
					error:
						fetchError instanceof Error
							? fetchError.message
							: String(fetchError),
				},
				"Failed to fetch Models.dev, falling back to disk",
			);
			try {
				return await readProvidersFromDisk();
			} catch {
				return [];
			}
		}
	});
}

async function readProvidersFromDisk(): Promise<ModelsDevProvider[]> {
	const file = await fs.readFile(CACHE_FILE_PATH, "utf-8");
	const data = JSON.parse(file) as RawProviderRecord;
	const providers = normalizeProviders(data);
	logger.debug(
		{ count: providers.length },
		"Loaded Models.dev providers from cache",
	);
	return providers;
}

async function fetchProvidersFromRemote(): Promise<ModelsDevProvider[]> {
	const response = await fetch("https://models.dev/api.json", {
		headers: {
			"User-Agent": "doce.dev",
		},
		signal: AbortSignal.timeout(10 * 1000),
	});

	if (!response.ok) {
		throw new Error(`Models.dev responded with ${response.status}`);
	}

	const data = (await response.json()) as RawProviderRecord;
	const providers = normalizeProviders(data);

	await fs.mkdir(path.dirname(CACHE_FILE_PATH), { recursive: true });
	await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");

	logger.info(
		{ count: providers.length },
		"Fetched and cached Models.dev providers",
	);
	return providers;
}

function normalizeProviders(data: RawProviderRecord): ModelsDevProvider[] {
	return Object.values(data).map((provider) => ({
		id: provider.id,
		name: provider.name,
		env: provider.env ?? [],
	}));
}

export async function getModelsIndex(): Promise<
	Record<string, ModelsDevModel[]>
> {
	return getOrSet(MODELS_CACHE_KEY, { ttlMs: CACHE_TTL_MS }, async () => {
		try {
			return await fetchModelsFromRemote();
		} catch (fetchError) {
			logger.error(
				{
					error:
						fetchError instanceof Error
							? fetchError.message
							: String(fetchError),
				},
				"Failed to fetch models from Models.dev, falling back to disk",
			);
			try {
				return await readModelsFromDisk();
			} catch {
				return {};
			}
		}
	});
}

async function readModelsFromDisk(): Promise<Record<string, ModelsDevModel[]>> {
	const file = await fs.readFile(CACHE_FILE_PATH, "utf-8");
	const data = JSON.parse(file) as RawProviderRecord;
	const models = normalizeModels(data);
	logger.debug(
		{ providerCount: Object.keys(models).length },
		"Loaded models from cache",
	);
	return models;
}

async function fetchModelsFromRemote(): Promise<
	Record<string, ModelsDevModel[]>
> {
	const response = await fetch("https://models.dev/api.json", {
		headers: {
			"User-Agent": "doce.dev",
		},
		signal: AbortSignal.timeout(10 * 1000),
	});

	if (!response.ok) {
		throw new Error(`Models.dev responded with ${response.status}`);
	}

	const data = (await response.json()) as RawProviderRecord;
	const models = normalizeModels(data);

	logger.info(
		{ providerCount: Object.keys(models).length },
		"Fetched models from Models.dev",
	);
	return models;
}

function normalizeModels(
	data: RawProviderRecord,
): Record<string, ModelsDevModel[]> {
	const result: Record<string, ModelsDevModel[]> = {};

	for (const provider of Object.values(data)) {
		if (provider.models) {
			result[provider.id] = Object.values(provider.models).map((model) => ({
				id: model.id,
				name: model.name,
				modalities: model.modalities,
				cost: model.cost,
				limit: model.limit,
			}));
		}
	}

	return result;
}

export async function getModelById(
	modelId: string,
): Promise<ModelsDevModel | null> {
	const allModels = await getModelsIndex();

	for (const models of Object.values(allModels)) {
		const model = models.find((m) => m.id === modelId);
		if (model) {
			return model;
		}
	}

	return null;
}

export type ModelsDevProviderExport = ModelsDevProvider;
