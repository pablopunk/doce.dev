import { logger } from "@/server/logger";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";

// Curated list of models for the UI
export const AVAILABLE_MODELS = [
	{
		id: "openai/gpt-5.2",
		name: "GPT-5.2",
		provider: "OpenAI",
		tier: "top",
		description: "top",
	},
	{
		id: "openai/gpt-4.1-mini",
		name: "GPT-4.1 Mini",
		provider: "OpenAI",
		tier: "fast",
		description: "fast",
	},
	{
		id: "anthropic/claude-opus-4.5",
		name: "Claude Opus 4.5",
		provider: "Anthropic",
		tier: "top",
		description: "top",
	},
	{
		id: "anthropic/claude-haiku-4.5",
		name: "Claude Haiku 4.5",
		provider: "Anthropic",
		tier: "fast",
		description: "fast",
	},
	{
		id: "google/gemini-3-pro-preview",
		name: "Gemini 3 Pro",
		provider: "Google",
		tier: "top",
		description: "top",
	},
	{
		id: "google/gemini-2.5-flash",
		name: "Gemini 2.5 Flash",
		provider: "Google",
		tier: "fast",
		description: "fast",
	},
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export const DEFAULT_MODEL: ModelId = "anthropic/claude-haiku-4.5";
export const FAST_MODEL: ModelId = "google/gemini-2.5-flash";

export async function validateOpenRouterApiKey(
	apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
	try {
		const response = await fetch(`${OPENROUTER_API_URL}/models`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		if (response.ok) {
			return { valid: true };
		}

		if (response.status === 401) {
			return { valid: false, error: "Invalid API key" };
		}

		return { valid: false, error: `API returned status ${response.status}` };
	} catch (error) {
		logger.error({ error }, "Failed to validate OpenRouter API key");
		return { valid: false, error: "Failed to connect to OpenRouter" };
	}
}

export async function generateProjectName(
	apiKey: string,
	prompt: string,
): Promise<string> {
	try {
		const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://doce.dev",
				"X-Title": "doce.dev",
			},
			body: JSON.stringify({
				model: FAST_MODEL,
				messages: [
					{
						role: "system",
						content:
							"You are a helpful assistant that generates short, creative project names. Generate a single project name (2-4 words) based on the user's description. Only output the name, nothing else. Use lowercase letters and hyphens only.",
					},
					{
						role: "user",
						content: `Generate a short project name for: ${prompt}`,
					},
				],
				max_tokens: 50,
				stream: false,
			}),
		});

		if (!response.ok) {
			throw new Error(`API returned status ${response.status}`);
		}

		const data = (await response.json()) as {
			choices: Array<{ message: { content: string } }>;
		};
		const name = data.choices[0]?.message?.content?.trim();

		if (name) {
			// Clean up the name: lowercase, replace spaces with hyphens, remove special chars
			return name
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^a-z0-9-]/g, "")
				.slice(0, 50);
		}

		throw new Error("No name generated");
	} catch (error) {
		logger.warn({ error }, "Failed to generate project name, using fallback");
		// Fallback: use first few words of the prompt
		return prompt
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, "")
			.split(/\s+/)
			.slice(0, 3)
			.join("-")
			.slice(0, 50);
	}
}
