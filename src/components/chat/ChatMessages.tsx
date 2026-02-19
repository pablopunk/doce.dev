import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import type { ChatItem } from "@/stores/useChatStore";
import type { Message } from "@/types/message";
import { ChatMessage } from "./ChatMessage";
import type { ToolCall } from "./ToolCallDisplay";
import { ToolCallGroup } from "./ToolCallGroup";

interface ChatMessagesProps {
	items: ChatItem[];
	expandedTools: Set<string>;
	onToggleTool: (id: string) => void;
	onOpenFile?: ((filePath: string) => void) | undefined;
}

export function ChatMessages({
	items,
	expandedTools,
	onToggleTool,
	onOpenFile,
}: ChatMessagesProps) {
	const grouped = useMemo(() => groupConsecutiveTools(items), [items]);

	return (
		<div className="divide-y">
			<AnimatePresence mode="popLayout">
				{grouped.map((item) =>
					item.type === "message" ? (
						<motion.div
							key={item.id}
							layout
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15, ease: "easeOut" }}
						>
							<ChatMessage message={item.data as Message} />
						</motion.div>
					) : item.type === "toolGroup" ? (
						<motion.div
							key={item.id}
							layout
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15, ease: "easeOut" }}
						>
							<ToolCallGroup
								toolCalls={item.data as ToolCall[]}
								expandedTools={expandedTools}
								onToggle={onToggleTool}
								onFileOpen={onOpenFile}
							/>
						</motion.div>
					) : null,
				)}
			</AnimatePresence>
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
