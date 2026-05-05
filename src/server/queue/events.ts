import type { QueueJob } from "@/server/db/schema";
import { logger } from "@/server/logger";
import type { QueueJobType } from "./types";

export interface QueueStreamFilters {
	state?: QueueJob["state"];
	type?: QueueJobType | string;
	projectId?: string;
	q?: string;
}

interface QueueChangeEvent {
	jobId?: string;
	projectId?: string | null;
	type?: string;
	state?: QueueJob["state"];
	settingsChanged?: boolean;
}

type QueueSubscriber = (event: QueueChangeEvent) => void;

const subscribers = new Set<QueueSubscriber>();

export function subscribeQueueEvents(subscriber: QueueSubscriber): () => void {
	subscribers.add(subscriber);
	return () => {
		subscribers.delete(subscriber);
	};
}

export function emitQueueEvent(event: QueueChangeEvent): void {
	for (const subscriber of subscribers) {
		try {
			subscriber(event);
		} catch (error) {
			logger.warn({ error }, "Queue event subscriber failed");
		}
	}
}

export function matchesQueueFilters(
	filters: QueueStreamFilters,
	event: QueueChangeEvent,
): boolean {
	if (event.settingsChanged) {
		return true;
	}
	if (filters.projectId && filters.projectId !== event.projectId) {
		return false;
	}
	if (filters.type && filters.type !== event.type) {
		return false;
	}
	if (filters.state && filters.state !== event.state) {
		return false;
	}
	if (filters.q) {
		return true;
	}
	return true;
}
