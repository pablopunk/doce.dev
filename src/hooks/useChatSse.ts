import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ChatStore } from "@/stores/useChatStore";

const MAX_SSE_RECONNECT_DELAY_MS = 10_000;
const MAX_SSE_RECONNECT_ATTEMPTS = 12;
const SSE_INACTIVITY_TIMEOUT_MS = 45_000;

interface UseChatSseOptions {
	projectId: string;
	opencodeReady: boolean;
	handleChatEvent: ChatStore["handleChatEvent"];
	setIsStreaming: (value: boolean) => void;
	showRequestError: (title: string, error: unknown) => void;
}

export function useChatSse({
	projectId,
	opencodeReady,
	handleChatEvent,
	setIsStreaming,
	showRequestError,
}: UseChatSseOptions) {
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const reconnectAttemptsRef = useRef(0);
	const streamDegradedRef = useRef(false);

	// SSE events
	useEffect(() => {
		if (!opencodeReady) return;

		const clearInactivityTimer = () => {
			if (inactivityTimeoutRef.current) {
				clearTimeout(inactivityTimeoutRef.current);
				inactivityTimeoutRef.current = null;
			}
		};

		const scheduleInactivityTimeout = () => {
			clearInactivityTimer();
			inactivityTimeoutRef.current = setTimeout(() => {
				setIsStreaming(false);
				if (!streamDegradedRef.current) {
					streamDegradedRef.current = true;
					toast.warning("Connection looks unstable", {
						description:
							"The assistant stream stalled. Reconnecting automatically...",
					});
				}
			}, SSE_INACTIVITY_TIMEOUT_MS);
		};

		const connect = () => {
			const eventSource = new EventSource(
				`/api/projects/${projectId}/opencode/event`,
			);
			eventSourceRef.current = eventSource;
			scheduleInactivityTimeout();

			const handler = (e: Event) => {
				try {
					scheduleInactivityTimeout();
					handleChatEvent(JSON.parse((e as MessageEvent).data));
					streamDegradedRef.current = false;
				} catch (error) {
					showRequestError("Failed to process live event", error);
				}
			};

			eventSource.addEventListener("chat.event", handler);
			eventSource.onopen = () => {
				reconnectAttemptsRef.current = 0;
				streamDegradedRef.current = false;
				scheduleInactivityTimeout();
			};

			eventSource.onerror = () => {
				clearInactivityTimer();
				if (eventSourceRef.current === eventSource) {
					eventSource.close();
					eventSourceRef.current = null;
				}

				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
				}

				const attempt = reconnectAttemptsRef.current;
				const delay = Math.min(
					MAX_SSE_RECONNECT_DELAY_MS,
					1_000 * 2 ** attempt + Math.floor(Math.random() * 250),
				);
				reconnectAttemptsRef.current = attempt + 1;

				if (reconnectAttemptsRef.current > MAX_SSE_RECONNECT_ATTEMPTS) {
					setIsStreaming(false);
					if (!streamDegradedRef.current) {
						streamDegradedRef.current = true;
						toast.error("Live updates disconnected", {
							description:
								"Please refresh the page if reconnection does not recover shortly.",
						});
					}
				}

				reconnectTimeoutRef.current = setTimeout(() => {
					if (opencodeReady) {
						connect();
					}
				}, delay);
			};

			return () => {
				clearInactivityTimer();
				eventSource.removeEventListener("chat.event", handler);
				eventSource.close();
			};
		};

		const cleanup = connect();
		return () => {
			cleanup();
			clearInactivityTimer();
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}
			eventSourceRef.current = null;
		};
	}, [
		handleChatEvent,
		opencodeReady,
		projectId,
		setIsStreaming,
		showRequestError,
	]);
}
