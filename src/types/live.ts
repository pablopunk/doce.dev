/**
 * Unified live state types for the /api/projects/[id]/live SSE endpoint.
 *
 * Design principles:
 * - Every event is a full snapshot — no patches, no corruption risk
 * - Generation counter for debugging (not for recovery)
 * - Heartbeat is an SSE comment, not a named event
 */

export type ProjectLiveStatus =
	| "created"
	| "starting"
	| "running"
	| "stopping"
	| "stopped"
	| "error"
	| "deleting";

export type ProductionLiveStatus =
	| "queued"
	| "building"
	| "running"
	| "failed"
	| "stopped";

export interface ProductionLiveState {
	status: ProductionLiveStatus;
	url: string | null;
	port: number;
	error: string | null;
	startedAt: string | null; // ISO string
	activeJobType:
		| "production.build"
		| "production.start"
		| "production.waitReady"
		| "production.stop"
		| null;
}

export interface OpencodeDiagnostic {
	category: string | null;
	message: string | null;
}

export interface ProjectLiveState {
	/** Monotonically increasing counter — useful for debugging missed events */
	gen: number;
	status: ProjectLiveStatus;
	previewReady: boolean;
	opencodeReady: boolean;
	previewUrl: string;
	message: string | null;
	viewerCount: number;
	slug: string;
	prompt: string;
	bootstrapSessionId: string | null;
	setupError: string | null;
	opencodeDiagnostic: OpencodeDiagnostic | null;
	initialPromptSent: boolean;
	initialPromptCompleted: boolean;
	userPromptCompleted: boolean;
	userPromptMessageId: string | null;
	production: ProductionLiveState;
}

/** Wire format for SSE events — only "state" events carry data */
export type LiveEvent = { type: "state"; data: ProjectLiveState };
