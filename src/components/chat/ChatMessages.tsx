import { useMemo } from "react";
import type { ChatItem } from "@/stores/useChatStore";
import type { Message } from "@/types/message";
import { ChatMessage, type RestoreRequest } from "./ChatMessage";
import type { ToolCall } from "./ToolCallDisplay";
import { ToolCallGroup } from "./ToolCallGroup";

interface ChatMessagesProps {
	items: ChatItem[];
	expandedTools: Set<string>;
	onToggleTool: (id: string) => void;
	onOpenFile?: ((filePath: string) => void) | undefined;
	onRestore?: ((request: RestoreRequest) => void | Promise<void>) | undefined;
}

export function ChatMessages({
	items,
	expandedTools,
	onToggleTool,
	onOpenFile,
	onRestore,
}: ChatMessagesProps) {
	const grouped = useMemo(() => groupConsecutiveTools(items), [items]);

	return (
		<div className="divide-y">
			{grouped.map((item) =>
				item.type === "message" ? (
					<div key={item.id}>
						<ChatMessage message={item.data as Message} onRestore={onRestore} />
					</div>
				) : item.type === "toolGroup" ? (
					<div key={item.id}>
						<ToolCallGroup
							toolCalls={item.data as ToolCall[]}
							expandedTools={expandedTools}
							onToggle={onToggleTool}
							onFileOpen={onOpenFile}
						/>
					</div>
				) : null,
			)}
		</div>
	);
}

function groupConsecutiveTools(
	items: ChatItem[],
): (ChatItem | { type: "toolGroup"; id: string; data: ToolCall[] })[] {
	const grouped: (
		| ChatItem
		| { type: "toolGroup"; id: string; data: ToolCall[] }
	)[] = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (!item) {
			continue;
		}

		if (item.type === "tool") {
			const toolGroup: ToolCall[] = [item.data as ToolCall];

			while (i + 1 < items.length && items[i + 1]?.type === "tool") {
				i++;
				const nextItem = items[i];
				if (nextItem) {
					toolGroup.push(nextItem.data as ToolCall);
				}
			}

			grouped.push({
				type: "toolGroup",
				id: `group_${toolGroup.map((t) => t.id).join("_")}`,
				data: toolGroup,
			});
		} else {
			grouped.push(item);
		}
	}

	return grouped;
}
