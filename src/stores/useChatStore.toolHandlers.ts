import type { OpencodeDiagnostic } from "@/server/opencode/diagnostics";
import type { ChatItem, ChatStore, ToolCall } from "./useChatStore";

type ChatStoreSet = (
	partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>),
) => void;

export function handleReasoningPart() {
	// Reasoning parts handled as visual elements
	// Can be enhanced later to nest within messages
}

export function handleToolUpdate(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	const { toolCallId, name, input, status, output, error } = payload as {
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
}

export function handleDiagnostic(
	set: ChatStoreSet,
	payload: Record<string, unknown>,
) {
	const { diagnostic } = payload as { diagnostic: OpencodeDiagnostic };
	set((state) => ({
		latestDiagnostic: diagnostic,
		diagnosticHistory: [...state.diagnosticHistory, diagnostic],
		isStreaming: false,
	}));
}
