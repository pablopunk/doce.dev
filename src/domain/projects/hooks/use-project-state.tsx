"use client";

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useState,
} from "react";

export type ProjectPhase = "loading" | "generating" | "ready";
export type ContainerStatus = "not-created" | "starting" | "running" | "failed";

interface ProjectStateContextValue {
	phase: ProjectPhase;
	containerStatus: ContainerStatus;
	error: string | null;
	setPhase: (phase: ProjectPhase) => void;
	setContainerStatus: (status: ContainerStatus) => void;
	setError: (error: string | null) => void;
	transitionToReady: () => void;
}

const ProjectStateContext = createContext<ProjectStateContextValue | null>(
	null,
);

interface ProjectStateProviderProps {
	children: ReactNode;
	initialPhase?: ProjectPhase;
}

export function ProjectStateProvider({
	children,
	initialPhase = "loading",
}: ProjectStateProviderProps) {
	const [phase, setPhaseState] = useState<ProjectPhase>(initialPhase);
	const [containerStatus, setContainerStatusState] =
		useState<ContainerStatus>("not-created");
	const [error, setError] = useState<string | null>(null);

	const setPhase = useCallback((newPhase: ProjectPhase) => {
		setPhaseState(newPhase);
	}, []);

	const setContainerStatus = useCallback((status: ContainerStatus) => {
		setContainerStatusState(status);
		// Clear error when container starts running
		if (status === "running") {
			setError(null);
		}
	}, []);

	const transitionToReady = useCallback(() => {
		setPhaseState("ready");
	}, []);

	return (
		<ProjectStateContext.Provider
			value={{
				phase,
				containerStatus,
				error,
				setPhase,
				setContainerStatus,
				setError,
				transitionToReady,
			}}
		>
			{children}
		</ProjectStateContext.Provider>
	);
}

export function useProjectState(): ProjectStateContextValue {
	const context = useContext(ProjectStateContext);
	if (!context) {
		throw new Error(
			"useProjectState must be used within a ProjectStateProvider",
		);
	}
	return context;
}

// Optional hook that returns null if not in provider (for optional usage)
export function useProjectStateOptional(): ProjectStateContextValue | null {
	return useContext(ProjectStateContext);
}
