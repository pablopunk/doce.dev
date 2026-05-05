import { logger } from "@/server/logger";

type ProjectSubscriber = (projectId: string) => void;

const projectSubscribers = new Map<string, Set<ProjectSubscriber>>();

export function subscribeProjectEvents(
	projectId: string,
	subscriber: ProjectSubscriber,
): () => void {
	const subscribers =
		projectSubscribers.get(projectId) ?? new Set<ProjectSubscriber>();
	subscribers.add(subscriber);
	projectSubscribers.set(projectId, subscribers);

	return () => {
		const nextSubscribers = projectSubscribers.get(projectId);
		if (!nextSubscribers) return;
		nextSubscribers.delete(subscriber);
		if (nextSubscribers.size === 0) {
			projectSubscribers.delete(projectId);
		}
	};
}

export function emitProjectEvent(projectId: string): void {
	const subscribers = projectSubscribers.get(projectId);
	if (!subscribers) return;

	for (const subscriber of subscribers) {
		try {
			subscriber(projectId);
		} catch (error) {
			logger.warn({ error, projectId }, "Project event subscriber failed");
		}
	}
}
