import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { stepCountIs, streamText, tool } from "ai";
import type { APIRoute } from "astro";
import { exec } from "child_process";
import path from "path";
import { promisify } from "util";
import { z } from "zod";
import { generateCode } from "@/lib/code-generator";
import {
	createConversation,
	getConfig,
	getConversation,
	saveMessage,
	updateConversationModel,
	updateMessage,
} from "@/lib/db";
import { listProjectFiles, readProjectFile } from "@/lib/file-system";
import { DEFAULT_AI_MODEL } from "@/shared/config/ai-models";

const execAsync = promisify(exec);

export const maxDuration = 60;

// Helper function to safely execute commands in preview container
async function execInContainer(
	projectId: string,
	command: string,
): Promise<string> {
	const containerName = `doce-preview-${projectId}`;

	// Validate command - block dangerous operations
	// Use word boundaries or specific patterns to avoid false positives
	const isDangerous =
		command.includes("rm -rf /") ||
		/\bdd\b/.test(command) || // 'dd' as standalone word, not in 'add'
		/\bmkfs\b/.test(command) ||
		command.includes(":(){:|:&};:") ||
		command.includes("fork bomb");

	if (isDangerous) {
		throw new Error("Command blocked for security reasons");
	}

	try {
		const { stdout, stderr } = await execAsync(
			`docker exec ${containerName} sh -c "${command.replace(/"/g, '\\"')}"`,
		);
		return stdout || stderr || "Command executed successfully";
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}

// Helper to get API key from database (returns null if not configured)
function getApiKey(provider: string): string | null {
	return getConfig(`${provider}_api_key`);
}

// Helper to get model provider and instance (provider-agnostic)
function getModel(modelId: string) {
	// Extract provider from model ID (e.g., "openai/gpt-4.1-mini" -> "openai")
	const [provider] = modelId.split("/");

	// Try direct provider first for potentially better performance/features
	if (provider === "openai") {
		const apiKey = getApiKey("openai");
		if (apiKey) {
			process.env.OPENAI_API_KEY = apiKey;
			return openai(modelId.replace("openai/", ""));
		}
	}

	if (provider === "anthropic") {
		const apiKey = getApiKey("anthropic");
		if (apiKey) {
			process.env.ANTHROPIC_API_KEY = apiKey;
			return anthropic(modelId.replace("anthropic/", ""));
		}
	}

	// OpenRouter can route to ANY provider (OpenAI, Anthropic, Google, xAI, etc.)
	const openrouterKey = getApiKey("openrouter");
	if (openrouterKey) {
		const openrouter = createOpenRouter({ apiKey: openrouterKey });
		return openrouter(modelId);
	}

	// No API keys configured - provide helpful error
	throw new Error(
		`No API key configured. Please configure at least one: ` +
			`openrouter_api_key (supports 400+ models), ` +
			`${provider}_api_key (direct to ${provider}), or another provider in /setup`,
	);
}

export const POST: APIRoute = async ({ params, request }) => {
	const projectId = params.projectId;
	if (!projectId) {
		return Response.json({ error: "Project id is required" }, { status: 400 });
	}

	const { messages, model: requestedModel } = await request.json();

	let conversation = await getConversation(projectId);
	if (!conversation) {
		conversation = await createConversation(projectId, requestedModel);
	} else if (requestedModel && requestedModel !== conversation.model) {
		// Update model if changed
		await updateConversationModel(conversation.id, requestedModel);
		conversation.model = requestedModel;
	}

	const userMessage = messages[messages.length - 1];
	await saveMessage(conversation.id, "user", userMessage.content);

	const model = getModel(conversation.model || DEFAULT_AI_MODEL);

	// Try to read AGENTS.md from the project
	let agentGuidelines = "";
	try {
		const agentsMd = await readProjectFile(projectId, "AGENTS.md");
		if (agentsMd) {
			agentGuidelines = `\n\n## Project-Specific Guidelines\n\n${agentsMd}`;
		}
	} catch (error) {
		// AGENTS.md doesn't exist yet, use default guidelines
		console.log(`[Chat] No AGENTS.md found for project ${projectId}`);
	}

	// AI SDK supports tool calling for most modern models
	const modelSupportsTools = true;

	const toolDefinitions = {
		readFile: tool({
			description:
				"Read the contents of a file from the project. Use this to inspect existing code before making changes.",
			inputSchema: z.object({
				filePath: z
					.string()
					.describe(
						"Relative path from project root (e.g. 'src/components/Hero.tsx')",
					),
			}),
			execute: async ({ filePath }) => {
				console.log(`[Tool] readFile called with: ${filePath}`);
				try {
					const content = await readProjectFile(projectId, filePath);
					if (!content) {
						console.log(`[Tool] readFile: file not found`);
						return `Error: File not found: ${filePath}`;
					}
					console.log(`[Tool] readFile: success, ${content.length} chars`);
					// Return the content directly with a header showing the file path
					return `File: ${filePath}\n${"=".repeat(50)}\n${content}`;
				} catch (error: any) {
					console.log(`[Tool] readFile error: ${error.message}`);
					return `Error reading ${filePath}: ${error.message}`;
				}
			},
		}),
		listFiles: tool({
			description:
				"List files in the project directory. Returns a tree structure showing the project organization.",
			inputSchema: z.object({}),
			execute: async () => {
				console.log(`[Tool] listFiles called for project ${projectId}`);
				try {
					const allFiles = await listProjectFiles(projectId);
					console.log(`[Tool] listFiles: found ${allFiles.length} files`);

					// Group files by top-level directory and filter out massive node_modules-like directories
					const filesByDir: Record<string, string[]> = {};
					const rootFiles: string[] = [];

					for (const file of allFiles) {
						const parts = file.split("/");
						if (parts.length === 1) {
							rootFiles.push(file);
						} else {
							const topDir = parts[0];
							if (!filesByDir[topDir]) {
								filesByDir[topDir] = [];
							}
							// Only include files from source directories, skip build artifacts
							if (
								!topDir.includes("node_modules") &&
								!topDir.includes(".next") &&
								!topDir.includes("dist")
							) {
								filesByDir[topDir].push(file);
							}
						}
					}

					// Build a concise summary
					const summary: string[] = ["Project Structure:"];
					summary.push(`Root files: ${rootFiles.join(", ")}`);

					for (const [dir, files] of Object.entries(filesByDir)) {
						if (files.length > 50) {
							// For large directories, just show count and some examples
							summary.push(
								`${dir}/ (${files.length} files) - examples: ${files.slice(0, 10).join(", ")}`,
							);
						} else if (files.length > 0) {
							// For smaller directories, show all files
							summary.push(`${dir}/: ${files.join(", ")}`);
						}
					}

					const result = summary.join("\n");
					console.log(
						`[Tool] listFiles: returning summary of ${result.length} chars`,
					);
					console.log(
						`[Tool] listFiles: first 200 chars:`,
						result.substring(0, 200),
					);
					return result;
				} catch (error: any) {
					console.log(`[Tool] listFiles error: ${error.message}`);
					return `Error listing files: ${error.message}`;
				}
			},
		}),
		runCommand: tool({
			description:
				"Execute a command in the preview container. Use this to run npm scripts, tests, linting, or check build errors. The container must be running.",
			inputSchema: z.object({
				command: z
					.string()
					.describe(
						"Shell command to execute (e.g. 'npm run build', 'npm test')",
					),
			}),
			execute: async ({ command }) => {
				console.log(`[Tool] runCommand called: ${command}`);
				try {
					const output = await execInContainer(projectId, command);
					console.log(`[Tool] runCommand: success, ${output.length} chars`);
					return `Command: ${command}\n${"=".repeat(50)}\n${output}`;
				} catch (error: any) {
					console.log(`[Tool] runCommand error: ${error.message}`);
					return `Error executing "${command}": ${error.message}`;
				}
			},
		}),
		fetchUrl: tool({
			description:
				"Fetch content from a URL. Use this to read documentation, API references, or other web resources.",
			inputSchema: z.object({
				url: z.string().url().describe("URL to fetch"),
			}),
			execute: async ({ url }) => {
				console.log(`[Tool] fetchUrl called: ${url}`);
				try {
					// Only allow https URLs and common documentation sites
					if (!url.startsWith("https://")) {
						return `Error: Only HTTPS URLs are allowed`;
					}

					const response = await fetch(url, {
						headers: { "User-Agent": "doce.dev-bot" },
						signal: AbortSignal.timeout(10000), // 10s timeout
					});

					if (!response.ok) {
						return `Error: HTTP ${response.status}: ${response.statusText}`;
					}

					const text = await response.text();
					// Limit response size
					const truncated = text.slice(0, 50000);
					const wasTruncated = text.length > 50000;

					console.log(
						`[Tool] fetchUrl: success, ${truncated.length} chars${wasTruncated ? " (truncated)" : ""}`,
					);
					return `URL: ${url}\n${"=".repeat(50)}\n${truncated}${wasTruncated ? "\n\n[Content truncated at 50,000 characters]" : ""}`;
				} catch (error: any) {
					console.log(`[Tool] fetchUrl error: ${error.message}`);
					return `Error fetching ${url}: ${error.message}`;
				}
			},
		}),
	};

	console.log(`[Chat] Model supports tools: ${modelSupportsTools}`);
	console.log(`[Chat] Tools enabled: ${modelSupportsTools ? "YES" : "NO"}`);
	console.log(`[Chat] Tool names:`, Object.keys(toolDefinitions));

	// Create assistant message immediately for resilience
	let assistantMessageId: string | null = null;
	let lastSavedText = "";
	let saveTimeout: NodeJS.Timeout | null = null;

	// Debounced save function - saves after 500ms of no updates
	const debouncedSave = (text: string) => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		saveTimeout = setTimeout(() => {
			if (assistantMessageId && text !== lastSavedText) {
				updateMessage(assistantMessageId, text);
				lastSavedText = text;
				console.log(
					`[Chat] Auto-saved partial response (${text.length} chars)`,
				);
			}
		}, 500);
	};

	const result = streamText({
		model,
		...(modelSupportsTools && {
			tools: toolDefinitions,
			stopWhen: stepCountIs(10), // Allow up to 10 steps for tool calling
		}),
		onStepFinish: async ({ text, toolCalls, toolResults, finishReason }) => {
			console.log(
				`[Chat] Step finished - text: ${text.length} chars, tools: ${toolCalls.length}, results: ${toolResults.length}, finish: ${finishReason}`,
			);
			if (toolResults.length > 0) {
				console.log(
					`[Chat] Tool results (full):`,
					JSON.stringify(toolResults, null, 2),
				);
			}

			// Save incrementally after each step
			if (!assistantMessageId && text.trim().length > 0) {
				// Create initial message
				const msg = await saveMessage(conversation.id, "assistant", text);
				assistantMessageId = msg.id;
				lastSavedText = text;
				console.log(`[Chat] Created assistant message: ${assistantMessageId}`);
			} else if (assistantMessageId && text !== lastSavedText) {
				// Update existing message with debounce
				debouncedSave(text);
			}
		},
		system: `You are an expert web developer with access to tools for inspecting projects.\n${agentGuidelines}`,
		messages,
		onFinish: async ({ text, finishReason }) => {
			console.log(`[Chat] onFinish called for project ${projectId}`);
			console.log(
				`[Chat] Response length: ${text.length} chars, finish reason: ${finishReason}`,
			);

			// Clear any pending save timeout
			if (saveTimeout) {
				clearTimeout(saveTimeout);
			}

			// Final save
			if (text.trim().length > 0) {
				if (assistantMessageId) {
					// Update the existing message with final content
					updateMessage(assistantMessageId, text);
					console.log(`[Chat] Final update to message ${assistantMessageId}`);
				} else {
					// Fallback: create message if somehow it wasn't created yet
					await saveMessage(conversation.id, "assistant", text);
					console.log(`[Chat] Created message in onFinish (fallback)`);
				}

				try {
					console.log(`[Chat] Attempting to generate code from response...`);
					const generation = await generateCode(projectId, text);
					if (generation) {
						console.log(
							`[Chat] Generated ${generation.files?.length || 0} files for project ${projectId}`,
						);
					} else {
						console.log(`[Chat] No code blocks found in response`);
					}
				} catch (error) {
					console.error("[Chat] Failed to generate code:", error);
				}
			} else {
				console.warn(
					`[Chat] WARNING: Empty response from model, not saving. This may indicate a tool calling issue.`,
				);
			}
		},
	});

	// For tool calls, we need to return the full result including tool outputs
	// toTextStreamResponse() only returns text, not tool results
	return result.toUIMessageStreamResponse();
};
