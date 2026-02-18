import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type UpdateState =
	| "idle"
	| "checking"
	| "update-available"
	| "updating"
	| "restart-ready"
	| "error";

interface CheckResult {
	hasUpdate: boolean;
	currentVersion?: string;
	remoteVersion?: string;
	error?: string;
}

interface PullResult {
	success: boolean;
	error?: string;
}

export function useAppUpdate() {
	const [state, setState] = useState<UpdateState>("idle");
	const [error, setError] = useState<string | null>(null);
	const checkedRef = useRef(false);

	const checkForUpdate = useCallback(async () => {
		if (state === "checking" || state === "updating") {
			return;
		}

		setState("checking");
		setError(null);

		try {
			const res = await fetch("/_actions/update.checkForUpdate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			if (!res.ok) {
				throw new Error("Failed to check for updates");
			}

			const result = (await res.json()) as CheckResult;

			if (result.error) {
				throw new Error(result.error);
			}

			if (result.hasUpdate) {
				setState("update-available");
			} else {
				setState("idle");
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to check for updates";
			setError(message);
			setState("error");
			toast.error(message);
		}
	}, [state]);

	const pullUpdate = useCallback(async () => {
		setState("updating");
		setError(null);

		try {
			const res = await fetch("/_actions/update.pull", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			if (!res.ok) {
				throw new Error("Failed to pull update");
			}

			const result = (await res.json()) as PullResult;
			if (!result.success) {
				throw new Error(result.error || "Failed to pull update");
			}

			setState("restart-ready");
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to pull update";
			setError(message);
			setState("error");
			toast.error(message);
		}
	}, []);

	const restart = useCallback(async () => {
		try {
			const res = await fetch("/_actions/update.restart", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			if (!res.ok) {
				throw new Error("Failed to restart");
			}

			toast.success("Container restarting...");
			setState("idle");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to restart";
			setError(message);
			setState("error");
			toast.error(message);
		}
	}, []);

	const handleClick = useCallback(() => {
		if (state === "update-available") {
			void pullUpdate();
		} else if (state === "restart-ready") {
			void restart();
		} else if (state === "idle" || state === "error") {
			void checkForUpdate();
		}
	}, [state, pullUpdate, restart, checkForUpdate]);

	useEffect(() => {
		if (checkedRef.current) return;
		checkedRef.current = true;
		void checkForUpdate();
	}, []);

	return {
		state,
		error,
		handleClick,
		checkForUpdate,
	};
}
