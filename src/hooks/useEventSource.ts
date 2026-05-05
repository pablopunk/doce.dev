import { useEffect, useRef, useState } from "react";

const DEFAULT_RECONNECT_BASE_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 10_000;
const DEFAULT_RECONNECT_JITTER_MS = 250;

export interface EventSourceListenerMap {
	[eventName: string]: (event: MessageEvent) => void;
}

interface ReconnectOptions {
	enabled?: boolean;
	baseDelayMs?: number;
	maxDelayMs?: number;
	jitterMs?: number;
}

interface UseEventSourceOptions {
	url: string | null;
	enabled?: boolean;
	listeners?: EventSourceListenerMap;
	onOpen?: () => void;
	onError?: () => void;
	reconnect?: ReconnectOptions;
}

interface UseEventSourceResult {
	connected: boolean;
	reconnecting: boolean;
}

interface WaitForEventSourceOptions {
	successEvents: string[];
	failureEvents?: string[];
}

function useLatestRef<T>(value: T) {
	const ref = useRef(value);
	ref.current = value;
	return ref;
}

function getReconnectDelay(
	attempt: number,
	reconnect?: ReconnectOptions,
): number {
	const baseDelayMs = reconnect?.baseDelayMs ?? DEFAULT_RECONNECT_BASE_MS;
	const maxDelayMs = reconnect?.maxDelayMs ?? DEFAULT_RECONNECT_MAX_MS;
	const jitterMs = reconnect?.jitterMs ?? DEFAULT_RECONNECT_JITTER_MS;
	const backoffMs = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
	return backoffMs + Math.floor(Math.random() * jitterMs);
}

export function useEventSource({
	url,
	enabled = true,
	listeners = {},
	onOpen,
	onError,
	reconnect,
}: UseEventSourceOptions): UseEventSourceResult {
	const listenersRef = useLatestRef(listeners);
	const onOpenRef = useLatestRef(onOpen);
	const onErrorRef = useLatestRef(onError);
	const reconnectRef = useLatestRef(reconnect);
	const [connected, setConnected] = useState(false);
	const [reconnecting, setReconnecting] = useState(false);
	const eventNamesKey = Object.keys(listeners).sort().join("\0");

	// biome-ignore lint/correctness/useExhaustiveDependencies: callback refs intentionally avoid reconnecting on every render
	useEffect(() => {
		if (!enabled || !url) {
			setConnected(false);
			setReconnecting(false);
			return;
		}

		let eventSource: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let isUnmounted = false;
		let reconnectAttempt = 0;

		const clearReconnectTimer = () => {
			if (!reconnectTimer) return;
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		};

		const connect = () => {
			if (isUnmounted) return;

			eventSource = new EventSource(url);
			const currentEventSource = eventSource;

			const removeListeners = Object.keys(listenersRef.current).map(
				(eventName) => {
					const wrappedHandler = (event: Event) => {
						listenersRef.current[eventName]?.(event as MessageEvent);
					};
					currentEventSource.addEventListener(eventName, wrappedHandler);
					return () => {
						currentEventSource.removeEventListener(eventName, wrappedHandler);
					};
				},
			);

			currentEventSource.onopen = () => {
				reconnectAttempt = 0;
				setConnected(true);
				setReconnecting(false);
				onOpenRef.current?.();
			};

			currentEventSource.onerror = () => {
				for (const remove of removeListeners) {
					remove();
				}
				currentEventSource.close();
				if (eventSource === currentEventSource) {
					eventSource = null;
				}
				setConnected(false);
				onErrorRef.current?.();

				if (!reconnectRef.current?.enabled || isUnmounted) {
					setReconnecting(false);
					return;
				}

				setReconnecting(true);
				clearReconnectTimer();
				reconnectTimer = setTimeout(
					() => {
						reconnectTimer = null;
						reconnectAttempt += 1;
						connect();
					},
					getReconnectDelay(reconnectAttempt, reconnectRef.current),
				);
			};
		};

		connect();

		return () => {
			isUnmounted = true;
			clearReconnectTimer();
			setConnected(false);
			setReconnecting(false);
			eventSource?.close();
			eventSource = null;
		};
	}, [enabled, eventNamesKey, url]);

	return { connected, reconnecting };
}

export async function waitForEventSource(
	url: string,
	options: WaitForEventSourceOptions,
) {
	return await new Promise<string>((resolve) => {
		const eventSource = new EventSource(url);
		let settled = false;

		const settle = (result: string) => {
			if (settled) return;
			settled = true;
			eventSource.close();
			resolve(result);
		};

		for (const eventName of options.successEvents) {
			eventSource.addEventListener(eventName, () => settle(eventName));
		}

		for (const eventName of options.failureEvents ?? []) {
			eventSource.addEventListener(eventName, () => settle(eventName));
		}

		eventSource.onerror = () => settle("error");
	});
}
