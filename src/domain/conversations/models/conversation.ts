/**
 * Conversation Model
 * Handles chat conversations and messages for projects
 */

import * as db from "@/lib/db";
import type {
	ConversationInDatabase,
	MessageInDatabase,
} from "@/lib/db/providers/drizzle/schema";
import { DEFAULT_AI_MODEL } from "@/domain/llms/models/ai-models";

// Domain types - always import from here, never from @/lib/db
export type ConversationModel = ConversationInDatabase;
export type Message = MessageInDatabase;

export interface ChatHistory {
	messages: Message[];
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
	static getByProjectId(projectId: string): ConversationModel | null {
		return db.conversations.getByProjectId(projectId) ?? null;
	}

	/**
	 * Get conversation by ID
	 */
	static getById(conversationId: string): ConversationModel | null {
		return db.conversations.getById(conversationId) ?? null;
	}

	/**
	 * Create a new conversation for a project
	 */
	static create(projectId: string, model?: string): ConversationModel {
		const id = crypto.randomUUID();
		const conversation = db.conversations.create({
			id,
			projectId,
			model: model || DEFAULT_AI_MODEL,
		});
		if (!conversation) throw new Error("Failed to create conversation");
		return conversation;
	}

	/**
	 * Update conversation model
	 */
	static updateModel(conversationId: string, model: string): ConversationModel {
		const updated = db.conversations.update(conversationId, { model });
		if (!updated) throw new Error(`Conversation ${conversationId} not found`);
		return updated;
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

		const messages = db.messages.getByConversationId(conversation.id);

		return {
			messages,
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
	): Message {
		const id = crypto.randomUUID();
		const message = db.messages.create({
			id,
			conversationId,
			role,
			content,
			streamingStatus: streamingStatus || "complete",
		});
		if (!message) throw new Error("Failed to save message");
		return message;
	}

	/**
	 * Update a message
	 */
	static updateMessage(
		messageId: string,
		content: string,
		streamingStatus?: "streaming" | "complete" | "error",
	): Message {
		const updated = db.messages.update(messageId, { content, streamingStatus });
		if (!updated) throw new Error(`Message ${messageId} not found`);
		return updated;
	}

	/**
	 * Delete a message and all messages after it
	 * Business logic: deleting from a specific index in conversation history
	 */
	static deleteMessage(projectId: string, messageId: string): void {
		const conversation = Conversation.getByProjectId(projectId);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const messages = db.messages.getByConversationId(conversation.id);
		const messageIndex = messages.findIndex((msg) => msg.id === messageId);

		if (messageIndex === -1) {
			throw new Error("Message not found");
		}

		// Delete this message and all after it
		Conversation.deleteMessagesFromIndex(conversation.id, messageIndex);
	}

	/**
	 * Delete messages from a specific index onwards
	 * Business logic for conversation history management
	 */
	static deleteMessagesFromIndex(
		conversationId: string,
		messageIndex: number,
	): number {
		const allMessages = db.messages.getByConversationId(conversationId);

		if (messageIndex < allMessages.length) {
			const messagesToDelete = allMessages.slice(messageIndex);
			const ids = messagesToDelete.map((m) => m.id);

			if (ids.length > 0) {
				db.messages.deleteMany(ids);
				return ids.length;
			}
		}

		return 0;
	}

	/**
	 * Delete a single message by ID
	 */
	static deleteMessageById(messageId: string): void {
		db.messages.delete(messageId);
	}
}
