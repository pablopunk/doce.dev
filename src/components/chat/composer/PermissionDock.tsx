import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingPermissionRequest } from "@/stores/useChatStore";

interface PermissionDockProps {
	request: PendingPermissionRequest;
	onDecide: (reply: "once" | "always" | "reject") => void;
}

export function PermissionDock({ request, onDecide }: PermissionDockProps) {
	return (
		<div className="border-t bg-muted/30 p-4">
			<div className="mx-auto max-w-3xl rounded-lg border bg-background p-4">
				<div className="mb-2 flex items-center gap-2 text-sm font-medium">
					<ShieldAlert className="h-4 w-4 text-status-warning" />
					Permission request
				</div>
				<p className="text-sm text-muted-foreground">
					The assistant wants to use <strong>{request.permission}</strong>
				</p>
				{request.patterns.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-2">
						{request.patterns.map((pattern) => (
							<code
								key={pattern}
								className="rounded bg-muted px-2 py-1 text-xs"
							>
								{pattern}
							</code>
						))}
					</div>
				)}
				<div className="mt-4 flex flex-wrap justify-end gap-2">
					<Button variant="ghost" onClick={() => onDecide("reject")}>
						Deny
					</Button>
					<Button variant="secondary" onClick={() => onDecide("always")}>
						Allow always
					</Button>
					<Button onClick={() => onDecide("once")}>Allow once</Button>
				</div>
			</div>
		</div>
	);
}
