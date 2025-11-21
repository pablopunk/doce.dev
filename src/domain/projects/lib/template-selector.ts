import { generateText } from "ai";
import { getTemplateRoutingModel } from "@/domain/llms/models/router-models";
import {
	PROJECT_TEMPLATES,
	type ProjectTemplate,
} from "@/domain/projects/lib/template-metadata";

export interface TemplateChoice {
	template: ProjectTemplate;
	confidence: number;
	rationale: string;
}

function buildPrompt(userPrompt: string): string {
	const templateSummaries = PROJECT_TEMPLATES.map((tpl) => {
		return `ID: ${tpl.id}\nName: ${tpl.name}\nBest for: ${tpl.bestFor.join(", ")}\nDescription: ${tpl.description}\nModification hints: ${tpl.modificationHints}`;
	}).join("\n\n---\n\n");

	return `You help route website generation requests to the best starter template.

USER PROMPT:
${userPrompt}

AVAILABLE TEMPLATES:
${templateSummaries}

Return a short JSON object only, no markdown, with this shape:
{
  "templateId": "one of the IDs above",
  "confidence": number between 0 and 1,
  "rationale": "one or two sentences"
}`;
}

export async function chooseTemplateForPrompt(
	userPrompt: string,
): Promise<TemplateChoice> {
	const model = getTemplateRoutingModel();

	const result = await generateText({
		model,
		// System keeps it constrained and tool-like
		system:
			"You are a routing helper that chooses the best template for a prompt. Always answer with minimal JSON only.",
		prompt: buildPrompt(userPrompt),
	});

	let parsed: { templateId: string; confidence?: number; rationale?: string };
	try {
		parsed = JSON.parse(result.text);
	} catch {
		// Very defensive fallback: pick by simple heuristic if JSON parsing fails
		const lower = userPrompt.toLowerCase();
		let fallbackId = PROJECT_TEMPLATES[0].id;
		if (lower.includes("dashboard") || lower.includes("admin")) {
			fallbackId = "flowbite-astro-admin-dashboard";
		} else if (
			lower.includes("blog") ||
			lower.includes("content") ||
			lower.includes("marketing") ||
			lower.includes("landing")
		) {
			fallbackId = "astrowind";
		}
		parsed = {
			templateId: fallbackId,
			confidence: 0.4,
			rationale:
				"Fallback heuristic choice because model output could not be parsed as JSON.",
		};
	}

	const template = PROJECT_TEMPLATES.find(
		(tpl) => tpl.id === parsed.templateId,
	);
	if (!template) {
		// Final safeguard: default to first template
		return {
			template: PROJECT_TEMPLATES[0],
			confidence: parsed.confidence ?? 0.3,
			rationale:
				parsed.rationale ||
				"Unknown templateId returned; defaulting to first available template.",
		};
	}

	return {
		template,
		confidence: parsed.confidence ?? 0.7,
		rationale: parsed.rationale ?? "Model did not provide a rationale.",
	};
}
