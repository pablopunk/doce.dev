export function normalizeBaseUrl(
	baseUrl: string | null | undefined,
): string | null {
	const trimmed = baseUrl?.trim();
	return trimmed ? trimmed : null;
}

function getFallbackOrigin(fallbackOrigin: string): string {
	try {
		return new URL(fallbackOrigin).origin;
	} catch {
		return fallbackOrigin;
	}
}

export function getPreferredOrigin(
	baseUrl: string | null | undefined,
	fallbackOrigin: string,
): string {
	const normalized = normalizeBaseUrl(baseUrl);
	if (!normalized) {
		return getFallbackOrigin(fallbackOrigin);
	}

	try {
		return new URL(normalized).origin;
	} catch {
		return getFallbackOrigin(fallbackOrigin);
	}
}

function ensureTrailingSlash(value: string): string {
	return value.endsWith("/") ? value : `${value}/`;
}

function trimLeadingSlash(value: string): string {
	return value.replace(/^\/+/, "");
}

export function buildPathUrl(
	path: string,
	baseUrl: string | null | undefined,
	fallbackOrigin: string,
): string {
	const normalized = normalizeBaseUrl(baseUrl);
	const fallbackBase = ensureTrailingSlash(getFallbackOrigin(fallbackOrigin));

	if (!normalized) {
		return new URL(trimLeadingSlash(path), fallbackBase).toString();
	}

	try {
		return new URL(
			trimLeadingSlash(path),
			ensureTrailingSlash(normalized),
		).toString();
	} catch {
		return new URL(trimLeadingSlash(path), fallbackBase).toString();
	}
}

export function mapPortUrlToPreferredHost(
	url: string | null,
	baseUrl: string | null | undefined,
	fallbackOrigin: string,
): string | null {
	if (!url) {
		return null;
	}

	const preferredOrigin = getPreferredOrigin(baseUrl, fallbackOrigin);

	try {
		const parsed = new URL(url);
		const preferredParsed = new URL(preferredOrigin);

		// If no baseUrl is set and the URL has no explicit port, it's likely a
		// proxied/Tailscale URL that should not be remapped.
		if (!baseUrl && !parsed.port) {
			return url;
		}

		// Replace host with preferred host, keep port from original URL
		const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
		const host = preferredParsed.host.includes(":")
			? preferredParsed.hostname
			: preferredParsed.host;

		return `${preferredParsed.protocol}//${host}:${port}${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		const originWithoutPort = preferredOrigin.replace(/:\d+$/, "");
		const match = url.match(/:(\d+)(?:\/|$)/);
		if (!match) {
			return url;
		}

		return `${originWithoutPort}:${match[1]}`;
	}
}

export interface RuntimeUrlSet {
	local: string | null;
	tailscale: string | null;
	preferred?: string | null;
}

function isLocalHost(hostname: string): boolean {
	return hostname === "localhost" || hostname === "127.0.0.1";
}

function isTailscaleHost(hostname: string): boolean {
	return hostname.endsWith(".ts.net");
}

function getPreferredHostname(
	baseUrl: string | null | undefined,
	fallbackOrigin: string,
): string | null {
	try {
		return new URL(getPreferredOrigin(baseUrl, fallbackOrigin)).hostname;
	} catch {
		return null;
	}
}

export function getPreferredRuntimeUrl(
	urls: RuntimeUrlSet | null | undefined,
	baseUrl: string | null | undefined,
	fallbackOrigin: string,
): string | null {
	if (!urls) {
		return null;
	}

	const hostname = getPreferredHostname(baseUrl, fallbackOrigin);
	if (hostname && isTailscaleHost(hostname) && urls.tailscale) {
		return urls.tailscale;
	}

	if (hostname && isLocalHost(hostname) && urls.local) {
		return urls.local;
	}

	if (urls.local) {
		return mapPortUrlToPreferredHost(urls.local, baseUrl, fallbackOrigin);
	}

	return urls.tailscale ?? urls.preferred ?? null;
}
