import type {
	ChatStore,
	PendingPermissionRequest,
	PendingQuestionRequest,
	TodoItem,
} from "./useChatStore";

type ChatStoreSet = (
	partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>),
) => void;

export function handlePermissionRequested(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	const request = payload as unknown as PendingPermissionRequest;
	set({ pendingPermission: request });
}

export function handlePermissionResolved(set: ChatStoreSet) {
	set({ pendingPermission: null });
}

export function handleQuestionRequested(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	const request = payload as unknown as PendingQuestionRequest;
	set({ pendingQuestion: request });
}

export function handleQuestionResolved(set: ChatStoreSet) {
	set({ pendingQuestion: null });
}

export function handleTodoUpdated(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	const todoPayload = payload as { todos: TodoItem[] };
	set({ todos: todoPayload.todos ?? [] });
}
