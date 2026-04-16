import { create } from "zustand";

export type PendingProjectAction =
	| "creating"
	| "starting"
	| "stopping"
	| "restarting"
	| "deleting"
	| "deploying"
	| "stopping-production"
	| "rolling-back"
	| "restarting-agent";

export interface OptimisticProjectState {
	action: PendingProjectAction | null;
	startedAt: number;
	message?: string | undefined;
	rollbackHash?: string | undefined;
}

export interface CreatingProjectDraft {
	id: string;
	prompt: string;
	name: string;
	slug?: string;
	createdAt: number;
}

interface ProjectOptimisticStore {
	// Pending actions per project
	pendingByProjectId: Map<string, OptimisticProjectState>;
	creatingDrafts: Map<string, CreatingProjectDraft>;

	// Pending actions
	setPending: (
		projectId: string,
		action: PendingProjectAction,
		message?: string,
		rollbackHash?: string,
	) => void;
	clearPending: (projectId: string) => void;
	getPending: (projectId: string) => OptimisticProjectState | null;

	// Creating drafts (temporary projects being created)
	addCreatingDraft: (draft: CreatingProjectDraft) => void;
	resolveCreatingDraft: (tempId: string, realProjectId: string) => void;
	removeCreatingDraft: (tempId: string) => void;
	getCreatingDraft: (tempId: string) => CreatingProjectDraft | null;
	getCreatingDrafts: () => CreatingProjectDraft[];

	// Shorthand setters
	markDeleting: (projectId: string) => void;
	markRestarting: (projectId: string) => void;
	markStopping: (projectId: string) => void;
	markDeploying: (projectId: string) => void;
	markStoppingProduction: (projectId: string) => void;
	markRollingBack: (projectId: string, hash: string) => void;
	markRestartingAgent: (projectId: string) => void;
}

export const useProjectOptimisticState = create<ProjectOptimisticStore>()(
	(set, get) => ({
		pendingByProjectId: new Map(),
		creatingDrafts: new Map(),

		setPending: (projectId, action, message, rollbackHash) => {
			set((state) => {
				const newMap = new Map(state.pendingByProjectId);
				newMap.set(projectId, {
					action,
					startedAt: Date.now(),
					message,
					rollbackHash,
				});
				return { pendingByProjectId: newMap };
			});
		},

		clearPending: (projectId) => {
			set((state) => {
				const newMap = new Map(state.pendingByProjectId);
				newMap.delete(projectId);
				return { pendingByProjectId: newMap };
			});
		},

		getPending: (projectId) => {
			return get().pendingByProjectId.get(projectId) ?? null;
		},

		addCreatingDraft: (draft) => {
			set((state) => {
				const newMap = new Map(state.creatingDrafts);
				newMap.set(draft.id, draft);
				return { creatingDrafts: newMap };
			});
		},

		resolveCreatingDraft: (tempId, _realProjectId) => {
			set((state) => {
				const newMap = new Map(state.creatingDrafts);
				newMap.delete(tempId);
				return { creatingDrafts: newMap };
			});
		},

		removeCreatingDraft: (tempId) => {
			set((state) => {
				const newMap = new Map(state.creatingDrafts);
				newMap.delete(tempId);
				return { creatingDrafts: newMap };
			});
		},

		getCreatingDraft: (tempId) => {
			return get().creatingDrafts.get(tempId) ?? null;
		},

		getCreatingDrafts: () => {
			return Array.from(get().creatingDrafts.values());
		},

		markDeleting: (projectId) => {
			get().setPending(projectId, "deleting", "Deleting...");
		},

		markRestarting: (projectId) => {
			get().setPending(projectId, "restarting", "Restarting...");
		},

		markStopping: (projectId) => {
			get().setPending(projectId, "stopping", "Stopping...");
		},

		markDeploying: (projectId) => {
			get().setPending(projectId, "deploying", "Deploying...");
		},

		markStoppingProduction: (projectId) => {
			get().setPending(projectId, "stopping-production", "Stopping...");
		},

		markRollingBack: (projectId, hash) => {
			get().setPending(projectId, "rolling-back", "Rolling back...", hash);
		},

		markRestartingAgent: (projectId) => {
			get().setPending(projectId, "restarting-agent", "Restarting agent...");
		},
	}),
);
