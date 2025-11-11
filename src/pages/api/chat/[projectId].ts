import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { stepCountIs, streamText, tool } from "ai";
import type { APIRoute } from "astro";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { generateCode } from "@/lib/code-generator";
import {
	createConversation,
	getConfig,
	getConversation,
	getMessages,
	saveMessage,
	updateConversationModel,
	updateMessage,
} from "@/lib/db";
import { listProjectFiles, readProjectFile } from "@/lib/file-system";
import { chatEvents } from "@/lib/chat-events";
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
	const value = getConfig(`${provider}_api_key`);
	return value || null;
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

	// Track if client disconnects (stop button clicked)
	let clientAborted = false;
	request.signal.addEventListener("abort", () => {
		console.log(`[Chat] Client aborted request for project ${projectId}`);
		clientAborted = true;
	});

	let conversation = await getConversation(projectId);
	if (!conversation) {
		conversation = createConversation(projectId, requestedModel);
	} else if (requestedModel && requestedModel !== conversation.model) {
		// Update model if changed
		await updateConversationModel(conversation.id, requestedModel);
		conversation.model = requestedModel;
	}

	const userMessage = messages[messages.length - 1];

	// Check if this exact user message already exists (prevent duplicates)
	const existingMessages = getMessages(conversation.id);
	const lastUserMessage = existingMessages
		.filter((msg: any) => msg.role === "user")
		.pop();

	const isDuplicate =
		lastUserMessage && lastUserMessage.content === userMessage.content;

	if (!isDuplicate) {
		saveMessage(conversation.id, "user", userMessage.content);
		console.log("[Chat] Saved new user message");
	} else {
		console.log(
			"[Chat] User message already exists (duplicate detected), skipping save",
		);
	}

	// Check if there's a stuck streaming message and mark it as error
	const stuckStreamingMessage = existingMessages.find(
		(msg: any) =>
			msg.role === "assistant" &&
			msg.streaming_status === "streaming" &&
			new Date(msg.created_at).getTime() < Date.now() - 30000, // Stuck for >30s
	);
	if (stuckStreamingMessage) {
		console.log(
			`[Chat] Found stuck streaming message ${stuckStreamingMessage.id}, marking as error`,
		);
		updateMessage(
			stuckStreamingMessage.id,
			"Error: Previous response timed out",
			"error",
		);
		chatEvents.notifyMessageUpdate(projectId, conversation.id);
	}

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

	// Create assistant message immediately for resilience - backend-first approach
	let assistantMessageId: string | null = null;
	let lastSavedText = "";
	let lastSaveTime = 0;
	const SAVE_INTERVAL_MS = 300; // Save every 300ms during streaming

	// Track full message content including tool calls (mirroring frontend behavior)
	let fullMessageContent = "";
	let lastEventWasToolResult = false;

	// Immediate save function - saves to DB and emits event for SSE
	const saveToDatabase = (
		text: string,
		status: "streaming" | "complete" | "error",
	) => {
		const now = Date.now();
		const timeSinceLastSave = now - lastSaveTime;

		// Skip save if text hasn't changed
		if (text === lastSavedText) return;

		// Throttle saves during streaming (but always save on complete/error)
		if (status === "streaming" && timeSinceLastSave < SAVE_INTERVAL_MS) {
			return;
		}

		if (assistantMessageId) {
			updateMessage(assistantMessageId, text, status);
			lastSavedText = text;
			lastSaveTime = now;
			console.log(
				`[Chat] Saved to DB: ${text.length} chars, status: ${status}`,
			);

			// Emit event to notify SSE listeners (no polling!)
			chatEvents.notifyMessageUpdate(projectId, conversation.id);
		}
	};

	// Create assistant message immediately in DB with streaming status
	const initialMsg = await saveMessage(
		conversation.id,
		"assistant",
		"",
		"streaming",
	);
	assistantMessageId = initialMsg.id;
	console.log(
		`[Chat] Created streaming assistant message: ${assistantMessageId}`,
	);

	console.log(
		`[Chat] Starting AI stream with model ${conversation.model || DEFAULT_AI_MODEL}`,
	);
	console.log(
		`[Chat] Message count: ${messages.length}, last message: "${messages[messages.length - 1]?.content?.substring(0, 50)}..."`,
	);

	let result;
	try {
		result = streamText({
			model,
			...(modelSupportsTools && {
				tools: toolDefinitions,
				stopWhen: stepCountIs(10), // Allow up to 10 steps for tool calling
				maxSteps: 10, // Explicit max steps
			}),
			onStepFinish: async ({ text, toolCalls, toolResults, finishReason }) => {
				console.log(
					`[Chat] Step finished - text: ${text.length} chars, tools: ${toolCalls.length}, results: ${toolResults.length}, finish: ${finishReason}`,
				);

				// Build full message content including tool calls (same format as frontend)
				// Add tool calls
				for (const toolCall of toolCalls) {
					const toolMessage = `\n\n🔧 **Using tool: ${toolCall.toolName}**\n\`\`\`json\n${JSON.stringify(toolCall.args, null, 2)}\n\`\`\`\n`;
					fullMessageContent += toolMessage;
				}

				// Add tool results
				for (const toolResult of toolResults) {
					const resultMessage = `\n📋 **Result from ${toolResult.toolName}:**\n\`\`\`json\n${JSON.stringify(toolResult.result, null, 2)}\n\`\`\`\n`;
					fullMessageContent += resultMessage;
					lastEventWasToolResult = true;
				}

				// Add spacing before text if we just had tool results
				if (text.trim().length > 0) {
					if (lastEventWasToolResult) {
						fullMessageContent += "\n\n";
						lastEventWasToolResult = false;
					}
					fullMessageContent += text;
				}

				// Save full content to database with streaming status
				saveToDatabase(fullMessageContent, "streaming");

				if (toolResults.length > 0) {
					console.log(
						`[Chat] Tool results (full):`,
						JSON.stringify(toolResults, null, 2),
					);
				}

				// Warning: If finish reason is tool-calls and no text, we have a problem
				if (
					finishReason === "tool-calls" &&
					text.trim().length === 0 &&
					toolCalls.length > 0
				) {
					console.warn(
						`[Chat] WARNING: Step ended with tool-calls but no text generated. This will result in empty response.`,
					);
					console.warn(
						`[Chat] Tool calls: ${toolCalls.map((t) => t.toolName).join(", ")}`,
					);
				}
			},
			system: `You are an expert web developer building Astro applications.

CRITICAL RULES:
1. ALWAYS generate code in fenced blocks with file="path" attribute
2. ALWAYS close code blocks with \`\`\` - incomplete code blocks will fail to save
3. If a tool fails, communicate it to the user
4. Complete ALL files before finishing - don't stop mid-file

Available tools: readFile (inspect existing code), listFiles (see structure), runCommand (run shell commands), fetchUrl (get external website content, like docs)

AGENTS.md guidelines. These are the guidelines for the new project:

${agentGuidelines}`,
			messages,
			onFinish: async ({ text, finishReason }) => {
				console.log(`[Chat] onFinish called for project ${projectId}`);
				console.log(
					`[Chat] Response length: ${text.length} chars, finish reason: ${finishReason}`,
				);
				console.log(
					`[Chat] Full message content length: ${fullMessageContent.length} chars`,
				);

				// Check if client aborted
				if (clientAborted) {
					console.log(`[Chat] Client aborted, marking message as stopped`);
					if (assistantMessageId && fullMessageContent.trim().length > 0) {
						updateMessage(
							assistantMessageId,
							fullMessageContent + "\n\n_[Generation stopped by user]_",
							"complete",
						);
						chatEvents.notifyMessageUpdate(projectId, conversation.id);
					}
					return;
				}

				// Use fullMessageContent which includes tool calls, not just text
				const finalContent =
					fullMessageContent.trim().length > 0 ? fullMessageContent : text;

				// Final save to DB with complete status
				if (finalContent.trim().length > 0) {
					if (assistantMessageId) {
						// Mark message as complete in database with full content
						updateMessage(assistantMessageId, finalContent, "complete");
						console.log(
							`[Chat] Marked message ${assistantMessageId} as complete with ${finalContent.length} chars`,
						);

						// Emit final update
						chatEvents.notifyMessageUpdate(projectId, conversation.id);
					} else {
						// Fallback: create message if somehow it wasn't created yet
						saveMessage(conversation.id, "assistant", finalContent, "complete");
						console.log(`[Chat] Created message in onFinish (fallback)`);

						// Emit final update
						chatEvents.notifyMessageUpdate(projectId, conversation.id);
					}

					try {
						console.log(`[Chat] Attempting to generate code from response...`);
						// Still use 'text' for code generation (without tool metadata)
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
						`[Chat] WARNING: Empty response from model, marking as error`,
					);
					if (assistantMessageId) {
						updateMessage(
							assistantMessageId,
							"Error: Empty response from model",
							"error",
						);

						// Emit error update
						chatEvents.notifyMessageUpdate(projectId, conversation.id);
					}
				}
			},
		});

		console.log(`[Chat] streamText created successfully, returning response`);
	} catch (error) {
		console.error(`[Chat] FATAL ERROR creating streamText:`, error);
		if (assistantMessageId) {
			updateMessage(assistantMessageId, `Error: ${error}`, "error");
			chatEvents.notifyMessageUpdate(projectId, conversation.id);
		}
		return new Response(
			JSON.stringify({ error: "Failed to start AI stream" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Backend-first: We save everything to DB during streaming
	// Frontend subscribes to SSE endpoint for updates
	// But we still stream the response for backwards compatibility and to keep connection alive
	return result.toUIMessageStreamResponse();
};
