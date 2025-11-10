import { EventEmitter } from "events";

/**
 * Simple event emitter for chat message updates
 * When a message is saved/updated, we emit an event
 * SSE listeners receive the event and push to clients
 * No polling needed!
 */
class ChatEventEmitter extends EventEmitter {
	notifyMessageUpdate(projectId: string, conversationId: string) {
		this.emit(`project:${projectId}`, { conversationId });
		console.log(`[ChatEvents] Notified update for project ${projectId}`);
	}
}

export const chatEvents = new ChatEventEmitter();
