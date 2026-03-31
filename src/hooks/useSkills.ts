import { actions } from "astro:actions";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface InstalledSkill {
	name: string;
	path: string;
	scope: string;
	agents: string[];
}

interface SearchResultSkill {
	id: string;
	skillId: string;
	name: string;
	installs: number;
	source: string;
}

export function useSkills() {
	const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
	const [searchResults, setSearchResults] = useState<SearchResultSkill[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSearching, setIsSearching] = useState(false);
	const [pendingAction, setPendingAction] = useState<string | null>(null);

	const refreshInstalled = useCallback(async () => {
		setIsLoading(true);
		try {
			const { data, error } = await actions.skills.list();
			if (error) throw new Error(error.message);
			setInstalledSkills(data ?? []);
		} catch {
			toast.error("Failed to load installed skills");
		} finally {
			setIsLoading(false);
		}
	}, []);

	const search = useCallback(async (query: string) => {
		if (!query.trim()) {
			setSearchResults([]);
			return;
		}
		setIsSearching(true);
		try {
			const { data, error } = await actions.skills.search({ query });
			if (error) throw new Error(error.message);
			setSearchResults(data ?? []);
		} catch {
			toast.error("Search failed");
		} finally {
			setIsSearching(false);
		}
	}, []);

	const install = useCallback(
		async (source: string, skillName?: string) => {
			const key = `${source}/${skillName ?? ""}`;
			setPendingAction(key);
			try {
				const { error } = await actions.skills.install({ source, skillName });
				if (error) throw new Error(error.message);
				toast.success(`Skill installed from ${source}`);
				await refreshInstalled();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to install skill",
				);
			} finally {
				setPendingAction(null);
			}
		},
		[refreshInstalled],
	);

	const remove = useCallback(
		async (skillName: string) => {
			setPendingAction(skillName);
			try {
				const { error } = await actions.skills.remove({ skillName });
				if (error) throw new Error(error.message);
				toast.success(`Removed "${skillName}"`);
				await refreshInstalled();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to remove skill",
				);
			} finally {
				setPendingAction(null);
			}
		},
		[refreshInstalled],
	);

	useEffect(() => {
		refreshInstalled();
	}, [refreshInstalled]);

	return {
		installedSkills,
		searchResults,
		isLoading,
		isSearching,
		pendingAction,
		search,
		install,
		remove,
		refreshInstalled,
	};
}
