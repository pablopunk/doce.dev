import { useCallback, useState } from "react";
import { useEventSource } from "@/hooks/useEventSource";
import type { MonitorSnapshot } from "@/types/monitor";

export function useMonitorStream() {
	const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);

	const handleSnapshot = useCallback((event: MessageEvent) => {
		try {
			const data = JSON.parse(event.data) as MonitorSnapshot;
			setSnapshot(data);
		} catch {
			// Ignore malformed events
		}
	}, []);

	const { connected, reconnecting } = useEventSource({
		url: "/api/monitor/stream",
		listeners: {
			snapshot: handleSnapshot,
		},
		reconnect: { enabled: true },
	});

	return { snapshot, connected, reconnecting };
}
