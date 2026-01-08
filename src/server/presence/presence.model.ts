import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
	type NewProjectPresence,
	type ProjectPresence,
	projectPresence,
} from "@/server/db/schema";

interface PresenceData {
	viewers: Map<string, number>;
	lastHeartbeatAt?: Date;
	stopAt?: Date;
	startedAt?: Date;
	isStarting: boolean;
}

/**
 * Convert PresenceData to DB format.
 */
function presenceToDb(
	data: PresenceData,
): Omit<NewProjectPresence, "projectId"> {
	return {
		viewersJson: JSON.stringify(Array.from(data.viewers.entries())),
		lastHeartbeatAt: data.lastHeartbeatAt,
		stopAt: data.stopAt,
		startedAt: data.startedAt,
		isStarting: data.isStarting,
		updatedAt: new Date(),
	};
}

/**
 * Convert DB format to PresenceData.
 */
function dbToPresence(row: ProjectPresence | null): PresenceData | null {
	if (!row) return null;

	const viewerEntries = JSON.parse(row.viewersJson) as Array<[string, number]>;

	return {
		viewers: new Map(viewerEntries),
		lastHeartbeatAt: row.lastHeartbeatAt ?? undefined,
		stopAt: row.stopAt ?? undefined,
		startedAt: row.startedAt ?? undefined,
		isStarting: row.isStarting,
	};
}

/**
 * Get presence data for a project.
 */
export async function getPresence(
	projectId: string,
): Promise<PresenceData | null> {
	const row = await db.query.projectPresence.findFirst({
		where: eq(projectPresence.projectId, projectId),
	});

	return dbToPresence(row);
}

/**
 * Upsert presence data for a project.
 */
export async function upsertPresence(
	projectId: string,
	data: PresenceData,
): Promise<void> {
	const dbData = presenceToDb(data);

	await db
		.insert(projectPresence)
		.values({ projectId, ...dbData })
		.onConflictDoUpdate({
			target: projectPresence.projectId,
			set: dbData,
		});
}

/**
 * Delete presence data for a project.
 */
export async function deletePresence(projectId: string): Promise<void> {
	await db
		.delete(projectPresence)
		.where(eq(projectPresence.projectId, projectId));
}

/**
 * Update viewer in presence data.
 */
export async function updateViewer(
	projectId: string,
	viewerId: string,
	lastSeenAt: number,
): Promise<void> {
	const current = await getPresence(projectId);
	if (!current) return;

	current.viewers.set(viewerId, lastSeenAt);
	await upsertPresence(projectId, current);
}

/**
 * Remove viewer from presence data.
 */
export async function removeViewer(
	projectId: string,
	viewerId: string,
): Promise<void> {
	const current = await getPresence(projectId);
	if (!current) return;

	current.viewers.delete(viewerId);
	await upsertPresence(projectId, current);
}

/**
 * Update last heartbeat timestamp.
 */
export async function updateLastHeartbeat(
	projectId: string,
	timestamp: Date,
): Promise<void> {
	const current = await getPresence(projectId);
	if (!current) return;

	current.lastHeartbeatAt = timestamp;
	await upsertPresence(projectId, current);
}

/**
 * Clear last heartbeat timestamp.
 */
export async function clearLastHeartbeat(projectId: string): Promise<void> {
	const current = await getPresence(projectId);
	if (!current) return;

	delete current.lastHeartbeatAt;
	await upsertPresence(projectId, current);
}

/**
 * Update starting state.
 */
export async function updateStartingState(
	projectId: string,
	isStarting: boolean,
	startedAt?: Date,
): Promise<void> {
	const current = await getPresence(projectId);
	if (!current) {
		await upsertPresence(projectId, {
			viewers: new Map(),
			isStarting,
			startedAt,
		});
		return;
	}

	current.isStarting = isStarting;
	current.startedAt = startedAt;
	await upsertPresence(projectId, current);
}

/**
 * List all presence records (for reaper).
 */
export async function listAllPresence(): Promise<
	Array<{ projectId: string; data: PresenceData }>
> {
	const rows = await db.query.projectPresence.findMany();

	return rows.map((row) => ({
		projectId: row.projectId,
		data: dbToPresence(row)!,
	}));
}

/**
 * Get stale viewer IDs for a project.
 */
export async function getStableViewers(
	projectId: string,
	staleThreshold: Date,
): Promise<string[]> {
	const current = await getPresence(projectId);
	if (!current) return [];

	const stale: string[] = [];
	for (const [viewerId, lastSeen] of current.viewers) {
		if (lastSeen < staleThreshold.getTime()) {
			stale.push(viewerId);
		}
	}

	return stale;
}

/**
 * Remove multiple viewers from a project.
 */
export async function removeViewers(
	projectId: string,
	viewerIds: string[],
): Promise<void> {
	const current = await getPresence(projectId);
	if (!current) return;

	for (const viewerId of viewerIds) {
		current.viewers.delete(viewerId);
	}

	await upsertPresence(projectId, current);
}
