import { create } from "zustand";
import { createTextPart, type ImagePart, type Message } from "@/types/message";

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

/**
 * ChatStore manages all chat state for a project
 */
interface ChatStore {
	// State: Messages and tools
	items: ChatItem[];

	// State: Session and OpenCode status
	sessionId: string | null;
	opencodeReady: boolean;
	initialPromptSent: boolean;
	userPromptMessageId: string | null;
	projectPrompt: string | null;

	// State: Model selection
	currentModel: string | null;

	// State: Loading flags
	historyLoaded: boolean;
	presenceLoaded: boolean;
	isStreaming: boolean;

	// State: Pending images
	pendingImages: ImagePart[];
	pendingImageError: string | null;

	// Actions: Session & status
	setSessionId: (id: string | null) => void;
	setOpenCodeReady: (ready: boolean) => void;
	setPresenceLoaded: (loaded: boolean) => void;
	setInitialPromptSent: (sent: boolean) => void;
	setUserPromptMessageId: (id: string | null) => void;
	setProjectPrompt: (prompt: string | null) => void;

	// Actions: Model
	setCurrentModel: (model: string | null) => void;

	// Actions: Loading flags
	setHistoryLoaded: (loaded: boolean) => void;
	setIsStreaming: (streaming: boolean) => void;

	// Actions: Images
	setPendingImages: (images: ImagePart[]) => void;
	setPendingImageError: (error: string | null) => void;

	// Actions: Message management
	setItems: (items: ChatItem[]) => void;
	addItem: (item: ChatItem) => void;
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
	opencodeReady: false,
	initialPromptSent: true, // Assume sent until we know otherwise
	userPromptMessageId: null as string | null,
	projectPrompt: null as string | null,
	currentModel: null as string | null,
	historyLoaded: false,
	presenceLoaded: false,
	isStreaming: false,
	pendingImages: [] as ImagePart[],
	pendingImageError: null as string | null,
};

/**
 * Create a zustand store for a specific project's chat
 */
