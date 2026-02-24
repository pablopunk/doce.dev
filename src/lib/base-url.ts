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

	const originWithoutPort = getPreferredOrigin(baseUrl, fallbackOrigin).replace(
		/:\d+$/,
		"",
	);

	try {
		const parsed = new URL(url);
		if (!parsed.port) {
			return url;
		}

		return `${originWithoutPort}:${parsed.port}${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		const match = url.match(/:(\d+)(?:\/|$)/);
		if (!match) {
			return url;
		}

		return `${originWithoutPort}:${match[1]}`;
	}
}
