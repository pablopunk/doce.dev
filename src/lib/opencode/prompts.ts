import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import type { Part } from "@opencode-ai/sdk";

import env from "@/lib/env";
import { getOpencodeClient } from "@/lib/opencode";

export type OpencodePromptOptions = {
	prompt: string;
	modelId: string;
};

export async function opencodePrompt(
	options: OpencodePromptOptions,
): Promise<string> {
	const client = getOpencodeClient();
	const { prompt, modelId } = options;

	const [providerID, modelID] = modelId.includes("/")
		? modelId.split("/")
		: ["openrouter", modelId];

	const anyClient = client as any;

	// Prefer a stateless model-level prompt API when available
	if (anyClient.model?.prompt) {
		const result = await anyClient.model.prompt({
			body: {
				model: { providerID, modelID },
				parts: [{ type: "text", text: prompt }],
			},
		});

		const data = result?.data ?? result;
		const error = result?.error;

		if (error) {
			throw new Error("Failed to send prompt");
		}

		const text = extractTextFromResponse(data);
		return text || "No response";
	}

	// Fallback: use a temporary session with its own directory
	const sessionDir = path.join(env.dataPath, "tmp", randomUUID());
	await mkdir(sessionDir, { recursive: true });

	let sessionId: string | undefined;

	try {
		const { data: session, error: sessionError } = await client.session.create({
			body: { title: "Temporary prompt" },
			query: { directory: sessionDir },
		});

		if (sessionError || !session) {
			throw new Error(
				`Failed to create OpenCode session: ${JSON.stringify(sessionError)}`,
			);
		}

		sessionId = session.id;

		const result: any = await client.session.prompt({
			path: { id: sessionId },
			body: {
				model: { providerID, modelID },
				parts: [{ type: "text", text: prompt }],
			},
		});

		const data = result?.data ?? result;
		const error = result?.error;

		if (error) {
			throw new Error("Failed to send prompt");
		}

		const text = extractTextFromResponse(data);
		return text || "No response";
	} finally {
		// Best-effort cleanup of the temporary session
		if (sessionId) {
			const s = (client as any).session;
			if (s && typeof s.delete === "function") {
				try {
					await s.delete({ path: { id: sessionId } });
				} catch {
					// ignore cleanup errors
				}
			}
		}

		// Best-effort cleanup of the temporary directory
		try {
			await rm(sessionDir, { recursive: true, force: true });
		} catch {
			// ignore cleanup errors
		}
	}
}

function extractTextFromResponse(data: any): string {
	if (!data) return "";

	const parts: Part[] | { type: string; text?: string }[] | undefined =
		(data as any).parts ||
		(data as any).message?.parts ||
		(data as any).messages?.[0]?.parts;

	if (!parts || !Array.isArray(parts)) return "";

	return parts
		.filter(
			(part: any) => part.type === "text" && typeof part.text === "string",
		)
		.map((part: any) => part.text as string)
		.join("\n");
}
