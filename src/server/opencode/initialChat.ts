import {
	buildHistoryItems,
	pickLastModel,
	type RawSessionMessage,
} from "@/lib/chat/buildHistoryItems";
import { getSessionContextUsage } from "@/lib/chat/sessionContextUsage";
import { logger } from "@/server/logger";
import type { ChatItem } from "@/stores/useChatStore";
import { createOpencodeClient, isOpencodeHealthy } from "./client";

const INITIAL_CHAT_PAGE_LIMIT = 50;

export interface InitialChatState {
	sessionId: string;
	sessionTitle: string | null;
	sessionContextUsage: {
		total: number;
		limit: number | null;
		usage: number | null;
	} | null;
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
			client.session.messages({
				sessionID: sessionId,
				limit: INITIAL_CHAT_PAGE_LIMIT,
			}),
		]);

		const info = infoRes.data as
			| { revert?: { messageID?: string }; title?: string | null }
			| undefined;
		const rawMessages = (messagesRes.data ?? []) as RawSessionMessage[];

		const items = buildHistoryItems(rawMessages, project.userPromptMessageId);
		const revertMessageId = info?.revert?.messageID ?? null;
		const model = pickLastModel(rawMessages);
		const sessionContextUsage = getSessionContextUsage(rawMessages, model);

		return {
			sessionId,
			sessionTitle: info?.title ?? null,
			sessionContextUsage,
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
