/**
 * Centralized configuration for doce.dev
 * 
 * All environment variables with sensible defaults.
 * No extra configuration required - works out of the box.
 */

import { Context, Effect, Layer, Schema } from "effect";

// ============================================================================
// Config Schema
// ============================================================================

const StringFromEnv = Schema.transform(
	Schema.String,
	Schema.String,
	{
		decode: (input) => input ?? "",
		encode: (output) => output,
	},
);

const NumberFromEnv = Schema.transform(
	Schema.String,
	Schema.Number,
	{
		decode: (input) => {
			if (input === undefined) return 0;
			const parsed = Number.parseInt(input, 10);
			return Number.isFinite(parsed) ? parsed : 0;
		},
		encode: (output) => String(output),
	},
);

const BooleanFromEnv = Schema.transform(
	Schema.String,
	Schema.Boolean,
	{
		decode: (input) => input === "true" || input === "1",
		encode: (output) => String(output),
	},
);

/**
 * Application configuration schema with defaults
 */
export const DoceConfigSchema = Schema.Struct({
	// Database
	DB_FILE_NAME: Schema.String.pipe(
		Schema.optionalWith({ default: () => "data/db.sqlite" }),
	),

	// OpenCode Runtime
	DOCE_OPENCODE_PORT: Schema.NumberFromString.pipe(
		Schema.optionalWith({ default: () => 4096 }),
	),
	OPENCODE_BIN: Schema.String.pipe(
		Schema.optionalWith({ default: () => "opencode" }),
	),

	// Data directories
	DOCE_DATA_DIR: Schema.String.pipe(
		Schema.optionalWith({ default: () => "data" }),
	),
	DOCE_HOST_DATA_DIR: Schema.String.pipe(
		Schema.optionalWith({ default: () => "" }),
	),

	// Docker
	DOCE_NETWORK: Schema.String.pipe(
		Schema.optionalWith({ default: () => "doce-shared" }),
	),

	// Server
	NODE_ENV: Schema.String.pipe(
		Schema.optionalWith({ default: () => "development" }),
	),
	LOG_LEVEL: Schema.String.pipe(
		Schema.optionalWith({ default: () => "" }),
	),
	HOSTNAME: Schema.String.pipe(
		Schema.optionalWith({ default: () => "" }),
	),
	HOST: Schema.String.pipe(
		Schema.optionalWith({ default: () => "" }),
	),
	VERSION: Schema.String.pipe(
		Schema.optionalWith({ default: () => "dev" }),
	),

	// Queue Worker
	QUEUE_CONCURRENCY: Schema.Number.pipe(
		Schema.optionalWith({ default: () => 2 }),
	),
	QUEUE_LEASE_MS: Schema.Number.pipe(
		Schema.optionalWith({ default: () => 60_000 }),
	),
	QUEUE_POLL_MS: Schema.Number.pipe(
		Schema.optionalWith({ default: () => 250 }),
	),
	QUEUE_RETRY_MAX_DELAY_MS: Schema.Number.pipe(
		Schema.optionalWith({ default: () => 60_000 }),
	),
	QUEUE_RETRY_BASE_MS: Schema.Number.pipe(
		Schema.optionalWith({ default: () => 2_000 }),
	),

	// Graceful Shutdown
	SHUTDOWN_TIMEOUT_MS: Schema.Number.pipe(
		Schema.optionalWith({ default: () => 10_000 }),
	),
});

export type DoceConfig = Schema.Schema.Type<typeof DoceConfigSchema>;

// ============================================================================
// Config Service
// ============================================================================

export class ConfigService extends Context.Tag("ConfigService")<
	ConfigService,
	DoceConfig
>() {}

/**
 * Parse configuration from environment variables
 */
function parseConfigFromEnv(): unknown {
	return {
		DB_FILE_NAME: process.env.DB_FILE_NAME,
		DOCE_OPENCODE_PORT: process.env.DOCE_OPENCODE_PORT,
		OPENCODE_BIN: process.env.OPENCODE_BIN,
		DOCE_DATA_DIR: process.env.DOCE_DATA_DIR,
		DOCE_HOST_DATA_DIR: process.env.DOCE_HOST_DATA_DIR,
		DOCE_NETWORK: process.env.DOCE_NETWORK,
		NODE_ENV: process.env.NODE_ENV,
		LOG_LEVEL: process.env.LOG_LEVEL,
		HOSTNAME: process.env.HOSTNAME,
		HOST: process.env.HOST,
		VERSION: process.env.VERSION,
		QUEUE_CONCURRENCY: process.env.QUEUE_CONCURRENCY,
		QUEUE_LEASE_MS: process.env.QUEUE_LEASE_MS,
		QUEUE_POLL_MS: process.env.QUEUE_POLL_MS,
		QUEUE_RETRY_MAX_DELAY_MS: process.env.QUEUE_RETRY_MAX_DELAY_MS,
		QUEUE_RETRY_BASE_MS: process.env.QUEUE_RETRY_BASE_MS,
		SHUTDOWN_TIMEOUT_MS: process.env.SHUTDOWN_TIMEOUT_MS,
	};
}

/**
 * Load and validate configuration
 */
export function loadConfig(): Effect.Effect<DoceConfig, Error> {
	return Effect.gen(function* () {
		const rawConfig = parseConfigFromEnv();
		const result = Schema.decodeUnknownEither(DoceConfigSchema)(rawConfig);

		if (result._tag === "Left") {
			return yield* Effect.fail(
				new Error(`Config validation failed: ${JSON.stringify(result.left)}`),
			);
		}

		return result.right;
	});
}

/**
 * Create a ConfigService layer from the current environment
 */
export function createConfigLayer(): Layer.Layer<ConfigService, Error> {
	const configEffect = loadConfig();
	return Layer.effect(ConfigService, configEffect);
}

/**
 * Get a specific config value from the ConfigService
 */
export function getConfig<K extends keyof DoceConfig>(
	key: K,
): Effect.Effect<DoceConfig[K], never, ConfigService> {
	return Effect.gen(function* () {
		const config = yield* ConfigService;
		return config[key];
	});
}

// ============================================================================
// Legacy compatibility helpers
// These maintain backwards compatibility with existing code
// ============================================================================

let cachedConfig: DoceConfig | null = null;

/**
 * Get the configuration synchronously (for legacy code)
 * Caches the config after first call
 */
export function getConfigSync(): DoceConfig {
	if (!cachedConfig) {
		const result = Effect.runSync(loadConfig());
		cachedConfig = result;
	}
	return cachedConfig;
}

/**
 * Helper to get a specific config value synchronously
 */
export function getConfigValue<K extends keyof DoceConfig>(key: K): DoceConfig[K] {
	return getConfigSync()[key];
}

/**
 * Initialize the config cache
 * Call this early in the application startup
 */
export function initConfig(): void {
	getConfigSync();
}
