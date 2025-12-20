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
     
     // OpenRoute is the provider service that hosts these models
     const providerID = "openrouter";

     logger.debug(
       { projectId: project.id, sessionId, modelID, providerID },
       "Initializing opencode session with model config"
     );

    // Fetch session messages to get the messageID for initialization
     // Even though the session was just created, there should be messages from the initialization
     const messagesUrl = `http://127.0.0.1:${project.opencodePort}/session/${sessionId}/message`;
     const messagesRes = await fetch(messagesUrl);
     
     if (!messagesRes.ok) {
       throw new Error(`Failed to fetch session messages: ${messagesRes.status}`);
     }

     const messages = await messagesRes.json() as Array<{ info?: { id?: string } }>;
     
     // If no messages exist, create an initial one by sending an empty prompt
     let firstMessageId = messages[0]?.info?.id;
     
     if (!firstMessageId) {
       logger.debug(
         { projectId: project.id, sessionId },
         "No messages found, creating initial message via prompt"
       );
       
       // Send an async prompt with empty text to create a message
       const promptUrl = `http://127.0.0.1:${project.opencodePort}/session/${sessionId}/prompt_async`;
       const promptRes = await fetch(promptUrl, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           parts: [{ type: "text", text: "" }],
         }),
       });

       if (!promptRes.ok) {
         throw new Error(`Failed to create initial message via prompt: ${promptRes.status}`);
       }

       // Wait a moment for the message to be created
       await new Promise(resolve => setTimeout(resolve, 100));

       // Now fetch messages again
       const messagesRes2 = await fetch(messagesUrl);
       if (!messagesRes2.ok) {
         throw new Error(`Failed to fetch messages after prompt: ${messagesRes2.status}`);
       }

       const messages2 = await messagesRes2.json() as Array<{ info?: { id?: string } }>;
       firstMessageId = messages2[0]?.info?.id;

       if (!firstMessageId) {
         throw new Error("Still no message ID after sending prompt");
       }
     }

     logger.debug(
       { projectId: project.id, sessionId, firstMessageId },
       "Found message ID for session init"
     );

    // Call session.init via HTTP to initialize the agent with model/provider configuration
    const url = `http://127.0.0.1:${project.opencodePort}/session/${sessionId}/init`;
    
     const response = await fetch(url, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         modelID,
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
