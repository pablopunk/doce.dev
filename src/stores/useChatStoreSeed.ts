import { useState } from "react";
import type { InitialChatState } from "@/server/opencode/initialChat";
import { seedChatStoreOnce } from "./useChatStore";

/**
 * One-shot synchronous seed of the per-project chat store from SSR data.
 * Runs in a useState initializer so the seed lands BEFORE any child component
 * subscribes via useChatStore — meaning the first render of the chat panel
 * already sees populated history.
 */
export function useChatStoreSeed(
	projectId: string,
	initialChat: InitialChatState | null,
): void {
	useState(() => {
		if (!initialChat) return null;
		seedChatStoreOnce(projectId, {
			items: initialChat.items,
			sessionId: initialChat.sessionId,
			revertMessageId: initialChat.revertMessageId,
			currentModel: initialChat.model,
			historyLoaded: true,
		});
		return null;
	});
}