export function createChatStore() {
	return create<ChatStore>()((set) => ({
		...initialState,

		// Simple setters
		setSessionId: (id) => set({ sessionId: id }),
		setOpenCodeReady: (ready) => set({ opencodeReady: ready }),
		setPresenceLoaded: (loaded) => set({ presenceLoaded: loaded }),
		setInitialPromptSent: (sent) => set({ initialPromptSent: sent }),
		setUserPromptMessageId: (id) => set({ userPromptMessageId: id }),
		setProjectPrompt: (prompt) => set({ projectPrompt: prompt }),
		setCurrentModel: (model) => set({ currentModel: model }),
		setHistoryLoaded: (loaded) => set({ historyLoaded: loaded }),
		setIsStreaming: (streaming) => set({ isStreaming: streaming }),
		setPendingImages: (images) => set({ pendingImages: images }),
		setPendingImageError: (error) => set({ pendingImageError: error }),

		// Message management
		setItems: (items) => set({ items }),
		addItem: (item) => set((state) => ({ items: [...state.items, item] })),
		updateItem: (id, updates) =>
			set((state) => ({
				items: state.items.map((item) =>
					item.id === id
						? { ...item, data: { ...item.data, ...updates } }
						: item,
				),
			})),

		// Complex event handling
		handleChatEvent: (event) => {
			const { type, sessionId: eventSessionId, payload } = event;

			// Update session ID if provided
			if (eventSessionId) {
				set({ sessionId: eventSessionId as string });
			}

			switch (type) {
				case "chat.message.part.added": {
					const { messageId, partId, partType, deltaText } = payload as {
						messageId: string;
						partId: string;
						partType: string;
						deltaText?: string;
					};

					set((state) => {
						const existing = state.items.find(
							(item) => item.type === "message" && item.id === messageId,
						);

						if (existing && existing.type === "message") {
							const msg = existing.data as Message;
							const textPartIdx = msg.parts.findIndex((p) => p.type === "text");

							if (textPartIdx !== -1 && deltaText) {
								// Append delta to existing text part
								const updatedParts = [...msg.parts];
								const textPart = updatedParts[textPartIdx] as any;
								textPart.text = textPart.text + deltaText;
								return {
									items: state.items.map((item) =>
										item.id === messageId
											? {
													...item,
													data: {
														...msg,
														parts: updatedParts,
														isStreaming: true,
													},
												}
											: item,
									),
									isStreaming: true,
								};
							} else if (deltaText) {
								// Create new text part
								const updatedParts = [
									...msg.parts,
									createTextPart(deltaText, partId),
								];
								return {
									items: state.items.map((item) =>
										item.id === messageId
											? {
													...item,
													data: {
														...msg,
														parts: updatedParts,
														isStreaming: true,
													},
												}
											: item,
									),
									isStreaming: true,
								};
							}
						} else if (partType === "text" && deltaText) {
							// New message
							const newItem: ChatItem = {
								type: "message",
								id: messageId,
								data: {
									id: messageId,
									role: "assistant",
									parts: [createTextPart(deltaText, partId)],
									isStreaming: true,
								},
							};
							return {
								items: [...state.items, newItem],
								isStreaming: true,
							};
						}

						return { isStreaming: true };
					});
					break;
				}

				case "chat.message.delta": {
					// Backward compatibility: handle old-style delta events
					const { messageId, deltaText } = payload as {
						messageId: string;
						deltaText: string;
					};

					set((state) => {
						const existing = state.items.find(
							(item) => item.type === "message" && item.id === messageId,
						);

						if (existing && existing.type === "message") {
							const msg = existing.data as Message;
							const textPart = msg.parts[msg.parts.length - 1];

							if (textPart && textPart.type === "text") {
								// Append to existing text part
								const updatedParts = [...msg.parts];
								(updatedParts[updatedParts.length - 1] as any).text =
									textPart.text + deltaText;
								return {
									items: state.items.map((item) =>
										item.id === messageId
											? {
													...item,
													data: {
														...msg,
														parts: updatedParts,
														isStreaming: true,
													},
												}
											: item,
									),
									isStreaming: true,
								};
							} else {
								// Create new text part
								const updatedParts = [...msg.parts, createTextPart(deltaText)];
								return {
									items: state.items.map((item) =>
										item.id === messageId
											? {
													...item,
													data: {
														...msg,
														parts: updatedParts,
														isStreaming: true,
													},
												}
											: item,
									),
									isStreaming: true,
								};
							}
						} else {
							// New message
							const newItem: ChatItem = {
								type: "message",
								id: messageId,
								data: {
									id: messageId,
									role: "assistant",
									parts: [createTextPart(deltaText)],
									isStreaming: true,
								},
							};
							return {
								items: [...state.items, newItem],
								isStreaming: true,
							};
						}
					});
					break;
				}

				case "chat.message.final": {
					const { messageId } = payload as { messageId: string };

					set((state) => {
						const items = state.items.map((item) => {
							if (item.type === "message" && item.id === messageId) {
								const msg = item.data as Message;
								return {
									...item,
									data: { ...msg, isStreaming: false },
								};
							}
							return item;
						});

						return {
							items,
							isStreaming: false,
						};
					});
					break;
				}

				case "chat.reasoning.part": {
					// Reasoning parts handled as visual elements
					// Can be enhanced later to nest within messages
					break;
				}

				case "chat.tool.update": {
					const { toolCallId, name, input, status, output, error } =
						payload as {
							toolCallId: string;
							name: string;
							input?: unknown;
							status: "running" | "success" | "error";
							output?: unknown;
							error?: unknown;
						};

					set((state) => {
						const existingIdx = state.items.findIndex(
							(item) => item.type === "tool" && item.id === toolCallId,
						);

						if (existingIdx !== -1) {
							// Update existing tool
							const items = [...state.items];
							const toolItem = items[existingIdx];
							if (toolItem && toolItem.type === "tool") {
								items[existingIdx] = {
									type: "tool",
									id: toolItem.id,
									data: {
										...(toolItem.data as ToolCall),
										input,
										output,
										error,
										status,
									},
								};
							}
							return { items };
						} else {
							// Create new tool item
							const newItem: ChatItem = {
								type: "tool",
								id: toolCallId,
								data: {
									id: toolCallId,
									name,
									input,
									output,
									error,
									status,
								},
							};
							return { items: [...state.items, newItem] };
						}
					});
					break;
				}

				case "chat.session.status": {
					const { status } = payload as { status: string };
					if (status === "completed" || status === "idle") {
						set({ isStreaming: false });
					}
					break;
				}
			}
		},

		// Reset
		clear: () => set(initialState),
	}));
}

// Store instances map (one per project)
const storeInstances = new Map<string, ReturnType<typeof createChatStore>>();

/**
 * Get or create a chat store for a project
 */
export function useChatStore(projectId: string) {
	if (!storeInstances.has(projectId)) {
		storeInstances.set(projectId, createChatStore());
	}
	return storeInstances.get(projectId)!();
}
