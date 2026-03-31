import { actions } from "astro:actions";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface McpServerConfig {
	type: "remote" | "local";
	url?: string;
	command?: string[];
	enabled?: boolean;
	environment?: Record<string, string>;
	headers?: Record<string, string>;
	timeout?: number;
}

export interface McpServerEntry {
	name: string;
	config: McpServerConfig;
}

export function useMcps() {
	const [servers, setServers] = useState<McpServerEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [pendingAction, setPendingAction] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const { data, error } = await actions.mcps.list();
			if (error) throw new Error(error.message);
			const entries = Object.entries(data ?? {}).map(([name, config]) => ({
				name,
				config: config as McpServerConfig,
			}));
			setServers(entries);
		} catch {
			toast.error("Failed to load MCP servers");
		} finally {
			setIsLoading(false);
		}
	}, []);

	const addServer = useCallback(
		async (
			name: string,
			config: Omit<McpServerConfig, "enabled"> & { enabled?: boolean },
		) => {
			setPendingAction(name);
			try {
				const { error } = await actions.mcps.add({
					name,
					type: config.type,
					url: config.url,
					command: config.command,
					enabled: config.enabled ?? true,
					environment: config.environment,
					headers: config.headers,
				});
				if (error) throw new Error(error.message);
				toast.success(`Added "${name}"`);
				await refresh();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to add MCP server",
				);
			} finally {
				setPendingAction(null);
			}
		},
		[refresh],
	);

	const removeServer = useCallback(
		async (name: string) => {
			setPendingAction(name);
			try {
				const { error } = await actions.mcps.remove({ name });
				if (error) throw new Error(error.message);
				toast.success(`Removed "${name}"`);
				await refresh();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to remove MCP server",
				);
			} finally {
				setPendingAction(null);
			}
		},
		[refresh],
	);

	const toggleServer = useCallback(
		async (name: string, enabled: boolean) => {
			setPendingAction(name);
			try {
				const { error } = await actions.mcps.toggle({ name, enabled });
				if (error) throw new Error(error.message);
				toast.success(`${enabled ? "Enabled" : "Disabled"} "${name}"`);
				await refresh();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to toggle MCP server",
				);
			} finally {
				setPendingAction(null);
			}
		},
		[refresh],
	);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return {
		servers,
		isLoading,
		pendingAction,
		addServer,
		removeServer,
		toggleServer,
		refresh,
	};
}
