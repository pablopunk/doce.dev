import type { RawSessionMessage } from "@/lib/chat/buildHistoryItems";

function getTokenTotal(message: RawSessionMessage): number {
	const tokens = message.info?.tokens;
	if (!tokens) return 0;
	return (
		tokens.input +
		tokens.output +
		tokens.reasoning +
		tokens.cache.read +
		tokens.cache.write
	);
}

function getLastAssistantWithTokens(messages: RawSessionMessage[]) {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message?.info?.role !== "assistant") continue;
		if (getTokenTotal(message) <= 0) continue;
		return message;
	}
	return null;
}

export function getSessionContextUsage(
	messages: RawSessionMessage[],
	model: { providerID: string; modelID: string } | null,
	models: ReadonlyArray<{
		id: string;
		provider: string;
		contextLimit?: number;
	}> = [],
) {
	const latestMessage = getLastAssistantWithTokens(messages);
	if (!latestMessage) return null;

	const total = getTokenTotal(latestMessage);
	const modelContextLimit = model
		? (models.find(
				(candidate) =>
					candidate.id === model.modelID &&
					candidate.provider === model.providerID,
			)?.contextLimit ?? null)
		: null;

	return {
		total,
		limit: modelContextLimit,
		usage: modelContextLimit ? Math.round((total / modelContextLimit) * 100) : null,
	};
}
