import type { OpencodeDiagnostic } from "@/server/opencode/diagnostics";
import type {
	ChatItem,
	ChatStore,
	PendingPermissionRequest,
	PendingQuestionRequest,
	TodoItem,
	ToolCall,
} from "@/stores/useChatStore";
import {
	createErrorPart,
	createImagePart,
	createReasoningPart,
	createTextPart,
} from "@/types/message";

export interface MockChatStoreOptions {
	initialItems?: ChatItem[];
	initialOpenCodeReady?: boolean;
	initialStreaming?: boolean;
	initialTodos?: TodoItem[];
	initialPendingPermission?: PendingPermissionRequest | null;
	initialPendingQuestion?: PendingQuestionRequest | null;
}

export type MockStoreListener = () => void;

export interface MockChatStore extends ChatStore {
	subscribe: (listener: MockStoreListener) => () => void;
	listeners: Set<MockStoreListener>;
}

export function createMockChatStore(
	options: MockChatStoreOptions = {},
): MockChatStore {
	const listeners = new Set<MockStoreListener>();

	const notifyListeners = () => {
		listeners.forEach((listener) => {
			listener();
		});
	};

	const state: MockChatStore = {
		// State: Messages and tools
		items: options.initialItems ?? [],

		// State: Session and OpenCode status
		sessionId: "mock-session-id",
		opencodeReady: options.initialOpenCodeReady ?? true,
		initialPromptSent: true,
		userPromptMessageId: null,
		projectPrompt: null,

		// State: Model selection
		currentModel: {
			providerID: "anthropic",
			modelID: "claude-sonnet-4-20250514",
		},

		// State: Loading flags
		historyLoaded: true,
		presenceLoaded: true,
		isStreaming: options.initialStreaming ?? false,

		// State: Pending images
		pendingImages: [],
		pendingImageError: null,

		// State: Diagnostics
		latestDiagnostic: null,
		diagnosticHistory: [],

		// State: Blocking requests and todos
		pendingQuestion: options.initialPendingQuestion ?? null,
		pendingPermission: options.initialPendingPermission ?? null,
		todos: options.initialTodos ?? [],

		// Subscription system
		listeners,
		subscribe: (listener: MockStoreListener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},

		// Actions: Session & status
		setSessionId: (id: string | null) => {
			state.sessionId = id;
			notifyListeners();
		},
		setOpenCodeReady: (ready: boolean) => {
			state.opencodeReady = ready;
			notifyListeners();
		},
		setPresenceLoaded: (loaded: boolean) => {
			state.presenceLoaded = loaded;
			notifyListeners();
		},
		setInitialPromptSent: (sent: boolean) => {
			state.initialPromptSent = sent;
			notifyListeners();
		},
		setUserPromptMessageId: (id: string | null) => {
			state.userPromptMessageId = id;
			notifyListeners();
		},
		setProjectPrompt: (prompt: string | null) => {
			state.projectPrompt = prompt;
			notifyListeners();
		},

		// Actions: Model
		setCurrentModel: (
			model: { providerID: string; modelID: string } | null,
		) => {
			state.currentModel = model;
			notifyListeners();
		},

		// Actions: Loading flags
		setHistoryLoaded: (loaded: boolean) => {
			state.historyLoaded = loaded;
			notifyListeners();
		},
		setIsStreaming: (streaming: boolean) => {
			state.isStreaming = streaming;
			notifyListeners();
		},

		// Actions: Images
		setPendingImages: (images: import("@/types/message").ImagePart[]) => {
			state.pendingImages = images;
			notifyListeners();
		},
		setPendingImageError: (error: string | null) => {
			state.pendingImageError = error;
			notifyListeners();
		},

		// Actions: Diagnostics
		setLatestDiagnostic: (diagnostic: OpencodeDiagnostic | null) => {
			state.latestDiagnostic = diagnostic;
			notifyListeners();
		},
		addDiagnostic: (diagnostic: OpencodeDiagnostic) => {
			state.diagnosticHistory = [...state.diagnosticHistory, diagnostic];
			notifyListeners();
		},
		clearDiagnostics: () => {
			state.latestDiagnostic = null;
			state.diagnosticHistory = [];
			notifyListeners();
		},
		setPendingQuestion: (request: PendingQuestionRequest | null) => {
			state.pendingQuestion = request;
			notifyListeners();
		},
		setPendingPermission: (request: PendingPermissionRequest | null) => {
			state.pendingPermission = request;
			notifyListeners();
		},
		setTodos: (todos: TodoItem[]) => {
			state.todos = todos;
			notifyListeners();
		},

		// Actions: Message management
		setItems: (items: ChatItem[]) => {
			state.items = items;
			notifyListeners();
		},
		addItem: (item: ChatItem) => {
			state.items = [...state.items, item];
			notifyListeners();
		},
		removeItem: (id: string) => {
			state.items = state.items.filter((item: ChatItem) => item.id !== id);
			notifyListeners();
		},
		updateItem: (id: string, updates: Partial<ChatItem["data"]>) => {
			state.items = state.items.map((item: ChatItem) =>
				item.id === id ? { ...item, data: { ...item.data, ...updates } } : item,
			);
			notifyListeners();
		},

		// Actions: Event handling (simplified for mock)
		handleChatEvent: () => {
			// Mock implementation - can be extended for testing specific event flows
		},

		// Actions: Reset
		clear: () => {
			state.items = [];
			state.opencodeReady = true;
			state.isStreaming = false;
			state.pendingQuestion = null;
			state.pendingPermission = null;
			state.todos = [];
			state.latestDiagnostic = null;
			notifyListeners();
		},
	};

	return state;
}

