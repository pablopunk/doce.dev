import type { APIRoute } from "astro";
import { getDocePreviewStatus } from "@/server/ai-tools/doce-preview";
import { getDocePreviewStatusInput } from "@/server/ai-tools/doce-preview/schemas";
import {
	authorizeInternalCall,
	jsonResponse,
	parseInternalRequest,
} from "@/server/ai-tools/internalRequest";
import { logger } from "@/server/logger";

export const POST: APIRoute = async ({ request }) => {
	const parsed = await parseInternalRequest(request);
	if (!parsed.ok) return parsed.response;

	const auth = await authorizeInternalCall(parsed.body);
	if (!auth.ok) return auth.response;

	const inputResult = getDocePreviewStatusInput.safeParse({
		projectId: auth.result.projectId,
	});
	if (!inputResult.success) {
		return jsonResponse(400, { error: inputResult.error.message });
	}

	try {
		const output = await getDocePreviewStatus(
			inputResult.data,
			auth.result.ownerUserId,
		);
		return jsonResponse(200, output);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		logger.error(
			{ projectId: auth.result.projectId, error: message },
			"get_doce_preview_status failed",
		);
		return jsonResponse(500, { error: message });
	}
};
