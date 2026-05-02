import { ChevronDown, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Message, TextPart } from "@/types/message";

export interface RolledMessage {
	id: string;
	text: string;
}

interface RevertDockProps {
	items: RolledMessage[];
	disabled?: boolean;
	onRestoreUpTo: (id: string) => void | Promise<void>;
	onCancel: () => void | Promise<void>;
}

export function RevertDock({
	items,
	disabled,
	onRestoreUpTo,
	onCancel,
}: RevertDockProps) {
	const [collapsed, setCollapsed] = useState(true);

	if (items.length === 0) return null;

	const total = items.length;
	const summary =
		total === 1 ? "1 message rolled back" : `${total} messages rolled back`;
	const preview = items[0]?.text ?? "";

	return (
		<div className="border-t bg-muted/20 p-3">
			<div className="mx-auto max-w-3xl rounded-lg border bg-background">
				<button
					type="button"
					className="flex w-full items-center gap-2 px-3 py-2 text-left"
					onClick={() => setCollapsed((v) => !v)}
				>
					<span className="shrink-0 text-sm font-medium">{summary}</span>
					{collapsed && preview && (
						<span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
							{preview}
						</span>
					)}
					<span className="ml-auto flex shrink-0 items-center gap-1">
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="Cancel restore"
							onClick={(e) => {
								e.stopPropagation();
								void onCancel();
							}}
							disabled={disabled}
						>
							<X className="h-4 w-4" />
						</Button>
						<ChevronDown
							className={`h-4 w-4 transition-transform ${
								collapsed ? "rotate-180" : "rotate-0"
							}`}
						/>
					</span>
				</button>

				{!collapsed && (
					<div className="max-h-48 overflow-y-auto px-3 pb-3">
						<ul className="flex flex-col gap-1.5">
							{items.map((item) => (
								<li
									key={item.id}
									className="flex items-center gap-2 py-1 min-w-0"
								>
									<span className="min-w-0 flex-1 truncate text-sm">
										{item.text}
									</span>
									<Button
										size="sm"
										variant="secondary"
										className="shrink-0"
										disabled={disabled}
										onClick={() => void onRestoreUpTo(item.id)}
									>
										<RotateCcw className="h-3 w-3 mr-1" />
										Restore
									</Button>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}

export function buildRolledMessages(
	rawItems: Array<{ type: string; id: string; data?: unknown }>,
	revertMessageId: string | null,
): RolledMessage[] {
	if (!revertMessageId) return [];
	const boundary = rawItems.findIndex(
		(i) => i.type === "message" && i.id === revertMessageId,
	);
	if (boundary < 0) return [];
	const out: RolledMessage[] = [];
	for (let i = boundary; i < rawItems.length; i++) {
		const item = rawItems[i];
		if (!item || item.type !== "message" || !item.data) continue;
		const data = item.data as Message;
		if (data.role !== "user") continue;
		const text = data.parts
			.filter((p): p is TextPart => p.type === "text")
			.map((p) => p.text)
			.join("\n\n");
		out.push({ id: item.id, text: text.trim() || "(empty message)" });
	}
	return out;
}
