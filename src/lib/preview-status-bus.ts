export type PreviewStatus =
	| "not-created"
	| "creating"
	| "starting"
	| "running"
	| "failed"
	| "unknown";

export interface PreviewStatusPayload {
	status: PreviewStatus;
	previewUrl?: string | null;
	timestamp: string;
	error?: string;
}

const subscribers = new Map<string, Set<(p: PreviewStatusPayload) => void>>();
const lastStatus = new Map<string, PreviewStatusPayload>();

export function publishPreviewStatus(
	id: string,
	payload: Omit<PreviewStatusPayload, "timestamp">,
) {
	const full: PreviewStatusPayload = {
		...payload,
		timestamp: new Date().toISOString(),
	};
	lastStatus.set(id, full);
	const set = subscribers.get(id);
	if (set) {
		for (const cb of set) {
			try {
				cb(full);
			} catch (e) {
				// swallow
			}
		}
	}
}

export function subscribePreviewStatus(
	id: string,
	cb: (p: PreviewStatusPayload) => void,
) {
	let set = subscribers.get(id);
	if (!set) {
		set = new Set();
		subscribers.set(id, set);
	}
	set.add(cb);

	return () => {
		set!.delete(cb);
		if (set!.size === 0) subscribers.delete(id);
	};
}

export function getLastPreviewStatus(
	id: string,
): PreviewStatusPayload | undefined {
	return lastStatus.get(id);
}
