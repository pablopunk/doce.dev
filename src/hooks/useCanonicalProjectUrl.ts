import { useEffect, useRef } from "react";
import { useLiveState } from "./useLiveState";

/**
 * Wait for the canonical slug to arrive on the live SSE stream and silently
 * replace the URL when it does. Uses history.replaceState — no reload, no focus
 * loss, no re-render.
 */
export function useCanonicalProjectUrl(projectId: string, currentSlug: string) {
	const hasReplaced = useRef(false);
	const { data: liveData } = useLiveState(`/api/projects/${projectId}/live`);

	useEffect(() => {
		if (hasReplaced.current) return;

		const slug =
			currentSlug !== projectId ? currentSlug : (liveData?.slug ?? projectId);
		if (!slug || slug === projectId) return;

		const path = window.location.pathname;
		const expected = `/projects/${projectId}`;
		if (path === expected || path === `${expected}/${projectId}`) {
			window.history.replaceState(null, "", `${expected}/${slug}`);
		}
		hasReplaced.current = true;
	}, [projectId, currentSlug, liveData?.slug]);
}
