import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 2000;
const POLL_DURATION_MS = 60_000;

interface ProjectApiResponse {
	slug?: string;
}

/**
 * Poll for project slug updates and silently replace the URL when a real slug arrives.
 * Uses history.replaceState — no reload, no focus loss, no re-render.
 */
export function useCanonicalProjectUrl(projectId: string, currentSlug: string) {
	const hasReplaced = useRef(false);

	useEffect(() => {
		if (hasReplaced.current) return;
		if (currentSlug !== projectId) {
			// Already have a real slug on first render — just fix the URL if needed
			const path = window.location.pathname;
			const expected = `/projects/${projectId}`;
			if (path === expected) {
				window.history.replaceState(null, "", `${expected}/${currentSlug}`);
				hasReplaced.current = true;
			}
			return;
		}

		// Provisional slug — poll for the real one
		const startTime = Date.now();

		const check = async () => {
			if (hasReplaced.current) return;
			if (Date.now() - startTime > POLL_DURATION_MS) return;

			try {
				const res = await fetch(`/api/projects/${projectId}`);
				if (!res.ok) return;
				const data = (await res.json()) as ProjectApiResponse;
				const slug = data.slug;

				if (slug && slug !== projectId) {
					const path = window.location.pathname;
					const expected = `/projects/${projectId}`;
					if (path === expected || path === `${expected}/${projectId}`) {
						window.history.replaceState(null, "", `${expected}/${slug}`);
					}
					hasReplaced.current = true;
				}
			} catch {
				// ignore network errors
			}
		};

		void check();
		const interval = setInterval(() => void check(), POLL_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [projectId, currentSlug]);
}