// Helper functions to create mock data
export function createMockTextMessage(
	id: string,
	role: "user" | "assistant",
	text: string,
	options?: { isStreaming?: boolean },
): ChatItem {
	return {
		type: "message",
		id,
		data: {
			id,
			role,
			parts: [createTextPart(text)],
			isStreaming: options?.isStreaming ?? false,
			localStatus: "sent",
		},
	};
}

export function createMockToolCall(
	id: string,
	name: string,
	input: unknown,
	status: ToolCall["status"],
	output?: unknown,
	error?: unknown,
): ChatItem {
	return {
		type: "tool",
		id,
		data: {
			id,
			name,
			input,
			output,
			error,
			status,
		},
	};
}

export function createMockErrorMessage(
	id: string,
	role: "user" | "assistant",
	text: string,
	errorMessage: string,
): ChatItem {
	return {
		type: "message",
		id,
		data: {
			id,
			role,
			parts: [createTextPart(text), createErrorPart(errorMessage)],
			localStatus: "sent",
		},
	};
}

export function createMockMessageWithReasoning(
	id: string,
	role: "user" | "assistant",
	text: string,
	reasoning: string,
): ChatItem {
	return {
		type: "message",
		id,
		data: {
			id,
			role,
			parts: [createReasoningPart(reasoning), createTextPart(text)],
			localStatus: "sent",
		},
	};
}

export function createMockMessageWithImage(
	id: string,
	role: "user" | "assistant",
	text: string,
	imageFilename: string,
): ChatItem {
	return {
		type: "message",
		id,
		data: {
			id,
			role,
			parts: [
				createImagePart(
					"data:image/png;base64,iVBORw0KGgo=",
					imageFilename,
					"image/png",
					1024,
				),
				createTextPart(text),
			],
			localStatus: "sent",
		},
	};
}

export function createMockTodo(
	content: string,
	status: string,
	priority: string,
): TodoItem {
	return { content, status, priority };
}

export function createMockPermissionRequest(
	permission: string,
	patterns: string[],
): PendingPermissionRequest {
	return {
		requestId: `perm_${Date.now()}`,
		sessionId: "mock-session-id",
		permission,
		patterns,
	};
}

export function createMockQuestionRequest(
	questions: Array<{
		header: string;
		question: string;
		options: Array<{ label: string; description: string }>;
		multiple?: boolean;
	}>,
): PendingQuestionRequest {
	return {
		requestId: `q_${Date.now()}`,
		sessionId: "mock-session-id",
		questions,
	};
}

export function createMockDiagnostic(
	category:
		| "auth"
		| "provider_model"
		| "runtime_unreachable"
		| "timeout"
		| "unknown",
	title: string,
	message: string,
	remediation: Array<{ id: string; label: string; description: string }>,
): OpencodeDiagnostic {
	return {
		timestamp: new Date().toISOString(),
		source: "unknown",
		category,
		title,
		message,
		remediation,
		isRetryable: true,
		technicalDetails: undefined,
	};
}
