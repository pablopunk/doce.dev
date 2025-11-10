import { useEffect } from "react";

/**
 * Hook to send heartbeats to keep the preview container alive
 * Container will auto-stop after 1 minute of no heartbeats
 */
export function useProjectLifecycle(projectId: string) {
	useEffect(() => {
		// Send heartbeat to keep container alive
		const sendHeartbeat = async () => {
			try {
				const { actions } = await import("astro:actions");
				await actions.projects.sendHeartbeat({ id: projectId });
			} catch (error) {
				console.error("[Lifecycle] Failed to send heartbeat:", error);
			}
		};

		// Send initial heartbeat immediately
		sendHeartbeat();

		// Send heartbeat every X seconds
		const heartbeatInterval = setInterval(sendHeartbeat, 5 * 1000);

		// Cleanup - stop sending heartbeats when component unmounts
		return () => {
			clearInterval(heartbeatInterval);
			console.log(
				`[Lifecycle] Stopped heartbeat for project ${projectId}, container will stop in 60s if not reopened`,
			);
		};
	}, [projectId]);
}
