"use client";

import { actions } from "astro:actions";
import { useEffect, useState } from "react";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { CommandPalette } from "./CommandPalette";

interface PaletteProject {
	id: string;
	name: string;
}

function getCurrentProjectId(): string | undefined {
	if (typeof window === "undefined") return undefined;
	const match = window.location.pathname.match(/^\/projects\/([^/]+)/);
	return match?.[1];
}

/**
 * Self-contained command palette host. Drop into any layout and it works.
 * Fetches the user's project list once on mount.
 */
export function CommandPaletteHost() {
	const [projects, setProjects] = useState<PaletteProject[]>([]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const result = await actions.projects.list();
				if (cancelled) return;
				const list = result.data?.projects ?? [];
				setProjects(
					list.map((project) => ({ id: project.id, name: project.name })),
				);
			} catch {
				// Silently ignore — palette still works for navigation/theme.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const currentProjectId = getCurrentProjectId();

	return (
		<ThemeProvider>
			<CommandPalette
				projects={projects}
				{...(currentProjectId ? { currentProjectId } : {})}
			/>
		</ThemeProvider>
	);
}
