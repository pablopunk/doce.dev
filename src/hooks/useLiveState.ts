/**
 * useLiveState — robust SSE consumer hook.
 *
 * Robustness features:
 * - Full snapshots only (no patches, no corruption risk)
 * - Heartbeat liveness detection: stale=true if no event in 30s
 * - Visibility-driven lifecycle: disconnects when tab hidden, reconnects when visible
 * - Jittered exponential backoff on reconnect (prevents reconnect storms)
 * - Reconnects forever (capped delay) — user has tab open, they want it working
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveEvent, ProjectLiveState } from "@/types/live";

const HEARTBEAT_TIMEOUT_MS = 30_000;
const VISIBILITY_GRACE_MS = 30_000; // stay connected for 30s after tab hidden
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 10_000;
const BACKOFF_JITTER = 0.3; // ±30%

function jitter(ms: number): number {
	const range = ms * BACKOFF_JITTER;
	return ms + (Math.random() * range * 2 - range);
}

function nextBackoff(attempt: number): number {
	const base = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_CAP_MS);
	return jitter(base);
}

export interface LiveStateResult {
	data: ProjectLiveState | null;
	stale: boolean;
	connected: boolean;
	reconnecting: boolean;
}

export function useLiveState(url: string): LiveStateResult {
	const [data, setData] = useState<ProjectLiveState | null>(null);
	const [stale, setStale] = useState(false);
	const [connected, setConnected] = useState(false);
	const [reconnecting, setReconnecting] = useState(false);

	const esRef = useRef<EventSource | null>(null);
	const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const attemptRef = useRef(0);
	const intentionalRef = useRef(false); // true when we purposely disconnect

	const clearHeartbeatTimer = useCallback(() => {
		if (heartbeatTimerRef.current) {
			clearTimeout(heartbeatTimerRef.current);
			heartbeatTimerRef.current = null;
		}
	}, []);

	const resetHeartbeatTimer = useCallback(() => {
		clearHeartbeatTimer();
		setStale(false);
		heartbeatTimerRef.current = setTimeout(() => {
			setStale(true);
		}, HEARTBEAT_TIMEOUT_MS);
	}, [clearHeartbeatTimer]);

	const disconnect = useCallback(
		(intentional: boolean) => {
			intentionalRef.current = intentional;
			if (esRef.current) {
				esRef.current.close();
				esRef.current = null;
			}
			clearHeartbeatTimer();
			if (reconnectTimerRef.current) {
				clearTimeout(reconnectTimerRef.current);
				reconnectTimerRef.current = null;
			}
			setConnected(false);
			if (intentional) {
				setReconnecting(false);
			}
		},
		[clearHeartbeatTimer],
	);

	const connect = useCallback(() => {
		// Clean up any existing connection first
		if (esRef.current) {
			esRef.current.close();
			esRef.current = null;
		}

		const es = new EventSource(url);
		esRef.current = es;
		intentionalRef.current = false;

		es.addEventListener("state", (e: MessageEvent) => {
			try {
				const event = JSON.parse(e.data) as LiveEvent["data"];
				setData(event);
				setConnected(true);
				setReconnecting(false);
				setStale(false);
				attemptRef.current = 0;
				resetHeartbeatTimer();
			} catch {
				// Malformed event — ignore, wait for next
			}
		});

		es.onopen = () => {
			setConnected(true);
			setReconnecting(false);
			resetHeartbeatTimer();
		};

		es.onerror = () => {
			es.close();
			esRef.current = null;
			setConnected(false);
			clearHeartbeatTimer();

			if (intentionalRef.current) return;

			// Schedule reconnect with jittered backoff
			const delay = nextBackoff(attemptRef.current);
			attemptRef.current += 1;
			setReconnecting(true);

			reconnectTimerRef.current = setTimeout(() => {
				if (!intentionalRef.current && document.visibilityState !== "hidden") {
					connect();
				}
			}, delay);
		};
	}, [url, resetHeartbeatTimer, clearHeartbeatTimer]);

	// Visibility-driven lifecycle
	useEffect(() => {
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				// Grace period before disconnecting
				visibilityTimerRef.current = setTimeout(() => {
					if (document.visibilityState === "hidden") {
						disconnect(true);
					}
				}, VISIBILITY_GRACE_MS);
			} else {
				// Tab visible again — cancel grace period, reconnect if disconnected
				if (visibilityTimerRef.current) {
					clearTimeout(visibilityTimerRef.current);
					visibilityTimerRef.current = null;
				}
				if (!esRef.current) {
					attemptRef.current = 0;
					setReconnecting(false);
					connect();
				}
			}
		};

		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [connect, disconnect]);

	// Initial connect + cleanup
	useEffect(() => {
		connect();
		return () => {
			disconnect(true);
			if (visibilityTimerRef.current) {
				clearTimeout(visibilityTimerRef.current);
			}
		};
	}, [connect, disconnect]);

	return { data, stale, connected, reconnecting };
}
