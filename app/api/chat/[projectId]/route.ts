import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { saveMessage, getConversation, createConversation } from "@/lib/db"
import { generateCode } from "@/lib/code-generator"

export const maxDuration = 60

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { messages } = await req.json()

  let conversation = await getConversation(projectId)
  if (!conversation) {
    conversation = await createConversation(projectId)
  }

  const userMessage = messages[messages.length - 1]
  await saveMessage(conversation.id, "user", userMessage.content)

  const model = process.env.ANTHROPIC_API_KEY ? anthropic("claude-3-5-sonnet-20241022") : openai("gpt-4o")

  const result = streamText({
    model,
    system: `You are an expert web developer and designer. You help users build beautiful, modern websites using Next.js, React, and Tailwind CSS.

When generating code:
- Use Next.js 16 with App Router
- Use Tailwind CSS v4 for styling
- Create clean, semantic HTML
- Follow React best practices
- Generate complete, working code
- Use TypeScript

IMPORTANT: Format your code responses using markdown code blocks with file paths:
\`\`\`tsx file="app/page.tsx"
export default function Page() {
  return <div>Hello</div>
}
\`\`\`

Always specify the file path in the code block header. Generate multiple files when needed.`,
    messages,
    onFinish: async ({ text }) => {
      await saveMessage(conversation.id, "assistant", text)

      try {
        const result = await generateCode(projectId, text)
        if (result) {
          console.log(`Generated ${result.files?.length || 0} files for project ${projectId}`)
        }
      } catch (error) {
        console.error("Failed to generate code:", error)
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
