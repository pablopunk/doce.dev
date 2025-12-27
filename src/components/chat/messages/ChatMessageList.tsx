import { Loader2 } from "lucide-react";
import type { Message } from "@/types/message";
import { ChatMessage } from "../ChatMessage";
import type { ToolCall } from "../ToolCallDisplay";
import { ToolCallGroup } from "../ToolCallGroup";

interface ChatItem {
	type: "message" | "tool";
	id: string;
	data: Message | ToolCall;
}

type GroupedItem =
	| ChatItem
	| { type: "toolGroup"; id: string; data: ToolCall[] };

interface ChatMessageListProps {
	items: ChatItem[];
	isEmpty: boolean;
	opencodeReady: boolean;
	expandedTools: Set<string>;
	onToggleTool: (id: string) => void;
	onOpenFile?: (filePath: string) => void;
	scrollRef: React.RefObject<HTMLDivElement>;
	onScroll: () => void;
}

function groupConsecutiveTools(items: ChatItem[]): GroupedItem[] {
	const result: GroupedItem[] = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];

		if (item?.type === "tool") {
			// Collect consecutive tool items
			const toolGroup: ToolCall[] = [item.data as ToolCall];

			while (i + 1 < items.length && items[i + 1]?.type === "tool") {
				i++;
				const nextItem = items[i];
				if (nextItem) {
					toolGroup.push(nextItem.data as ToolCall);
				}
			}

			result.push({
				type: "toolGroup",
				id: `group-${toolGroup[0]?.id ?? "unknown"}`,
				data: toolGroup,
			});
		} else if (item) {
			result.push(item);
		}
	}

	return result;
}

export function ChatMessageList({
	items,
	isEmpty,
	opencodeReady,
	expandedTools,
	onToggleTool,
	onOpenFile,
	scrollRef,
	onScroll,
}: ChatMessageListProps) {
	return (
		<div className="flex-1 overflow-y-auto" ref={scrollRef} onScroll={onScroll}>
			{isEmpty ? (
				<div className="flex items-center justify-center h-full text-muted-foreground">
					{opencodeReady ? (
						<p>Send a message to start chatting</p>
					) : (
						<div className="flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							<p>Waiting for opencode...</p>
						</div>
					)}
				</div>
			) : (
				<div className="divide-y">
					{groupConsecutiveTools(items).map((item) =>
						item.type === "message" ? (
							<ChatMessage key={item.id} message={item.data as Message} />
						) : item.type === "toolGroup" ? (
							<ToolCallGroup
								key={item.id}
								toolCalls={item.data as ToolCall[]}
								expandedTools={expandedTools}
								onToggle={onToggleTool}
								onFileOpen={onOpenFile}
							/>
						) : null,
					)}
				</div>
			)}
		</div>
	);
}
