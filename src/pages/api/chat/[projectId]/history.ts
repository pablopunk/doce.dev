import type { APIRoute } from "astro";
import { getConversation, getMessages } from "@/lib/db";

export const GET: APIRoute = async ({ params }) => {
  const projectId = params.projectId;
  if (!projectId) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    const conversation = await getConversation(projectId);
    if (!conversation) {
      return Response.json({ messages: [], model: 'openai/gpt-4.1-mini' });
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
      model: conversation.model || 'openai/gpt-4.1-mini'
    });
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return Response.json({ error: "Failed to load chat history" }, { status: 500 });
  }
};
