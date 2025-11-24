import { LLMConfig } from "@/domain/llms/models/llm-config";
import { createLogger } from "@/lib/logger";
import { getOpencodeServer, syncAuthToOpencode } from "@/lib/opencode";

const logger = createLogger("startup");

let initialized = false;

export async function initializeApp(): Promise<void> {
	if (initialized) {
		return;
	}

	logger.info("Initializing application...");

	try {
		await getOpencodeServer();
		logger.info("✅ OpenCode server started");

		const apiKey = LLMConfig.getApiKey("openrouter");
		if (apiKey) {
			await syncAuthToOpencode("openrouter", apiKey);
			logger.info("✅ API keys synced to OpenCode");
		} else {
			logger.warn("⚠️  No OpenRouter API key configured");
		}

		initialized = true;
		logger.info("✅ Application initialization complete");
	} catch (error) {
		logger.error("❌ Failed to initialize application", error as Error);
		throw error;
	}
}

initializeApp().catch((error) => {
	logger.error("Fatal error during startup", error as Error);
});
