// Forwards dev-time errors to the parent window (doce.dev preview panel)
// so it can show a "Fix with Doce" overlay. Dev-only, no-op in production.

type DoceErrorPayload = {
	type: "doce:error";
	message: string;
	stack?: string;
	source: "runtime" | "promise" | "vite";
};

if (
	import.meta.env.DEV &&
	typeof window !== "undefined" &&
	window.parent !== window
) {
	const send = (payload: Omit<DoceErrorPayload, "type">) => {
		try {
			window.parent.postMessage(
				{ type: "doce:error", ...payload } satisfies DoceErrorPayload,
				"*",
			);
		} catch {
			// ignore
		}
	};

	const clear = () => {
		try {
			window.parent.postMessage({ type: "doce:error-clear" }, "*");
		} catch {
			// ignore
		}
	};

	window.addEventListener("error", (e) => {
		const err = e.error as Error | undefined;
		send({
			message: err?.message ?? e.message ?? "Unknown error",
			stack: err?.stack,
			source: "runtime",
		});
	});

	window.addEventListener("unhandledrejection", (e) => {
		const reason = e.reason as { message?: string; stack?: string } | string;
		const message =
			typeof reason === "string"
				? reason
				: (reason?.message ?? "Unhandled promise rejection");
		const stack = typeof reason === "string" ? undefined : reason?.stack;
		send({ message, stack, source: "promise" });
	});

	if (import.meta.hot) {
		import.meta.hot.on("vite:error", (payload: { err?: { message?: string; stack?: string } }) => {
			const err = payload?.err ?? {};
			send({
				message: err.message ?? "Vite error",
				stack: err.stack,
				source: "vite",
			});
		});

		import.meta.hot.on("vite:afterUpdate", () => {
			clear();
		});
	}

	// Signal that this page loaded successfully (clears any previous error).
	window.addEventListener("load", () => {
		clear();
	});
}
