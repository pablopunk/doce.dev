import type { APIRoute } from "astro";
import { getConversation, getMessages } from "@/lib/db";
import { DEFAULT_AI_MODEL } from "@/shared/config/ai-models";

export const GET: APIRoute = async ({ params }) => {
  const projectId = params.projectId;
  if (!projectId) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    const conversation = await getConversation(projectId);
    if (!conversation) {
      return Response.json({ messages: [], model: DEFAULT_AI_MODEL });
    }

    const messages = await getMessages(conversation.id);
    
    // Format messages for the chat interface
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
    }));

    return Response.json({ 
      messages: formattedMessages,
      model: conversation.model || DEFAULT_AI_MODEL
    });
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return Response.json({ error: "Failed to load chat history" }, { status: 500 });
  }
};
