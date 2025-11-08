import type { APIRoute } from "astro";
import { getConfig, setConfig } from "@/lib/db";
import { 
	AVAILABLE_AI_MODELS, 
	DEFAULT_AI_MODEL,
	isValidModel 
} from "@/shared/config/ai-models";

export const GET: APIRoute = async () => {
	const currentModel = getConfig("default_ai_model") || DEFAULT_AI_MODEL;
	
	return Response.json({
		currentModel,
		availableModels: AVAILABLE_AI_MODELS,
	});
};

export const POST: APIRoute = async ({ request }) => {
	const { model } = await request.json();
	
	if (!model) {
		return Response.json(
			{ error: "Model ID is required" },
			{ status: 400 }
		);
	}
	
	// Validate model is in our list
	if (!isValidModel(model)) {
		return Response.json(
			{ error: "Invalid model ID" },
			{ status: 400 }
		);
	}
	
	setConfig("default_ai_model", model);
	
	return Response.json({ success: true, model });
};
