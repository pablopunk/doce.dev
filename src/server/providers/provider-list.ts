import { logger } from "@/server/logger";
import type { OpencodeClient } from "@/server/opencode/client";
import { createOpencodeClient } from "@/server/opencode/client";

export const OPENCODE_PROVIDER_ID = "opencode";
export const OPENCODE_SIBLING_ID = "opencode-go";

const HIDDEN_PROVIDER_IDS = new Set([OPENCODE_SIBLING_ID]);

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
	[OPENCODE_PROVIDER_ID]: "OpenCode Zen/Go",
};

export interface ProviderAuthMethod {
	type: "api" | "oauth";
	label: string;
}

export type ProviderSource = "env" | "config" | "custom" | "api";

export interface SettingsProvider {
	id: string;
	name: string;
	env: string[];
	source: ProviderSource;
	connected: boolean;
	disconnectable: boolean;
	methods: ProviderAuthMethod[];
}

function getProviderMethods(
	provider: { id?: string; env?: string[] },
	methods: ProviderAuthMethod[] | undefined,
): ProviderAuthMethod[] {
	if (methods && methods.length > 0) {
		return methods;
	}

	if (provider.id === OPENCODE_PROVIDER_ID) {
		return [{ type: "api", label: "Enter OpenCode Zen/Go API Key" }];
	}

	if ((provider.env || []).length > 0) {
		return [{ type: "api", label: "Manually enter API Key" }];
	}

	return [];
}

function isUnauthenticatedDefaultOpencodeProvider(provider: {
	id?: string;
	source?: string;
}): boolean {
	return provider.id === OPENCODE_PROVIDER_ID && provider.source === "custom";
}

function isProviderConnected(
	provider: { id?: string; source?: string },
	connectedIds: Set<string>,
): boolean {
	if (!provider.id) return false;
	if (isUnauthenticatedDefaultOpencodeProvider(provider)) return false;
	return connectedIds.has(provider.id);
}

function filterVisibleProviders<T extends { id: string }>(providers: T[]): T[] {
	return providers.filter((provider) => !HIDDEN_PROVIDER_IDS.has(provider.id));
}

export async function getSettingsProviders(
	client: OpencodeClient = createOpencodeClient(),
): Promise<SettingsProvider[]> {
	const [providerResponse, authResponse] = await Promise.all([
		client.provider.list(),
		client.provider.auth(),
	]);

	const providerData = providerResponse.data;
	const authData = authResponse.data || {};
	const connectedIds = new Set(providerData?.connected || []);

	return filterVisibleProviders(providerData?.all || []).map((provider) => {
		const connected = isProviderConnected(provider, connectedIds);

		return {
			id: provider.id,
			name: PROVIDER_DISPLAY_NAMES[provider.id] ?? provider.name,
			env: provider.env,
			source: (provider.source || "custom") as ProviderSource,
			connected,
			disconnectable: connected,
			methods: getProviderMethods(
				provider,
				(authData[provider.id] || []) as ProviderAuthMethod[],
			),
		};
	});
}

export function shouldDefaultSettingsToProviders(
	providers: SettingsProvider[],
): boolean {
	return (
		providers.length === 1 &&
		providers[0]?.id === OPENCODE_PROVIDER_ID &&
		!providers[0].connected
	);
}

export async function getShouldDefaultSettingsToProviders(): Promise<boolean> {
	try {
		const providers = await getSettingsProviders();
		return shouldDefaultSettingsToProviders(providers);
	} catch (error) {
		logger.warn(
			{ error },
			"Failed to resolve provider-aware settings default tab",
		);
		return false;
	}
}
