import type { APIRoute } from "astro";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createConversation, getConversation, saveMessage } from "@/lib/db";
import { generateCode } from "@/lib/code-generator";

export const maxDuration = 60;

export const POST: APIRoute = async ({ params, request }) => {
  const projectId = params.projectId;
  if (!projectId) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  const { messages } = await request.json();

  let conversation = await getConversation(projectId);
  if (!conversation) {
    conversation = await createConversation(projectId);
  }

  const userMessage = messages[messages.length - 1];
  await saveMessage(conversation.id, "user", userMessage.content);

  const model = process.env.ANTHROPIC_API_KEY ? anthropic("claude-3-5-sonnet-20241022") : openai("gpt-4o");

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
      await saveMessage(conversation.id, "assistant", text);

      try {
        const generation = await generateCode(projectId, text);
        if (generation) {
          console.log(`Generated ${generation.files?.length || 0} files for project ${projectId}`);
        }
      } catch (error) {
        console.error("Failed to generate code:", error);
      }
    },
  });

  return result.toUIMessageStreamResponse();
};
