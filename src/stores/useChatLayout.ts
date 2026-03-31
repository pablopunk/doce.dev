import { create } from "zustand";

interface ChatLayoutState {
	isDetached: boolean;
	/** Floating panel position (percentage from left, top) */
	position: { x: number; y: number };
	/** Floating panel size (percentage width, height) */
	size: { width: number; height: number };
}

interface ChatLayoutStore extends ChatLayoutState {
	setDetached: (detached: boolean) => void;
	toggle: () => void;
	setPosition: (position: { x: number; y: number }) => void;
	setSize: (size: { width: number; height: number }) => void;
}

const STORAGE_KEY = "chat-layout";

function loadPersistedState(): Partial<ChatLayoutState> {
	if (typeof window === "undefined") return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		// ignore
	}
	return {};
}

function persist(state: ChatLayoutState) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const defaults: ChatLayoutState = {
	isDetached: false,
	position: { x: 16, y: 64 },
	size: { width: 380, height: 600 },
};

export const useChatLayout = create<ChatLayoutStore>()((set, get) => {
	const persisted = loadPersistedState();
	const initial = { ...defaults, ...persisted };

	return {
		...initial,

		setDetached: (detached) => {
			set({ isDetached: detached });
			persist({ ...get(), isDetached: detached });
		},

		toggle: () => {
			const next = !get().isDetached;
			set({ isDetached: next });
			persist({ ...get(), isDetached: next });
		},

		setPosition: (position) => {
			set({ position });
			persist({ ...get(), position });
		},

		setSize: (size) => {
			set({ size });
			persist({ ...get(), size });
		},
	};
});
