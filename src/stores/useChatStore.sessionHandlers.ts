import type { ChatStore } from "./useChatStore";

type ChatStoreSet = (
	partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>),
) => void;

export function handleSessionUpdated(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
	eventSessionId?: string,
) {
	const { title } = payload as { title?: string | null };
	set((state) => {
		if (
			eventSessionId &&
			state.sessionId &&
			eventSessionId !== state.sessionId
		) {
			return {};
		}
		return { sessionTitle: title ?? null };
	});
}

export function handleSessionStatus(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	const { status } = payload as { status: string };
	if (status === "completed" || status === "idle") {
		set({ isStreaming: false });
	}
}
