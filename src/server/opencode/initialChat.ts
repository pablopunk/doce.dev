import {
	buildHistoryItems,
	pickLastModel,
	type RawSessionMessage,
} from "@/lib/chat/buildHistoryItems";
import { logger } from "@/server/logger";
import type { ChatItem } from "@/stores/useChatStore";
import { createOpencodeClient, isOpencodeHealthy } from "./client";
import { logOpencodeMemorySnapshot } from "./runtime";

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
	logOpencodeMemorySnapshot(`initialChat:${project.id}:enter`);
	const sessionId = project.bootstrapSessionId;
	if (!sessionId) return null;

	const healthy = await isOpencodeHealthy();
	if (!healthy) return null;
	logOpencodeMemorySnapshot(`initialChat:${project.id}:after-health-check`);

	try {
		const client = createOpencodeClient();
		logOpencodeMemorySnapshot(`initialChat:${project.id}:before-fetch`);
		const [infoRes, messagesRes] = await Promise.all([
			client.session.get({ sessionID: sessionId }),
			client.session.messages({ sessionID: sessionId }),
		]);

		logOpencodeMemorySnapshot(`initialChat:${project.id}:after-fetch`);
		const info = infoRes.data as
			| { revert?: { messageID?: string } }
			| undefined;
		const rawMessages = (messagesRes.data ?? []) as RawSessionMessage[];

		logger.info(
			{
				projectId: project.id,
				sessionId,
				messageCount: rawMessages.length,
			},
			"Initial chat state fetched",
		);

		const items = buildHistoryItems(rawMessages, project.userPromptMessageId);
		logOpencodeMemorySnapshot(`initialChat:${project.id}:after-buildHistoryItems`);
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
