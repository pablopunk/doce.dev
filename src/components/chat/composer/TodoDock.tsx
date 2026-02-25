import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TodoItem } from "@/stores/useChatStore";

interface TodoDockProps {
	todos: TodoItem[];
}

export function TodoDock({ todos }: TodoDockProps) {
	const [collapsed, setCollapsed] = useState(false);

	const { completed, total } = useMemo(() => {
		const completedItems = todos.filter(
			(todo) => todo.status === "completed" || todo.status === "cancelled",
		).length;
		return { completed: completedItems, total: todos.length };
	}, [todos]);

	if (todos.length === 0) {
		return null;
	}

	return (
		<div className="border-t bg-muted/20 p-3">
			<div className="mx-auto max-w-3xl rounded-lg border bg-background p-3">
				<div className="mb-2 flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						{completed} of {total} tasks completed
					</p>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={() => setCollapsed((value) => !value)}
					>
						<ChevronDown
							className={`h-4 w-4 transition-transform ${
								collapsed ? "rotate-180" : "rotate-0"
							}`}
						/>
					</Button>
				</div>

				{!collapsed && (
					<div className="space-y-2">
						{todos.map((todo, index) => (
							<div
								key={`${todo.content}-${index}`}
								className="flex items-start gap-2"
							>
								<div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground" />
								<p
									className={`text-sm ${
										todo.status === "completed" || todo.status === "cancelled"
											? "text-muted-foreground line-through"
											: "text-foreground"
									}`}
								>
									{todo.content}
								</p>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
