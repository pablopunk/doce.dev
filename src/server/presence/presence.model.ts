import { and, eq, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projectPresence, projectViewers } from "@/server/db/schema";
import { logger } from "@/server/logger";

const STALE_VIEWER_THRESHOLD_MS = 2 * 15000; // 2x presence heartbeat

export interface ProjectPresenceData {
	projectId: string;
	viewers: Map<string, number>;
	lastHeartbeatAt?: number;
	stopAt?: number;
	startedAt?: number;
	isStarting: boolean;
}

export async function upsertProjectPresence(
	projectId: string,
	data: Partial<
		Pick<
			ProjectPresenceData,
			"lastHeartbeatAt" | "stopAt" | "startedAt" | "isStarting"
		>
	>,
): Promise<void> {
	await db
		.insert(projectPresence)
		.values({
			projectId,
			...data,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: projectPresence.projectId,
			set: {
				...data,
				updatedAt: new Date(),
			},
		});
}

export async function getProjectPresence(
	projectId: string,
): Promise<ProjectPresenceData | null> {
	const presence = await db.query.projectPresence.findFirst({
		where: eq(projectPresence.projectId, projectId),
		with: {
			viewers: true,
		},
	});

	if (!presence) {
		return null;
	}

	return {
		projectId: presence.projectId,
		viewers: new Map(presence.viewers.map((v) => [v.viewerId, v.lastSeenAt])),
		lastHeartbeatAt: presence.lastHeartbeatAt ?? undefined,
		stopAt: presence.stopAt ?? undefined,
		startedAt: presence.startedAt ?? undefined,
		isStarting: presence.isStarting,
	};
}

export async function getAllProjectsPresence(): Promise<
	Map<string, ProjectPresenceData>
> {
	const presenceList = await db.query.projectPresence.findMany({
		with: {
			viewers: true,
		},
	});

	const map = new Map<string, ProjectPresenceData>();
	for (const presence of presenceList) {
		map.set(presence.projectId, {
			projectId: presence.projectId,
			viewers: new Map(presence.viewers.map((v) => [v.viewerId, v.lastSeenAt])),
			lastHeartbeatAt: presence.lastHeartbeatAt ?? undefined,
			stopAt: presence.stopAt ?? undefined,
			startedAt: presence.startedAt ?? undefined,
			isStarting: presence.isStarting,
		});
	}

	return map;
}

export async function upsertViewer(
	projectId: string,
	viewerId: string,
	lastSeenAt: number,
): Promise<void> {
	await db
		.insert(projectViewers)
		.values({
			viewerId,
			projectId,
			lastSeenAt,
		})
		.onConflictDoUpdate({
			target: projectViewers.viewerId,
			set: {
				lastSeenAt,
			},
		});
}

export async function deleteViewer(viewerId: string): Promise<void> {
	await db.delete(projectViewers).where(eq(projectViewers.viewerId, viewerId));
}

export async function deleteStaleViewers(
	projectId: string,
	thresholdMs: number = STALE_VIEWER_THRESHOLD_MS,
): Promise<number> {
	const staleTime = Date.now() - thresholdMs;
	const result = await db
		.delete(projectViewers)
		.where(
			and(
				eq(projectViewers.projectId, projectId),
				lt(projectViewers.lastSeenAt, staleTime),
			),
		)
		.returning();

	for (const viewer of result) {
		logger.debug(
			{ projectId, viewerId: viewer.viewerId },
			"Pruned stale viewer",
		);
	}

	return result.length;
}

export async function deleteProjectPresence(projectId: string): Promise<void> {
	await db
		.delete(projectPresence)
		.where(eq(projectPresence.projectId, projectId));
}
