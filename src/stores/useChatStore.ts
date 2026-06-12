import { create } from "zustand";
import type { OpencodeDiagnostic } from "@/server/opencode/diagnostics";
import type { Message, PromptAttachmentPart } from "@/types/message";
import {
	handlePermissionRequested,
	handlePermissionResolved,
	handleQuestionRequested,
	handleQuestionResolved,
	handleTodoUpdated,
} from "./useChatStore.interactionHandlers";
import {
	handleMessageDelta,
	handleMessageFinal,
	handleMessagePartAdded,
	handleMessageUser,
} from "./useChatStore.messageHandlers";
import {
	handleSessionStatus,
	handleSessionUpdated,
} from "./useChatStore.sessionHandlers";
import {
	handleDiagnostic,
	handleReasoningPart,
	handleToolUpdate,
} from "./useChatStore.toolHandlers";

/**
 * ToolCall type (moved from ToolCallDisplay for reuse)
 */
export interface ToolCall {
	id: string;
	name: string;
	input?: unknown;
	output?: unknown;
	error?: unknown;
	status: "running" | "success" | "error";
}

/**
 * ChatItem represents either a message or a tool call in the chat
 */
export interface ChatItem {
	type: "message" | "tool";
	id: string;
	data: Message | ToolCall;
}

export interface QuestionOption {
	label: string;
	description: string;
}

export interface QuestionInfo {
	header: string;
	question: string;
	options: QuestionOption[];
	multiple?: boolean;
	custom?: boolean;
}

export interface PendingQuestionRequest {
	requestId: string;
	sessionId: string;
	questions: QuestionInfo[];
	messageId?: string;
	toolCallId?: string;
}

export interface PendingPermissionRequest {
	requestId: string;
	sessionId: string;
	permission: string;
	patterns: string[];
	messageId?: string;
	toolCallId?: string;
}

export interface TodoItem {
	content: string;
	status: string;
	priority: string;
}

export interface SessionContextUsage {
	total: number;
	limit: number | null;
	usage: number | null;
}

/**
 * ChatStore manages all chat state for a project
 */
export interface ChatStore {
	// State: Messages and tools
	items: ChatItem[];

	// State: Session and OpenCode status
	sessionId: string | null;
	revertMessageId: string | null;
	opencodeReady: boolean;
	initialPromptSent: boolean;
	userPromptMessageId: string | null;
	projectPrompt: string | null;
	sessionTitle: string | null;
	sessionContextUsage: SessionContextUsage | null;

	// State: Model selection (using OpenCode's format)
	currentModel: { providerID: string; modelID: string } | null;

	// State: Loading flags
	historyLoaded: boolean;
	presenceLoaded: boolean;
	isStreaming: boolean;

	// State: Pending attachments
	pendingAttachments: PromptAttachmentPart[];
	pendingAttachmentError: string | null;

	// State: Diagnostics
	latestDiagnostic: OpencodeDiagnostic | null;
	diagnosticHistory: OpencodeDiagnostic[];

	// State: Blocking requests and todos
	pendingQuestion: PendingQuestionRequest | null;
	pendingPermission: PendingPermissionRequest | null;
	todos: TodoItem[];

	// Actions: Session & status
	setSessionId: (id: string | null) => void;
	setRevertMessageId: (id: string | null) => void;
	setOpenCodeReady: (ready: boolean) => void;
	setPresenceLoaded: (loaded: boolean) => void;
	setInitialPromptSent: (sent: boolean) => void;
	setUserPromptMessageId: (id: string | null) => void;
	setProjectPrompt: (prompt: string | null) => void;
	setSessionTitle: (title: string | null) => void;
	setSessionContextUsage: (usage: SessionContextUsage | null) => void;

	// Actions: Model
	setCurrentModel: (
		model: { providerID: string; modelID: string } | null,
	) => void;

	// Actions: Loading flags
	setHistoryLoaded: (loaded: boolean) => void;
	setIsStreaming: (streaming: boolean) => void;

	// Actions: Attachments
	setPendingAttachments: (attachments: PromptAttachmentPart[]) => void;
	setPendingAttachmentError: (error: string | null) => void;

	// Actions: Diagnostics
	setLatestDiagnostic: (diagnostic: OpencodeDiagnostic | null) => void;
	addDiagnostic: (diagnostic: OpencodeDiagnostic) => void;
	clearDiagnostics: () => void;
	setPendingQuestion: (request: PendingQuestionRequest | null) => void;
	setPendingPermission: (request: PendingPermissionRequest | null) => void;
	setTodos: (todos: TodoItem[]) => void;

	// Actions: Message management
	setItems: (items: ChatItem[]) => void;
	addItem: (item: ChatItem) => void;
	removeItem: (id: string) => void;
	updateItem: (id: string, updates: Partial<ChatItem["data"]>) => void;

	// Actions: Event handling
	handleChatEvent: (event: {
		type: string;
		projectId: string;
		sessionId?: string;
		payload: Record<string, unknown>;
	}) => void;

	// Actions: Reset
	clear: () => void;
}

const initialState = {
	items: [] as ChatItem[],
	sessionId: null as string | null,
	revertMessageId: null as string | null,
	opencodeReady: false,
	initialPromptSent: true, // Assume sent until we know otherwise
	userPromptMessageId: null as string | null,
	projectPrompt: null as string | null,
	sessionTitle: null as string | null,
	sessionContextUsage: null as SessionContextUsage | null,
	currentModel: null as { providerID: string; modelID: string } | null,
	historyLoaded: false,
	presenceLoaded: false,
	isStreaming: false,
	pendingAttachments: [] as PromptAttachmentPart[],
	pendingAttachmentError: null as string | null,
	latestDiagnostic: null as OpencodeDiagnostic | null,
	diagnosticHistory: [] as OpencodeDiagnostic[],
	pendingQuestion: null as PendingQuestionRequest | null,
	pendingPermission: null as PendingPermissionRequest | null,
	todos: [] as TodoItem[],
};

