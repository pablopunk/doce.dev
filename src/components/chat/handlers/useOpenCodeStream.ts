import { useEffect, useRef } from "react";
import { useEventSource } from "@/hooks/useEventSource";
import { useLiveState } from "@/hooks/useLiveState";

interface StreamedEvent {
	type: string;
	projectId: string;
	sessionId?: string;
	payload: Record<string, unknown>;
}

export function useOpenCodeStream(
	projectId: string,
	opencodeReady: boolean,
	onEvent: (event: StreamedEvent) => void,
) {
	const loadedSessionRef = useRef<string | null>(null);
	const { data: liveData } = useLiveState(`/api/projects/${projectId}/live`);

	useEffect(() => {
		if (!liveData?.bootstrapSessionId) {
			return;
		}

		if (loadedSessionRef.current === liveData.bootstrapSessionId) {
			return;
		}

		loadedSessionRef.current = liveData.bootstrapSessionId;
		onEvent({
			type: "session.load",
			projectId,
			sessionId: liveData.bootstrapSessionId,
			payload: {
				userPromptMessageId: liveData.userPromptMessageId,
				prompt: liveData.prompt,
				model: null,
				bootstrapSessionId: liveData.bootstrapSessionId,
			},
		});
	}, [liveData, onEvent, projectId]);

	useEventSource({
		enabled: opencodeReady,
		url: `/api/projects/${projectId}/opencode/event`,
		listeners: {
			"chat.event": (event) => {
				try {
					const data = JSON.parse(event.data) as StreamedEvent;
					onEvent(data);
				} catch (error) {
					console.error("Failed to parse opencode event:", error);
				}
			},
		},
	});
}
