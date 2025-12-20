import { logger } from "@/server/logger";
import { getProjectByIdIncludeDeleted, updateProjectSetupPhaseAndError } from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { enqueueOpencodeSendInitialPrompt } from "../enqueue";
import * as fs from "fs";
import * as path from "path";

interface OpencodeConfig {
  model?: string;
  small_model?: string;
  provider?: Record<string, unknown>;
  instructions?: string[];
}

/**
 * Extract model ID and vendor from model string.
 * Format: "vendor/model-name" → { vendor: "vendor", modelId: "model-name" }
 */
function parseModelString(modelString: string): { vendor: string; modelId: string } {
  const parts = modelString.split("/");
  if (parts.length < 2) {
    // Fallback if format is unexpected
    return { vendor: "openrouter", modelId: modelString };
  }
  const vendor = parts[0]!;
  const modelId = parts.slice(1).join("/"); // Handle edge case where "/" appears in model name
  return { vendor, modelId };
}

/**
 * Load opencode.json config from project directory.
 */
function loadOpencodeConfig(projectPath: string): OpencodeConfig | null {
  try {
    const configPath = path.join(projectPath, "opencode.json");
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content) as OpencodeConfig;
  } catch (error) {
    logger.error({ error }, "Failed to load opencode.json");
    return null;
  }
}

export async function handleOpencodeSessionInit(ctx: QueueJobContext): Promise<void> {
  const payload = parsePayload("opencode.sessionInit", ctx.job.payloadJson);

  const project = await getProjectByIdIncludeDeleted(payload.projectId);
  if (!project) {
    logger.warn({ projectId: payload.projectId }, "Project not found for opencode.sessionInit");
    return;
  }

  if (project.status === "deleting") {
    logger.info({ projectId: project.id }, "Skipping opencode.sessionInit for deleting project");
    return;
  }

  try {
    const sessionId = project.bootstrapSessionId;
    if (!sessionId) {
      throw new Error("No bootstrap session ID found - session not created?");
    }

    await ctx.throwIfCancelRequested();

    // Load opencode.json to get model configuration
    const projectPath = path.join(process.cwd(), "data", "projects", project.id);
    const config = loadOpencodeConfig(projectPath);

    if (!config || !config.model) {
      throw new Error("No model configured in opencode.json");
    }

    // Extract vendor and model ID from model string (e.g., "anthropic/claude-haiku-4.5")
    const { modelId } = parseModelString(config.model);
    const providerKeys = Object.keys(config.provider || {});
    
    if (providerKeys.length === 0) {
      throw new Error("No provider configured in opencode.json");
    }

    const providerID = providerKeys[0]!;

    logger.debug(
      { projectId: project.id, sessionId, modelId, providerID },
      "Initializing opencode session with model config"
    );

    // First, fetch the session messages to get the message ID from the first message
    const messagesUrl = `http://127.0.0.1:${project.opencodePort}/session/${sessionId}/message`;
    const messagesRes = await fetch(messagesUrl);
    
    if (!messagesRes.ok) {
      throw new Error(`Failed to fetch session messages: ${messagesRes.status}`);
    }

    const messages = await messagesRes.json() as Array<{ info?: { id?: string } }>;
    const firstMessageId = messages[0]?.info?.id;

    if (!firstMessageId) {
      throw new Error("No messages found in session to initialize with");
    }

    logger.debug(
      { projectId: project.id, sessionId, firstMessageId },
      "Found initial message for session init"
    );

    // Call session.init via HTTP to initialize the agent with model/provider configuration
    const url = `http://127.0.0.1:${project.opencodePort}/session/${sessionId}/init`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelID: modelId,
        providerID,
        messageID: firstMessageId,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to initialize session: ${response.status} ${text.slice(0, 200)}`);
    }

    logger.info({ projectId: project.id, sessionId }, "Initialized opencode session with agent");

    await ctx.throwIfCancelRequested();

    // Enqueue next step: send initial prompt
    await enqueueOpencodeSendInitialPrompt({ projectId: project.id });
    logger.debug({ projectId: project.id }, "Enqueued opencode.sendInitialPrompt");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await updateProjectSetupPhaseAndError(project.id, "failed", errorMsg);
    throw error;
  }
}
