import type { APIRoute } from "astro";
import { getOpencodeServer } from "@/lib/opencode";

export const GET: APIRoute = async () => {
	try {
		const { server } = await getOpencodeServer();
		return new Response(
			JSON.stringify({
				status: "ok",
				opencode: {
					url: server.url,
					running: true,
				},
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		return new Response(
			JSON.stringify({
				status: "error",
				opencode: {
					running: false,
					error: (error as Error).message,
				},
			}),
			{
				status: 503,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
