import { useEffect, useRef } from "react";
import { useStartupChecklistItems } from "@/hooks/useStartupChecklistItems";
import { SetupChecklist } from "./SetupChecklist";

interface ContainerStartupDisplayProps {
	projectId: string;
	reason?: "initial" | "restart";
	onComplete?: () => void;
}

export function ContainerStartupDisplay({
	projectId,
	reason = "initial",
	onComplete,
}: ContainerStartupDisplayProps) {
	const { items, allReady, fatalError } = useStartupChecklistItems(projectId);
	const completionScheduledRef = useRef(false);

	useEffect(() => {
		if (!allReady || completionScheduledRef.current) return;
		completionScheduledRef.current = true;
		setTimeout(() => onComplete?.(), 500);
	}, [allReady, onComplete]);

	const heading =
		reason === "restart"
			? "Your environment was stopped. Restarting..."
			: "Starting your environment...";

	return (
		<SetupChecklist heading={heading} items={items} fatalError={fatalError} />
	);
}
