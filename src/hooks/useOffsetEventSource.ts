import { useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 1_000;

function useLatestRef<T>(value: T) {
	const ref = useRef(value);
	ref.current = value;
	return ref;
}

interface UseOffsetEventSourceOptions<TData> {
	enabled?: boolean;
	buildUrl: (offset: number) => string;
	eventName: string;
	resetKey: string;
	onOpen?: () => void;
	onError?: () => void;
	parseEvent: (event: MessageEvent) => {
		data: TData;
		nextOffset?: number;
	};
	onData: (data: TData) => void;
}

export function useOffsetEventSource<TData>({
	enabled = true,
	buildUrl,
	eventName,
	resetKey,
	onOpen,
	onError,
	parseEvent,
	onData,
}: UseOffsetEventSourceOptions<TData>) {
	const offsetRef = useRef(0);
	const [connected, setConnected] = useState(false);
	const buildUrlRef = useLatestRef(buildUrl);
	const onOpenRef = useLatestRef(onOpen);
	const onErrorRef = useLatestRef(onError);
	const parseEventRef = useLatestRef(parseEvent);
	const onDataRef = useLatestRef(onData);

	// biome-ignore lint/correctness/useExhaustiveDependencies: resetKey intentionally triggers cursor reset without storing it in state
	useEffect(() => {
		offsetRef.current = 0;
	}, [resetKey]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: callback refs intentionally avoid reconnecting on every render
	useEffect(() => {
		if (!enabled) {
			setConnected(false);
			return;
		}

		let eventSource: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let isUnmounted = false;

		const clearReconnectTimer = () => {
			if (!reconnectTimer) return;
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		};

		const connect = () => {
			if (isUnmounted) return;
			eventSource = new EventSource(buildUrlRef.current(offsetRef.current));
			const currentEventSource = eventSource;

			currentEventSource.addEventListener("open", () => {
				setConnected(true);
				onOpenRef.current?.();
			});

			currentEventSource.addEventListener(eventName, (event) => {
				const parsed = parseEventRef.current(event as MessageEvent);
				if (typeof parsed.nextOffset === "number") {
					offsetRef.current = parsed.nextOffset;
				}
				onDataRef.current(parsed.data);
			});

			currentEventSource.addEventListener("error", () => {
				setConnected(false);
				onErrorRef.current?.();
				currentEventSource.close();
				if (eventSource === currentEventSource) {
					eventSource = null;
				}
				if (!isUnmounted) {
					clearReconnectTimer();
					reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
				}
			});
		};

		connect();

		return () => {
			isUnmounted = true;
			setConnected(false);
			clearReconnectTimer();
			eventSource?.close();
		};
	}, [enabled, eventName, resetKey]);

	return { connected };
}
