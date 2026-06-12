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
	request: PendingPermissionRequest,
) {
	set({ pendingPermission: request });
}

export function handlePermissionResolved(set: ChatStoreSet) {
	set({ pendingPermission: null });
}

export function handleQuestionRequested(
	set: ChatStoreSet,
	request: PendingQuestionRequest,
) {
	set({ pendingQuestion: request });
}

export function handleQuestionResolved(set: ChatStoreSet) {
	set({ pendingQuestion: null });
}

export function handleTodoUpdated(
	set: ChatStoreSet,
	payload: { todos: TodoItem[] },
) {
	set({ todos: payload.todos ?? [] });
}
