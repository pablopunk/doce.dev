import type { APIRoute } from "astro";
import {
	deleteMessage,
	deleteMessagesFromIndex,
	getConversation,
	getMessages,
} from "@/lib/db";

export const DELETE: APIRoute = async ({ params, request }) => {
	const { projectId, messageId } = params;

	if (!projectId || !messageId) {
		return Response.json(
			{ error: "Project ID and Message ID are required" },
			{ status: 400 },
		);
	}

	try {
		// Get the conversation for this project
		const conversation = await getConversation(projectId);
		if (!conversation) {
			return Response.json(
				{ error: "Conversation not found" },
				{ status: 404 },
			);
		}

		// Parse query params to check if we should delete from this message onwards
		const url = new URL(request.url);
		const deleteFrom = url.searchParams.get("deleteFrom") === "true";

		if (deleteFrom) {
			// Get all messages to find the index of the message to delete
			const allMessages = getMessages(conversation.id) as any[];
			const messageIndex = allMessages.findIndex((m) => m.id === messageId);

			if (messageIndex === -1) {
				return Response.json({ error: "Message not found" }, { status: 404 });
			}

			// Delete this message and all subsequent messages
			const deletedCount = deleteMessagesFromIndex(
				conversation.id,
				messageIndex,
			);

			return Response.json({
				success: true,
				deletedCount,
				message: `Deleted ${deletedCount} message(s) from this point onwards`,
			});
		} else {
			// Delete only this specific message
			const success = deleteMessage(messageId);

			if (!success) {
				return Response.json({ error: "Message not found" }, { status: 404 });
			}

			return Response.json({
				success: true,
				deletedCount: 1,
				message: "Message deleted successfully",
			});
		}
	} catch (error: any) {
		console.error("[API] Error deleting message:", error);
		return Response.json(
			{ error: error.message || "Failed to delete message" },
			{ status: 500 },
		);
	}
};
