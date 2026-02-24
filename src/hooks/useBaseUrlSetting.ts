import { actions } from "astro:actions";
import { useEffect, useState } from "react";
import { normalizeBaseUrl } from "@/lib/base-url";

const BASE_URL_UPDATED_EVENT = "doce:base-url-updated";

let cachedBaseUrl: string | null | undefined;
let inFlightBaseUrlRequest: Promise<string | null> | null = null;

function dispatchBaseUrlUpdate(baseUrl: string | null): void {
	if (typeof window === "undefined") {
		return;
	}

	window.dispatchEvent(
		new CustomEvent<string | null>(BASE_URL_UPDATED_EVENT, {
			detail: baseUrl,
		}),
	);
}

export function setCachedBaseUrl(baseUrl: string | null): void {
	const normalized = normalizeBaseUrl(baseUrl);
	cachedBaseUrl = normalized;
	dispatchBaseUrlUpdate(normalized);
}

async function fetchBaseUrl(): Promise<string | null> {
	if (cachedBaseUrl !== undefined) {
		return cachedBaseUrl;
	}

	if (inFlightBaseUrlRequest) {
		return inFlightBaseUrlRequest;
	}

	inFlightBaseUrlRequest = (async () => {
		try {
			const result = await actions.settings.getBaseUrl();
			const baseUrl = normalizeBaseUrl(result.data?.baseUrl ?? null);
			cachedBaseUrl = baseUrl;
			return baseUrl;
		} catch {
			cachedBaseUrl = null;
			return null;
		} finally {
			inFlightBaseUrlRequest = null;
		}
	})();

	return inFlightBaseUrlRequest;
}

export function useBaseUrlSetting() {
	const [baseUrl, setBaseUrl] = useState<string | null>(cachedBaseUrl ?? null);
	const [isLoading, setIsLoading] = useState(cachedBaseUrl === undefined);

	useEffect(() => {
		let mounted = true;

		if (cachedBaseUrl === undefined) {
			void fetchBaseUrl().then((value) => {
				if (!mounted) {
					return;
				}

				setBaseUrl(value);
				setIsLoading(false);
			});
		} else {
			setIsLoading(false);
		}

		const handleBaseUrlUpdated = (event: Event) => {
			const customEvent = event as CustomEvent<string | null>;
			setBaseUrl(customEvent.detail ?? null);
		};

		window.addEventListener(BASE_URL_UPDATED_EVENT, handleBaseUrlUpdated);

		return () => {
			mounted = false;
			window.removeEventListener(BASE_URL_UPDATED_EVENT, handleBaseUrlUpdated);
		};
	}, []);

	return {
		baseUrl,
		isLoading,
	};
}
