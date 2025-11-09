import type { APIRoute } from "astro";
import { isSetupComplete, setConfig } from "@/lib/db";

export const POST: APIRoute = async () => {
	try {
		if (isSetupComplete()) {
			return Response.json(
				{ error: "Setup already completed" },
				{ status: 400 },
			);
		}

		setConfig("setup_complete", "true");
		return Response.json({ success: true });
	} catch (error) {
		console.error("[doce.dev] Setup complete error:", error);
		const message =
			error instanceof Error ? error.message : "Failed to complete setup";
		return Response.json({ error: message }, { status: 500 });
	}
};
