import {
	buildHistoryItems,
	pickLastModel,
	type RawSessionMessage,
} from "@/lib/chat/buildHistoryItems";
import { logger } from "@/server/logger";
import type { ChatItem } from "@/stores/useChatStore";
import { createOpencodeClient, isOpencodeHealthy } from "./client";
import { logOpencodeMemorySnapshot } from "./runtime";

const INITIAL_CHAT_PAGE_LIMIT = 50;

export interface InitialChatState {
	sessionId: string;
	items: ChatItem[];
	revertMessageId: string | null;
	model: { providerID: string; modelID: string } | null;
}

type RawSessionPart = NonNullable<RawSessionMessage["parts"]>[number];

function estimatePartSize(part: RawSessionPart): number {
	let total = 0;
	total += part.text?.length ?? 0;
	total += part.url?.length ?? 0;
	total += part.filename?.length ?? 0;
	total += part.mime?.length ?? 0;
	try {
		total += JSON.stringify(part.state)?.length ?? 0;
	} catch {}
	return total;
}

function logMessagePayloadStats(
	projectId: string,
	sessionId: string,
	messages: RawSessionMessage[],
): void {
	const perMessage = messages.map((message, index) => {
		const parts = message.parts ?? [];
		const estimatedSize = parts.reduce(
			(total, part) => total + estimatePartSize(part),
			0,
		);
		const largestPartSize = parts.reduce(
			(max, part) => Math.max(max, estimatePartSize(part)),
			0,
		);
		return {
			index,
			id: message.info?.id ?? null,
			role: message.info?.role ?? null,
			partCount: parts.length,
			estimatedSize,
			largestPartSize,
			partTypes: Array.from(new Set(parts.map((part) => part.type ?? "unknown"))),
		};
	});

	logger.info(
		{
			projectId,
			sessionId,
			messageCount: messages.length,
			totalEstimatedSize: perMessage.reduce(
				(total, message) => total + message.estimatedSize,
				0,
			),
			topLargestMessages: perMessage
				.slice()
				.sort((a, b) => b.estimatedSize - a.estimatedSize)
				.slice(0, 5),
		},
		"Initial chat payload stats",
	);
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
			client.session.messages({
				sessionID: sessionId,
				limit: INITIAL_CHAT_PAGE_LIMIT,
			}),
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
				pageLimit: INITIAL_CHAT_PAGE_LIMIT,
			},
			"Initial chat state fetched",
		);
		logMessagePayloadStats(project.id, sessionId, rawMessages);

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
