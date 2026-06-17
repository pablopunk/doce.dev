import type {
	PermissionRequestPayload,
	QuestionRequestPayload,
	TodoUpdatedPayload,
} from "@/server/opencode/normalize";
import type { ChatStore } from "./useChatStore";

type ChatStoreSet = (
	partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>),
) => void;

/**
 * Casts payload to the permission-request shape from normalize.
 * Safe because this handler only runs when the event type is
 * "chat.permission.requested", which guarantees the shape.
 */
export function handlePermissionRequested(set: ChatStoreSet, payload: unknown) {
	const p = payload as PermissionRequestPayload;
	set({ pendingPermission: p });
}

export function handlePermissionResolved(set: ChatStoreSet) {
	set({ pendingPermission: null });
}

/**
 * Casts payload to the question-request shape from normalize.
 * Safe because this handler only runs when the event type is
 * "chat.question.requested", which guarantees the shape.
 */
export function handleQuestionRequested(set: ChatStoreSet, payload: unknown) {
	const p = payload as QuestionRequestPayload;
	set({ pendingQuestion: p });
}

export function handleQuestionResolved(set: ChatStoreSet) {
	set({ pendingQuestion: null });
}

export function handleTodoUpdated(set: ChatStoreSet, payload: unknown) {
	const p = payload as TodoUpdatedPayload;
	set({ todos: p.todos ?? [] });
}
