import type { APIRoute } from "astro";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createConversation, getConversation, saveMessage, updateConversationModel, getConfig } from "@/lib/db";
import { generateCode } from "@/lib/code-generator";
import { readProjectFile, listProjectFiles } from "@/lib/file-system";
import { z } from "zod";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const maxDuration = 60;

// Helper function to safely execute commands in preview container
async function execInContainer(projectId: string, command: string): Promise<string> {
  const containerName = `doce-preview-${projectId}`;
  
  // Validate command - block dangerous operations
  const blockedCommands = ['rm -rf /', 'dd', 'mkfs', ':(){:|:&};:', 'fork bomb'];
  if (blockedCommands.some(blocked => command.includes(blocked))) {
    throw new Error('Command blocked for security reasons');
  }

  try {
    const { stdout, stderr } = await execAsync(`docker exec ${containerName} sh -c "${command.replace(/"/g, '\\"')}"`);
    return stdout || stderr || 'Command executed successfully';
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

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

  const model = getModel(conversation.model || 'anthropic/claude-3.5-sonnet');

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

  // Check if model supports tools (some models may not support function calling)
  const modelSupportsTools = !conversation.model?.includes('gpt-4.1-mini') && 
                              !conversation.model?.includes('llama') && 
                              !conversation.model?.includes('qwen') &&
                              !conversation.model?.includes('deepseek');

  const toolDefinitions = {
    readFile: {
        description: "Read the contents of a file from the project. Use this to inspect existing code before making changes.",
        parameters: z.object({
          filePath: z.string().describe("Relative path from project root (e.g. 'src/components/Hero.tsx')"),
        }),
      execute: async ({ filePath }) => {
        console.log(`[Tool] readFile called with: ${filePath}`);
        try {
          const content = await readProjectFile(projectId, filePath);
          if (!content) {
            console.log(`[Tool] readFile: file not found`);
            return { success: false, error: `File not found: ${filePath}` };
          }
          console.log(`[Tool] readFile: success, ${content.length} chars`);
          return { success: true, filePath, content };
        } catch (error: any) {
          console.log(`[Tool] readFile error: ${error.message}`);
          return { success: false, error: error.message };
        }
      },
    },
    listFiles: {
      description: "List all files in the project directory. Use this to explore the project structure.",
      parameters: z.object({
        _: z.literal("").optional().describe("No parameters needed"),
      }),
      execute: async () => {
        console.log(`[Tool] listFiles called for project ${projectId}`);
        try {
          const files = await listProjectFiles(projectId);
          console.log(`[Tool] listFiles: found ${files.length} files`);
          return { success: true, files };
        } catch (error: any) {
          console.log(`[Tool] listFiles error: ${error.message}`);
          return { success: false, error: error.message };
        }
      },
    },
    runCommand: {
      description: "Execute a command in the preview container. Use this to run npm scripts, tests, linting, or check build errors. The container must be running.",
      parameters: z.object({
        command: z.string().describe("Shell command to execute (e.g. 'npm run build', 'npm test')"),
      }),
      execute: async ({ command }) => {
        try {
          const output = await execInContainer(projectId, command);
          return { success: true, output };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },
    },
    fetchUrl: {
      description: "Fetch content from a URL. Use this to read documentation, API references, or other web resources.",
      parameters: z.object({
        url: z.string().url().describe("URL to fetch"),
      }),
      execute: async ({ url }) => {
          try {
            // Only allow https URLs and common documentation sites
            if (!url.startsWith('https://')) {
              return { success: false, error: 'Only HTTPS URLs are allowed' };
            }
            
            const response = await fetch(url, {
              headers: { 'User-Agent': 'doce.dev-bot' },
              signal: AbortSignal.timeout(10000), // 10s timeout
            });
            
            if (!response.ok) {
              return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }
            
            const text = await response.text();
            // Limit response size
            const truncated = text.slice(0, 50000);
            return { 
              success: true, 
              url, 
              content: truncated,
              truncated: text.length > 50000 
            };
          } catch (error: any) {
            return { success: false, error: error.message };
          }
      },
    },
  };

  console.log(`[Chat] Model supports tools: ${modelSupportsTools}`);
  console.log(`[Chat] Tools enabled: ${modelSupportsTools ? 'YES' : 'NO'}`);
  
  const result = streamText({
    model,
    maxSteps: modelSupportsTools ? 10 : 1,
    ...(modelSupportsTools && { tools: toolDefinitions }),
    onStepFinish: async ({ text, toolCalls, toolResults, finishReason }) => {
      console.log(`[Chat] Step finished - text: ${text.length} chars, tools: ${toolCalls.length}, results: ${toolResults.length}, finish: ${finishReason}`);
      if (toolResults.length > 0) {
        console.log(`[Chat] Tool results:`, toolResults.map(r => ({ name: r.toolName, result: r.result })));
      }
    },
    system: `You are an expert web developer with access to tools for inspecting projects.

You build modern sites with Astro 5, React islands, and Tailwind CSS v4.

Available tools:
- listFiles() - Lists all project files
- readFile(filePath) - Reads a specific file  
- runCommand(command) - Executes shell commands
- fetchUrl(url) - Fetches web content

When using tools, follow this pattern:
1. Call the tool (no explanation needed)
2. Wait for the results
3. Then explain what you found to the user

You have access to multi-step execution - after calling a tool and receiving results, you will automatically continue to explain them.

When generating code:
- Use Astro 5 with the \`src/\` directory structure.
- Use React components for interactive islands and mark them with client directives when necessary.
- Prefer TypeScript for all .astro and .tsx files.
- Use Tailwind CSS v4 utility classes for styling.
- Provide complete, working examples that integrate with the existing project architecture (Astro + React + Tailwind + TypeScript).
- Never reference Next.js APIs or components.

**CRITICAL: When generating package.json, always include these required dependencies:**
\`\`\`json
{
  "dependencies": {
    "astro": "^5.1.0",
    "@astrojs/react": "^4.4.1",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "tailwindcss": "^4.1.9",
    "@tailwindcss/postcss": "^4.1.9",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.0"
  }
}
\`\`\`

**CRITICAL: When generating postcss.config.cjs, use this exact format for Tailwind v4:**
\`\`\`js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {}
  }
};
\`\`\`

**CRITICAL: For global CSS files, use this Tailwind v4 syntax:**
\`\`\`css
@import "tailwindcss";
\`\`\`

**DO NOT use the old Tailwind v3 syntax** (@tailwind base/components/utilities) or the old PostCSS plugin (tailwindcss: {}).

**CRITICAL: Always specify file paths in code blocks:**
Every code block MUST include a file="..." attribute. Code blocks without file paths will be ignored.

\`\`\`tsx file="src/components/MyComponent.tsx"
export function MyComponent() {
  return <div>Hello!</div>
}
\`\`\`

**Good examples:**
- \`\`\`tsx file="src/components/Button.tsx"\`
- \`\`\`astro file="src/pages/index.astro"\`
- \`\`\`css file="src/styles/custom.css"\`

**Bad examples (will be ignored):**
- \`\`\`tsx\` (missing file attribute)
- \`\`\`javascript\` (missing file attribute)

Always specify the file path in each code block header and generate multiple files when required to deliver a working feature.${agentGuidelines}`,
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

  // For tool calls, we need to return the full result including tool outputs
  // toTextStreamResponse() only returns text, not tool results
  return result.toUIMessageStreamResponse();
};
