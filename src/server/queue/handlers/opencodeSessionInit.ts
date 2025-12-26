import { logger } from "@/server/logger";
import { 
  getProjectByIdIncludeDeleted,
  updateInitPromptMessageId,
} from "@/server/projects/projects.model";
import { createOpencodeClient } from "@/server/opencode/client";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { enqueueOpencodeSendUserPrompt } from "../enqueue";
import * as fs from "fs";
import * as path from "path";

interface OpencodeConfig {
  model?: string;
  small_model?: string;
  provider?: Record<string, unknown>;
  instructions?: string[];
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

    // The model string from opencode.json is already in the correct format
    // e.g., "anthropic/claude-haiku-4.5" or "google/gemini-2.5-flash"
    const modelID = config.model;
    
    // OpenRouter is the provider service that hosts these models
    const providerID = "openrouter";

    logger.debug(
      { projectId: project.id, sessionId, modelID, providerID },
      "Initializing opencode session with model config"
    );

    // Create SDK client for this project
    const client = createOpencodeClient(project.opencodePort);

    // Fetch session messages to get the messageID for initialization
    const messagesResponse = await client.session.messages({ sessionID: sessionId });
    const messagesData = messagesResponse.data as Array<{ info?: { id?: string } }> | undefined;
    const messages = messagesData ?? [];

    // If no messages exist, create an initial one by sending an empty prompt
    let firstMessageId = messages[0]?.info?.id;

    if (!firstMessageId) {
      logger.debug(
        { projectId: project.id, sessionId },
        "No messages found, creating initial message via prompt"
      );

      // Send an async prompt with empty text to create a message
      await client.session.promptAsync({
        sessionID: sessionId,
        parts: [{ type: "text", text: "" }],
      });

      // Wait a moment for the message to be created
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now fetch messages again
      const messagesResponse2 = await client.session.messages({ sessionID: sessionId });
      const messagesData2 = messagesResponse2.data as Array<{ info?: { id?: string } }> | undefined;
      const messages2 = messagesData2 ?? [];
      firstMessageId = messages2[0]?.info?.id;

      if (!firstMessageId) {
        throw new Error("Still no message ID after sending prompt");
      }
    }

    logger.debug(
      { projectId: project.id, sessionId, firstMessageId },
      "Found message ID for session init"
    );

    // Call session.init via SDK to initialize the agent with model/provider configuration
    await client.session.init({
      sessionID: sessionId,
      modelID,
      providerID,
      messageID: firstMessageId,
    });

    logger.info({ projectId: project.id, sessionId }, "Initialized opencode session with agent");

    await ctx.throwIfCancelRequested();

    // The session.init was called with firstMessageId - that's the message that contains the
    // AGENTS.md generation prompt. Store it so we can filter it out from chat history.
    await updateInitPromptMessageId(project.id, firstMessageId);
    logger.debug({ projectId: project.id, initMsgId: firstMessageId }, "Stored init prompt message ID");

    // Enqueue next step: send user prompt (the actual project prompt)
    await enqueueOpencodeSendUserPrompt({ projectId: project.id });
    logger.debug({ projectId: project.id }, "Enqueued opencode.sendUserPrompt");
  } catch (error) {
    throw error;
  }
}
