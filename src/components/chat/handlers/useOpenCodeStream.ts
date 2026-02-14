import { useCallback, useEffect, useRef } from "react";

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
	const eventSourceRef = useRef<EventSource | null>(null);
	const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Poll for new sessions (in case SSE isn't connected yet)
	const pollForSession = useCallback(async () => {
		try {
			const response = await fetch(
				`/api/projects/${projectId}/presence?includeAll=true`,
			);
			if (!response.ok) return;

			const data = (await response.json()) as {
				sessions?: Array<{
					id: string;
					userPromptMessageId: string | null;
					prompt: string;
					model: string | null;
					bootstrapSessionId: string | null;
				}>;
			};

			if (data.sessions && data.sessions.length > 0) {
				const session = data.sessions[0];
				if (session) {
					onEvent({
						type: "session.load",
						projectId,
						sessionId: session.id,
						payload: {
							userPromptMessageId: session.userPromptMessageId,
							prompt: session.prompt,
							model: session.model,
							bootstrapSessionId: session.bootstrapSessionId,
						},
					});
				}
			}
		} catch (error) {
			console.error({ error }, "Failed to poll for session");
		}
	}, [projectId, onEvent]);

	// Estab lish EventSource connection
	useEffect(() => {
		if (!opencodeReady) {
			// Clean up on disconnect
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
				pollIntervalRef.current = null;
			}
			return;
		}

		// Start polling
		pollIntervalRef.current = setInterval(pollForSession, 2000);
		pollForSession(); // Immediate first poll

		// Open SSE connection
		const eventSource = new EventSource(
			`/api/projects/${projectId}/opencode/event`,
		);
		eventSourceRef.current = eventSource;

		const handleChatEvent = (e: Event) => {
			const event = e as MessageEvent;
			try {
				const data = JSON.parse(event.data) as StreamedEvent;
				onEvent(data);
			} catch (error) {
				console.error({ error }, "Failed to parse opencode event");
			}
		};

		eventSource.addEventListener("chat.event", handleChatEvent);

		eventSource.onerror = () => {
			console.error("EventSource error, closing connection");
			eventSource.close();
		};

		return () => {
			// Explicitly remove event listener
			eventSource.removeEventListener("chat.event", handleChatEvent);

			// Close connection
			if (eventSourceRef.current === eventSource) {
				eventSource.close();
				eventSourceRef.current = null;
			}

			// Clear polling interval
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
				pollIntervalRef.current = null;
			}
		};
	}, [projectId, opencodeReady, onEvent, pollForSession]);
}
