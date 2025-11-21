import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { stepCountIs, streamText, tool } from "ai";
import type { APIRoute } from "astro";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { generateCode } from "@/domain/projects/lib/code-generator";
import { Conversation } from "@/domain/conversations/models/conversation";
import { LLMConfig } from "@/domain/llms/models/llm-config";
import { getTemplateById } from "@/domain/projects/lib/template-metadata";
import {
	buildBootstrapPlan,
	formatBootstrapPlanForSystem,
} from "@/domain/projects/lib/bootstrap-plan";
import { projects as projectsTable } from "@/lib/db";
import type { ProjectInDatabase } from "@/lib/db";

import {
	listProjectFiles,
	readProjectFile,
	writeProjectFile,
} from "@/lib/file-system";
import { chatEvents } from "@/domain/conversations/lib/events";
import { DEFAULT_AI_MODEL } from "@/domain/llms/models/ai-models";
import { createLogger } from "@/lib/logger";

const logger = createLogger("chat-api");

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

import type { AIProvider } from "@/domain/llms/models/llm-config";

// Helper to get API key from database (returns null if not configured)
function getApiKey(provider: AIProvider): string | null {
	return LLMConfig.getApiKey(provider);
}

// Helper to get model provider and instance (OpenRouter only)
function getModel(modelId: string) {
	// OpenRouter can route to ANY provider (OpenAI, Anthropic, Google, xAI, etc.)
	const openrouterKey = LLMConfig.getApiKey("openrouter");
	if (openrouterKey) {
		const openrouter = createOpenRouter({ apiKey: openrouterKey });
		return openrouter(modelId);
	}

	// No API key configured - provide helpful error
	throw new Error(
		`No OpenRouter API key configured. Please configure your OpenRouter API key in /settings. ` +
			`OpenRouter supports 400+ models from all providers.`,
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
		logger.info(`Client aborted request for project ${projectId}`);
		clientAborted = true;
	});

	let conversation = Conversation.getByProjectId(projectId);
	if (!conversation) {
		conversation = Conversation.create(projectId, requestedModel);
	} else if (requestedModel && requestedModel !== conversation.model) {
		// Update model if changed
		conversation = Conversation.updateModel(conversation.id, requestedModel);
	}

	// TypeScript assertion: conversation is guaranteed to be defined after the above check
	if (!conversation) {
		throw new Error("Failed to create or retrieve conversation");
	}

	const userMessage = messages[messages.length - 1];

	// Check if this exact user message already exists (prevent duplicates)
	// Use Conversation model to access messages
	const existingMessages = Conversation.getHistory(projectId).messages;
	const lastUserMessage = existingMessages
		.filter((msg: any) => msg.role === "user")
		.pop();

	const isDuplicate =
		lastUserMessage && lastUserMessage.content === userMessage.content;

	if (!isDuplicate) {
		Conversation.saveMessage(conversation.id, "user", userMessage.content);
		logger.debug("Saved new user message");
	} else {
		logger.debug(
			"User message already exists (duplicate detected), skipping save",
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
		logger.warn(
			`Found stuck streaming message ${stuckStreamingMessage.id}, marking as error`,
		);
		Conversation.updateMessage(
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
		logger.debug(`No AGENTS.md found for project ${projectId}`);
	}

	// Try to build a bootstrap plan using the stored templateId
	let bootstrapPlanText = "";
	try {
		// Lightweight direct query via Drizzle to avoid circular imports
		const project = projectsTable.getById(projectId) as
			| (ProjectInDatabase & { templateId?: string | null })
			| null;

		if (project?.templateId) {
			const template = getTemplateById(project.templateId);
			if (template) {
				const plan = buildBootstrapPlan(
					template,
					project.name,
					userMessage.content,
				);
				bootstrapPlanText = `\n\n## Bootstrap Plan\n\n${formatBootstrapPlanForSystem(plan)}`;
			}
		}
	} catch (error) {
		logger.warn("Failed to build bootstrap plan", {
			error: error instanceof Error ? error.message : String(error),
		});
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
				logger.debug(`readFile called with: ${filePath}`);
				try {
					const content = await readProjectFile(projectId, filePath);
					if (!content) {
						logger.debug(`readFile: file not found`);
						return `Error: File not found: ${filePath}`;
					}
					logger.debug(`readFile: success, ${content.length} chars`);
					// Return the content directly with a header showing the file path
					return `File: ${filePath}\n${"".padEnd(50, "=")}\n${content}`;
				} catch (error: any) {
					logger.error(`readFile error`, error);
					return `Error reading ${filePath}: ${error.message}`;
				}
			},
		}),
		writeFile: tool({
			description:
				"Write content to a file in the project. Creates the file and any necessary parent directories. Use this to create new files or update existing ones.",
			inputSchema: z.object({
				filePath: z
					.string()
					.describe(
						"Relative path from project root (e.g. 'src/components/Hero.tsx')",
					),
				content: z.string().describe("The complete file content to write"),
			}),
			execute: async ({ filePath, content }) => {
				logger.debug(`writeFile called: ${filePath}`);
				try {
					await writeProjectFile(projectId, filePath, content);
					logger.debug(
						`writeFile: success, wrote ${content.length} chars to ${filePath}`,
					);
					return `Successfully wrote ${content.length} characters to ${filePath}`;
				} catch (error: any) {
					logger.error(`writeFile error`, error);
					return `Error writing ${filePath}: ${error.message}`;
				}
			},
		}),
		listFiles: tool({
			description:
				"List files in the project directory. Returns a tree structure showing the project organization.",
			inputSchema: z.object({}),
			execute: async () => {
				logger.debug(`listFiles called for project ${projectId}`);
				try {
					const allFiles = await listProjectFiles(projectId);
					logger.debug(`listFiles: found ${allFiles.length} files`);

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
								`${dir}/ (${files.length} files) - examples: ${files
									.slice(0, 10)
									.join(", ")}`,
							);
						} else if (files.length > 0) {
							// For smaller directories, show all files
							summary.push(`${dir}/: ${files.join(", ")}`);
						}
					}

					const result = summary.join("\n");
					logger.debug(
						`listFiles: returning summary of ${result.length} chars`,
					);
					logger.debug(
						`listFiles: first 200 chars: ${result.substring(0, 200)}`,
					);
					return result;
				} catch (error: any) {
					logger.error(`listFiles error`, error);
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
				logger.debug(`runCommand called: ${command}`);
				try {
					const output = await execInContainer(projectId, command);
					logger.debug(`runCommand: success, ${output.length} chars`);
					return `Command: ${command}\n${"".padEnd(50, "=")}\n${output}`;
				} catch (error: any) {
					logger.error(`runCommand error`, error);
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
				logger.debug(`fetchUrl called: ${url}`);
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

					logger.debug(
						`fetchUrl: success, ${truncated.length} chars${wasTruncated ? " (truncated)" : ""}`,
					);
					return `URL: ${url}\n${"".padEnd(50, "=")}\n${truncated}${wasTruncated ? "\n\n[Content truncated at 50,000 characters]" : ""}`;
				} catch (error: any) {
					logger.error(`fetchUrl error`, error);
					return `Error fetching ${url}: ${error.message}`;
				}
			},
		}),
	};

	logger.debug(`Model supports tools: ${modelSupportsTools}`);
	logger.debug(`Tools enabled: ${modelSupportsTools ? "YES" : "NO"}`);
	logger.debug(`Tool names: ${Object.keys(toolDefinitions).join(", ")}`);

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
			Conversation.updateMessage(assistantMessageId!, text, status);
			lastSavedText = text;
			lastSaveTime = now;
			logger.debug(`Saved to DB: ${text.length} chars, status: ${status}`);

			// Emit event to notify SSE listeners (no polling!)
			chatEvents.notifyMessageUpdate(projectId, conversation.id);
		}
	};

	// Create assistant message immediately in DB with streaming status
	const initialMsg = Conversation.saveMessage(
		conversation.id,
		"assistant",
		"",
		"streaming",
	);
	assistantMessageId = initialMsg?.id ?? null;
	logger.debug(`Created streaming assistant message: ${assistantMessageId}`);

	logger.info(
		`Starting AI stream with model ${conversation.model || DEFAULT_AI_MODEL}`,
	);
	logger.debug(
		`Message count: ${messages.length}, last message: "${messages[messages.length - 1]?.content?.substring(0, 50)}..."`,
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
				logger.debug(
					`Step finished - text: ${text.length} chars, tools: ${toolCalls.length}, results: ${toolResults.length}, finish: ${finishReason}`,
				);

				// Build full message content including tool calls (same format as frontend)
				// Add tool calls
				for (const toolCall of toolCalls) {
					const toolMessage = `\n\n🔧 **Using tool: ${toolCall.toolName}**\n\`\`\`json\n${JSON.stringify((toolCall as any).args, null, 2)}\n\`\`\`\n`;
					fullMessageContent += toolMessage;
				}

				// Add tool results
				for (const toolResult of toolResults) {
					const resultMessage = `\n📋 **Result from ${toolResult.toolName}:**\n\`\`\`json\n${JSON.stringify((toolResult as any).result, null, 2)}\n\`\`\`\n`;
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
					logger.debug(
						`Tool results (full): ${JSON.stringify(toolResults, null, 2)}`,
					);
				}

				// Warning: If finish reason is tool-calls and no text, we have a problem
				if (
					finishReason === "tool-calls" &&
					text.trim().length === 0 &&
					toolCalls.length > 0
				) {
					logger.warn(
						`Step ended with tool-calls but no text generated. This will result in empty response.`,
					);
					logger.warn(
						`Tool calls: ${toolCalls.map((t) => t.toolName).join(", ")}`,
					);
				}
			},
			// NOTE: bootstrapPlanText is appended after AGENTS.md guidelines
			system: `You are an expert web developer building Astro applications.

CRITICAL RULES:
1. Use the writeFile tool to create or modify files in the project
2. ALWAYS write complete, valid file contents - no placeholders or truncated code
3. Read existing files with readFile before modifying them to understand the current structure
4. If a tool fails, communicate it to the user and try an alternative approach
5. Complete ALL files before finishing - don't stop mid-file

Available tools:
- readFile: inspect existing code in a file
- writeFile: create or update a file with new content
- listFiles: see the project directory structure
- runCommand: execute shell commands (npm install, build, test, etc.)
- fetchUrl: fetch external documentation or resources

Workflow for modifying code:
1. Use listFiles to understand the project structure
2. Use readFile to inspect files you need to modify
3. Use writeFile to create or update files with your changes
4. Use runCommand to install dependencies, run builds, or test changes

AGENTS.md guidelines. These are the guidelines for the new project:

${agentGuidelines}${bootstrapPlanText}`,
			messages,
			onFinish: async ({ text, finishReason }) => {
				logger.debug(`onFinish called for project ${projectId}`);
				logger.debug(
					`Response length: ${text.length} chars, finish reason: ${finishReason}`,
				);
				logger.debug(
					`Full message content length: ${fullMessageContent.length} chars`,
				);

				// Check if client aborted
				if (clientAborted) {
					logger.info(`Client aborted, marking message as stopped`);
					if (assistantMessageId && fullMessageContent.trim().length > 0) {
						Conversation.updateMessage(
							assistantMessageId!,
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
						Conversation.updateMessage(
							assistantMessageId!,
							finalContent,
							"complete",
						);
						logger.debug(
							`Marked message ${assistantMessageId} as complete with ${finalContent.length} chars`,
						);

						// Emit final update
						chatEvents.notifyMessageUpdate(projectId, conversation.id);
					} else {
						// Fallback: create message if somehow it wasn't created yet
						Conversation.saveMessage(
							conversation.id,
							"assistant",
							finalContent,
							"complete",
						);
						logger.debug(`Created message in onFinish (fallback)`);

						// Emit final update
						chatEvents.notifyMessageUpdate(projectId, conversation.id);
					}

					try {
						logger.debug(`Attempting to generate code from response...`);
						// Still use 'text' for code generation (without tool metadata)
						const generation = await generateCode(projectId, text);
						if (generation) {
							logger.debug(
								`Generated ${generation.files?.length || 0} files for project ${projectId}`,
							);
						} else {
							logger.debug(`No code blocks found in response`);
						}
					} catch (error) {
						logger.error(
							"Failed to generate code",
							error instanceof Error ? error : new Error(String(error)),
						);
					}
				} else {
					logger.warn(`Empty response from model, marking as error`);
					if (assistantMessageId) {
						Conversation.updateMessage(
							assistantMessageId!,
							"Error: Empty response from model",
							"error",
						);
						chatEvents.notifyMessageUpdate(projectId, conversation.id);
					}
				}
			},
		});

		logger.info(`streamText created successfully, returning response`);
	} catch (error) {
		logger.error(
			`FATAL ERROR creating streamText`,
			error instanceof Error ? error : new Error(String(error)),
		);
		if (assistantMessageId) {
			Conversation.updateMessage(
				assistantMessageId!,
				`Error: ${String(error)}`,
				"error",
			);
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
