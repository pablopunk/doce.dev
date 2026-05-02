import {
	buildHistoryItems,
	pickLastModel,
	type RawSessionMessage,
} from "@/lib/chat/buildHistoryItems";
import { logger } from "@/server/logger";
import type { ChatItem } from "@/stores/useChatStore";
import { createOpencodeClient, isOpencodeHealthy } from "./client";

export interface InitialChatState {
	sessionId: string;
	items: ChatItem[];
	revertMessageId: string | null;
	model: { providerID: string; modelID: string } | null;
}

/**
 * Server-side fetch of the chat history so the project page can render
 * the conversation on first paint instead of waiting for a client roundtrip.
 *
 * Returns null when opencode isn't healthy yet or the project has no
 * bootstrap session — the client path will hydrate later via SSE.
 */
export async function getInitialChatState(project: {
	id: string;
	bootstrapSessionId: string | null;
	userPromptMessageId: string | null;
}): Promise<InitialChatState | null> {
	const sessionId = project.bootstrapSessionId;
	if (!sessionId) return null;

	const healthy = await isOpencodeHealthy();
	if (!healthy) return null;

	try {
		const client = createOpencodeClient();
		const [infoRes, messagesRes] = await Promise.all([
			client.session.get({ sessionID: sessionId }),
			client.session.messages({ sessionID: sessionId }),
		]);

		const info = infoRes.data as
			| { revert?: { messageID?: string } }
			| undefined;
		const rawMessages = (messagesRes.data ?? []) as RawSessionMessage[];

		const items = buildHistoryItems(rawMessages, project.userPromptMessageId);
		const revertMessageId = info?.revert?.messageID ?? null;
		const model = pickLastModel(rawMessages);

		return {
			sessionId,
			items,
			revertMessageId,
			model,
		};
	} catch (error) {
		logger.debug(
			{ error, projectId: project.id },
			"Failed to load initial chat state, falling back to client fetch",
		);
		return null;
	}
}
