/**
 * Conversation Model
 * Handles chat conversations and messages for projects
 */

import * as db from "@/lib/db";
import { DEFAULT_AI_MODEL } from "@/domain/llms/models/ai-models";

export interface ConversationData {
	id: string;
	project_id: string;
	model: string;
	created_at: string;
	updated_at: string;
}

export interface MessageData {
	id: string;
	conversation_id: string;
	role: "user" | "assistant" | "system";
	content: string;
	streaming_status?: "streaming" | "complete" | "error";
	created_at: string;
}

export interface ChatHistory {
	messages: MessageData[];
	model: string;
}

/**
 * Conversation Model
 * Static methods for managing conversations and messages
 */
export class Conversation {
	/**
	 * Get conversation for a project
	 */
	static getByProjectId(projectId: string): ConversationData | null {
		const conversation = db.getConversation(projectId);
		return conversation as ConversationData | null;
	}

	/**
	 * Get conversation by ID
	 */
	static getById(conversationId: string): ConversationData | null {
		const conversation = db.getConversationById(conversationId);
		return conversation as ConversationData | null;
	}

	/**
	 * Create a new conversation for a project
	 */
	static create(projectId: string, model?: string): ConversationData {
		const conversation = db.createConversation(projectId, model);
		return conversation as ConversationData;
	}

	/**
	 * Update conversation model
	 */
	static updateModel(conversationId: string, model: string): ConversationData {
		const updated = db.updateConversationModel(conversationId, model);
		return updated as ConversationData;
	}

	/**
	 * Get chat history for a project
	 */
	static getHistory(projectId: string): ChatHistory {
		const conversation = Conversation.getByProjectId(projectId);

		if (!conversation) {
			return {
				messages: [],
				model: DEFAULT_AI_MODEL,
			};
		}

		const messages = db.getMessages(conversation.id) as MessageData[];

		return {
			messages: messages.map((msg) => ({
				id: msg.id,
				conversation_id: msg.conversation_id,
				role: msg.role,
				content: msg.content,
				streaming_status: msg.streaming_status || "complete",
				created_at: msg.created_at,
			})),
			model: conversation.model || DEFAULT_AI_MODEL,
		};
	}

	/**
	 * Save a message to a conversation
	 */
	static saveMessage(
		conversationId: string,
		role: "user" | "assistant" | "system",
		content: string,
		streamingStatus?: "streaming" | "complete" | "error",
	): MessageData {
		const message = db.saveMessage(
			conversationId,
			role,
			content,
			streamingStatus,
		);
		return message as MessageData;
	}

	/**
	 * Update a message
	 */
	static updateMessage(
		messageId: string,
		content: string,
		streamingStatus?: "streaming" | "complete" | "error",
	): MessageData {
		const updated = db.updateMessage(messageId, content, streamingStatus);
		return updated as MessageData;
	}

	/**
	 * Delete a message and all messages after it
	 */
	static deleteMessage(projectId: string, messageId: string): void {
		const conversation = Conversation.getByProjectId(projectId);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const messages = db.getMessages(conversation.id) as MessageData[];
		const messageIndex = messages.findIndex((msg) => msg.id === messageId);

		if (messageIndex === -1) {
			throw new Error("Message not found");
		}

		db.deleteMessagesFromIndex(conversation.id, messageIndex);
	}

	/**
	 * Delete a single message by ID
	 */
	static deleteMessageById(messageId: string): boolean {
		return db.deleteMessage(messageId);
	}
}