/**
 * Create a zustand store for a specific project's chat
 */
export function createChatStore() {
	return create<ChatStore>()((set) => ({
		...initialState,

		// Simple setters
		setSessionId: (id) => set({ sessionId: id }),
		setRevertMessageId: (id) => set({ revertMessageId: id }),
		setOpenCodeReady: (ready) => set({ opencodeReady: ready }),
		setPresenceLoaded: (loaded) => set({ presenceLoaded: loaded }),
		setInitialPromptSent: (sent) => set({ initialPromptSent: sent }),
		setUserPromptMessageId: (id) => set({ userPromptMessageId: id }),
		setProjectPrompt: (prompt) => set({ projectPrompt: prompt }),
		setSessionTitle: (title) => set({ sessionTitle: title }),
		setSessionContextUsage: (sessionContextUsage) =>
			set({ sessionContextUsage }),
		setCurrentModel: (model) => set({ currentModel: model }),
		setHistoryLoaded: (loaded) => set({ historyLoaded: loaded }),
		setIsStreaming: (streaming) => set({ isStreaming: streaming }),
		setPendingAttachments: (attachments) =>
			set({ pendingAttachments: attachments }),
		setPendingAttachmentError: (error) =>
			set({ pendingAttachmentError: error }),
		setPendingQuestion: (request) => set({ pendingQuestion: request }),
		setPendingPermission: (request) => set({ pendingPermission: request }),
		setTodos: (todos) => set({ todos }),

		// Message management
		setItems: (items) => set({ items }),
		addItem: (item) => set((state) => ({ items: [...state.items, item] })),
		removeItem: (id) =>
			set((state) => ({
				items: state.items.filter((item) => item.id !== id),
			})),
		updateItem: (id, updates) =>
			set((state) => ({
				items: state.items.map((item) =>
					item.id === id
						? { ...item, data: { ...item.data, ...updates } }
						: item,
				),
			})),

		// Actions: Diagnostics
		setLatestDiagnostic: (diagnostic) => set({ latestDiagnostic: diagnostic }),
		addDiagnostic: (diagnostic) =>
			set((state) => ({
				diagnosticHistory: [...state.diagnosticHistory, diagnostic],
			})),
		clearDiagnostics: () =>
			set({ latestDiagnostic: null, diagnosticHistory: [] }),

		// Complex event handling
		handleChatEvent: (event) => {
			const { type, sessionId: eventSessionId, payload } = event;

			// Update session ID if provided
			if (eventSessionId && type !== "chat.session.updated") {
				set({ sessionId: eventSessionId as string });
			}

			switch (type) {
				case "chat.session.updated": {
					handleSessionUpdated(set, payload, eventSessionId);
					break;
				}

				case "chat.message.user": {
					handleMessageUser(set, payload);
					break;
				}

				case "chat.message.part.added": {
					handleMessagePartAdded(set, payload);
					break;
				}

				case "chat.message.delta": {
					handleMessageDelta(set, payload);
					break;
				}

				case "chat.message.final": {
					handleMessageFinal(set, payload);
					break;
				}

				case "chat.permission.requested": {
					handlePermissionRequested(set, payload);
					break;
				}

				case "chat.permission.resolved": {
					handlePermissionResolved(set);
					break;
				}

				case "chat.question.requested": {
					handleQuestionRequested(set, payload);
					break;
				}

				case "chat.question.resolved": {
					handleQuestionResolved(set);
					break;
				}

				case "chat.todo.updated": {
					handleTodoUpdated(set, payload);
					break;
				}

				case "chat.reasoning.part": {
					handleReasoningPart();
					break;
				}

				case "chat.tool.update": {
					handleToolUpdate(set, payload);
					break;
				}

				case "chat.session.status": {
					handleSessionStatus(set, payload);
					break;
				}

				case "chat.diagnostic": {
					handleDiagnostic(set, payload);
					break;
				}
			}
		},

		// Reset
		clear: () => set(initialState),
	}));
}

// Store instances map (one per project)
export const storeInstances = new Map<
	string,
	ReturnType<typeof createChatStore>
>();

/**
 * Get or create a chat store for a project
 */
export function useChatStore(projectId: string): ChatStore {
	if (!storeInstances.has(projectId)) {
		storeInstances.set(projectId, createChatStore());
	}
	const store = storeInstances.get(projectId);
	if (!store) {
		throw new Error(`Failed to create chat store for project ${projectId}`);
	}
	return store();
}

/**
 * Synchronously seed a project's chat store with SSR-fetched state. Returns
 * true if the store was newly created and seeded; returns false if a store
 * already existed (we don't clobber an in-flight session).
 *
 * Called from a useState initializer in the project page wrapper so the very
 * first render of the chat panel sees history already populated.
 */
export function seedChatStoreOnce(
	projectId: string,
	patch: Partial<ChatStore>,
): boolean {
	if (storeInstances.has(projectId)) return false;
	const instance = createChatStore();
	instance.setState((state) => ({ ...state, ...patch }));
	storeInstances.set(projectId, instance);
	return true;
}
