/**
 * Conversation Model
 * Handles chat conversations and messages for projects
 */

import { DEFAULT_AI_MODEL } from "@/domain/llms/models/ai-models";
import * as db from "@/lib/db";
import type { ConversationInDatabase } from "@/lib/db/providers/drizzle/schema";

// Domain types - always import from here, never from @/lib/db
export type ConversationModel = ConversationInDatabase;

export interface ChatHistory {
	// Raw messages from OpenCode session API
	messages: any[];
	model: string;
	initialPrompt?: string | null;
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

	static updateSessionId(conversationId: string, sessionId: string): void {
		const updated = db.conversations.update(conversationId, {
			opencodeSessionId: sessionId,
		});
		if (!updated) {
			throw new Error(`Conversation ${conversationId} not found`);
		}
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
	 * Create a new conversation for a project.
	 * The actual chat transcript lives in OpenCode; we only
	 * persist the conversation metadata + selected model.
	 */
	static createForProject(
		projectId: string,
		model?: string,
	): ConversationModel {
		return Conversation.create(projectId, model);
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
	 * Get chat history for a project.
	 *
	 * This no longer reads from the local DB. Instead, it
	 * ensures an OpenCode session exists for the project and
	 * returns the messages from the OpenCode session API.
	 *
	 * If the OpenCode server isn't ready yet, returns empty messages
	 * so the UI can still show the initial prompt.
	 */
	static async getHistory(projectId: string): Promise<ChatHistory> {
		// Model is still stored on the conversation row; fall back
		// to DEFAULT_AI_MODEL if none is set.
		const conversation = Conversation.getByProjectId(projectId);

		try {
			const session = await import("@/domain/sessions/models/session").then(
				(m) => m.Session,
			);

			const opencodeSession = await session.getOrCreateForProject(projectId);
			const { messages, initialPrompt } = await session.getMessages(
				projectId,
				opencodeSession.id,
			);

			return {
				messages,
				model: conversation?.model || DEFAULT_AI_MODEL,
				initialPrompt,
			};
		} catch (error) {
			// If OpenCode server isn't ready yet, return empty messages
			// The UI will show the initial prompt from the project
			const errorMessage = (error as Error).message || "";
			if (
				errorMessage.includes("preview is not running") ||
				errorMessage.includes("fetch failed") ||
				errorMessage.includes("ECONNREFUSED")
			) {
				return {
					messages: [],
					model: conversation?.model || DEFAULT_AI_MODEL,
					initialPrompt: null, // Will be filled from project by action
				};
			}
			throw error;
		}
	}
}
