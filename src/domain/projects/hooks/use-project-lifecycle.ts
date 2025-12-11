import { actions } from "astro:actions";
import { useEffect } from "react";

/**
 * Hook to send heartbeats to keep the preview container alive
 * Container will auto-stop after 1 minute of no heartbeats
 */
export function useProjectLifecycle(projectId: string) {
	useEffect(() => {
		let isMounted = true;
		let lastHeartbeat = Date.now();

		const sendHeartbeat = async () => {
			try {
				await actions.projects.sendHeartbeat({ id: projectId });
				lastHeartbeat = Date.now();
			} catch (error) {
				if (!isMounted) return;
				console.error("[Lifecycle] Failed to send heartbeat:", error);
				setTimeout(() => {
					if (isMounted) {
						void sendHeartbeat();
					}
				}, 1000);
			}
		};

		const ensureInitialHeartbeat = async () => {
			while (isMounted) {
				try {
					await sendHeartbeat();
					break;
				} catch {
					// Retry handled in sendHeartbeat
				}
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		};

		ensureInitialHeartbeat();

		// Kick off preview status sync when component mounts
		void actions.projects.getPreviewStatus({ id: projectId }).catch(() => {
			// best-effort
		});

		const heartbeatInterval = setInterval(() => {
			if (Date.now() - lastHeartbeat > 10 * 1000) {
				void sendHeartbeat();
			}
		}, 15 * 1000);

		return () => {
			isMounted = false;
			clearInterval(heartbeatInterval);
			console.log(
				`[Lifecycle] Stopped heartbeat for project ${projectId}, container will stop in 60s if not reopened`,
			);
		};
	}, [projectId]);
}
