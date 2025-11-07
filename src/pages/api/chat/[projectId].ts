import type { APIRoute } from "astro";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createConversation, getConversation, saveMessage, updateConversationModel, getConfig } from "@/lib/db";
import { generateCode } from "@/lib/code-generator";

export const maxDuration = 60;

// Helper to get API key from database
function getApiKey(provider: string): string {
  const key = getConfig(`${provider}_api_key`)
  if (!key) {
    throw new Error(`No API key found for ${provider}. Configure it in /setup`)
  }
  return key
}

// Helper to get model provider and instance
function getModel(modelId: string) {
  // OpenRouter models (can route to any provider)
  if (modelId.includes('/')) {
    const apiKey = getApiKey('openrouter')
    const openrouter = createOpenRouter({ apiKey });
    return openrouter(modelId);
  }

  // Direct provider models (legacy support)
  if (modelId.startsWith('claude-')) {
    const apiKey = getApiKey('anthropic')
    process.env.ANTHROPIC_API_KEY = apiKey; // Set for SDK
    return anthropic(modelId);
  }
  
  if (modelId.startsWith('gpt-')) {
    const apiKey = getApiKey('openai')
    process.env.OPENAI_API_KEY = apiKey; // Set for SDK
    return openai(modelId);
  }

  // Default to OpenRouter
  const apiKey = getApiKey('openrouter')
  const openrouter = createOpenRouter({ apiKey });
  return openrouter(modelId);
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

  const model = getModel(conversation.model || 'openai/gpt-4.1-mini');

  const result = streamText({
    model,
    system: `You are an expert web developer and designer helping users build modern sites with Astro, React islands, and Tailwind CSS.

When generating code:
- Use Astro 5 with the \`src/\` directory structure.
- Use React components for interactive islands and mark them with client directives when necessary.
- Prefer TypeScript for all .astro and .tsx files.
- Use Tailwind CSS v4 utility classes for styling.
- Provide complete, working examples that integrate with the existing project architecture (Astro + React + Tailwind + TypeScript).
- Never reference Next.js APIs or components.

Format code responses with markdown code blocks including file paths:
\`\`\`tsx file="src/components/MyComponent.tsx"
export function MyComponent() {
  return <div>Hello!</div>
}
\`\`\`

Always specify the file path in each code block header and generate multiple files when required to deliver a working feature.`,
    messages,
    onFinish: async ({ text }) => {
      console.log(`[Chat] onFinish called for project ${projectId}`);
      console.log(`[Chat] Response length: ${text.length} chars`);
      
      await saveMessage(conversation.id, "assistant", text);

      try {
        console.log(`[Chat] Attempting to generate code from response...`);
        const generation = await generateCode(projectId, text);
        if (generation) {
          console.log(`[Chat] Generated ${generation.files?.length || 0} files for project ${projectId}`);
        } else {
          console.log(`[Chat] No code blocks found in response`);
        }
      } catch (error) {
        console.error("[Chat] Failed to generate code:", error);
      }
    },
  });

  return result.toUIMessageStreamResponse();
};
