/**
 * useLiveState — shared robust SSE consumer hook.
 *
 * Multiple components on the project page need the same live state. Browser
 * EventSource connections count against the per-origin connection limit, so this
 * hook shares one EventSource per URL and fans snapshots out to subscribers.
 */

import { useEffect, useState } from "react";
import type { LiveEvent, ProjectLiveState } from "@/types/live";

const HEARTBEAT_TIMEOUT_MS = 30_000;
const VISIBILITY_GRACE_MS = 30_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 10_000;
const BACKOFF_JITTER = 0.3;

export interface LiveStateResult {
	data: ProjectLiveState | null;
	stale: boolean;
	connected: boolean;
	reconnecting: boolean;
}

type Subscriber = (state: LiveStateResult) => void;

interface SharedLiveConnection {
	url: string;
	state: LiveStateResult;
	subscribers: Set<Subscriber>;
	es: EventSource | null;
	heartbeatTimer: ReturnType<typeof setTimeout> | null;
	reconnectTimer: ReturnType<typeof setTimeout> | null;
	visibilityTimer: ReturnType<typeof setTimeout> | null;
	attempt: number;
	intentional: boolean;
}

const connections = new Map<string, SharedLiveConnection>();
let visibilityListenerInstalled = false;

function jitter(ms: number): number {
	const range = ms * BACKOFF_JITTER;
	return ms + (Math.random() * range * 2 - range);
}

function nextBackoff(attempt: number): number {
	const base = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_CAP_MS);
	return jitter(base);
}

function createConnection(url: string): SharedLiveConnection {
	return {
		url,
		state: {
			data: null,
			stale: false,
			connected: false,
			reconnecting: false,
		},
		subscribers: new Set(),
		es: null,
		heartbeatTimer: null,
		reconnectTimer: null,
		visibilityTimer: null,
		attempt: 0,
		intentional: false,
	};
}

function getConnection(url: string): SharedLiveConnection {
	const existing = connections.get(url);
	if (existing) return existing;

	const connection = createConnection(url);
	connections.set(url, connection);
	return connection;
}

function setConnectionState(
	connection: SharedLiveConnection,
	patch: Partial<LiveStateResult>,
): void {
	connection.state = { ...connection.state, ...patch };
	for (const subscriber of connection.subscribers) {
		subscriber(connection.state);
	}
}

function clearHeartbeatTimer(connection: SharedLiveConnection): void {
	if (!connection.heartbeatTimer) return;
	clearTimeout(connection.heartbeatTimer);
	connection.heartbeatTimer = null;
}

function resetHeartbeatTimer(connection: SharedLiveConnection): void {
	clearHeartbeatTimer(connection);
	setConnectionState(connection, { stale: false });
	connection.heartbeatTimer = setTimeout(() => {
		setConnectionState(connection, { stale: true });
	}, HEARTBEAT_TIMEOUT_MS);
}

function disconnect(
	connection: SharedLiveConnection,
	intentional: boolean,
): void {
	connection.intentional = intentional;
	if (connection.es) {
		connection.es.close();
		connection.es = null;
	}
	clearHeartbeatTimer(connection);
	if (connection.reconnectTimer) {
		clearTimeout(connection.reconnectTimer);
		connection.reconnectTimer = null;
	}
	setConnectionState(connection, {
		connected: false,
		reconnecting: intentional ? false : connection.state.reconnecting,
	});
}

function connect(connection: SharedLiveConnection): void {
	if (connection.es || document.visibilityState === "hidden") return;

	const es = new EventSource(connection.url);
	connection.es = es;
	connection.intentional = false;

	es.addEventListener("state", (e: MessageEvent) => {
		try {
			const event = JSON.parse(e.data) as LiveEvent["data"];
			connection.attempt = 0;
			setConnectionState(connection, {
				data: event,
				connected: true,
				reconnecting: false,
				stale: false,
			});
			resetHeartbeatTimer(connection);
		} catch {
			// Ignore malformed events and wait for the next snapshot.
		}
	});

	es.onopen = () => {
		setConnectionState(connection, { connected: true, reconnecting: false });
		resetHeartbeatTimer(connection);
	};

	es.onerror = () => {
		es.close();
		if (connection.es === es) {
			connection.es = null;
		}
		clearHeartbeatTimer(connection);
		setConnectionState(connection, { connected: false });

		if (connection.intentional || connection.subscribers.size === 0) return;

		const delay = nextBackoff(connection.attempt);
		connection.attempt += 1;
		setConnectionState(connection, { reconnecting: true });

		connection.reconnectTimer = setTimeout(() => {
			connection.reconnectTimer = null;
			if (!connection.intentional && connection.subscribers.size > 0) {
				connect(connection);
			}
		}, delay);
	};
}

function disposeIfUnused(connection: SharedLiveConnection): void {
	if (connection.subscribers.size > 0) return;
	disconnect(connection, true);
	if (connection.visibilityTimer) {
		clearTimeout(connection.visibilityTimer);
	}
	connections.delete(connection.url);
}

function installVisibilityListener(): void {
	if (visibilityListenerInstalled || typeof document === "undefined") return;
	visibilityListenerInstalled = true;

	document.addEventListener("visibilitychange", () => {
		for (const connection of connections.values()) {
			if (document.visibilityState === "hidden") {
				if (connection.visibilityTimer)
					clearTimeout(connection.visibilityTimer);
				connection.visibilityTimer = setTimeout(() => {
					if (document.visibilityState === "hidden") {
						disconnect(connection, true);
					}
				}, VISIBILITY_GRACE_MS);
				continue;
			}

			if (connection.visibilityTimer) {
				clearTimeout(connection.visibilityTimer);
				connection.visibilityTimer = null;
			}
			connection.intentional = false;
			connection.attempt = 0;
			setConnectionState(connection, { reconnecting: false });
			connect(connection);
		}
	});
}

export function useLiveState(url: string): LiveStateResult {
	const [state, setState] = useState<LiveStateResult>(
		() => getConnection(url).state,
	);

	useEffect(() => {
		installVisibilityListener();
		const connection = getConnection(url);
		connection.subscribers.add(setState);
		setState(connection.state);
		connect(connection);

		return () => {
			connection.subscribers.delete(setState);
			disposeIfUnused(connection);
		};
	}, [url]);

	return state;
}
