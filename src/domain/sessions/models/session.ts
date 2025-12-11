import type { Session as OpencodeSession } from "@opencode-ai/sdk";
import { Conversation } from "@/domain/conversations/models/conversation";
import * as db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getProjectOpencodeClient } from "@/lib/opencode";
import { Project } from "@/domain/projects/models/project";

const logger = createLogger("session-model");
const PROJECT_CONTAINER_DIRECTORY = "/app";

export class Session {
	static async getOrCreateForProject(
		projectId: string,
		model?: string,
	): Promise<OpencodeSession> {
		const client = await getProjectOpencodeClient(projectId);

		let conversation = Conversation.getByProjectId(projectId);

		if (conversation?.opencodeSessionId) {
			try {
				// Handle both responseStyle: "data" (raw) and "fields" ({ data, error })
				const result: any = await client.session.get({
					path: { id: conversation.opencodeSessionId },
				});
				const sessionData = result?.data ?? result;
				const sessionError = result?.error;

				if (!sessionError && sessionData?.id) {
					logger.info(
						`Found existing OpenCode session ${conversation.opencodeSessionId} for project ${projectId}`,
					);
					return sessionData;
				}

				logger.warn(
					`OpenCode session ${conversation.opencodeSessionId} not found, creating new one`,
				);
			} catch (error) {
				logger.error(
					"Failed to get OpenCode session, creating new one",
					error as Error,
				);
			}
		}

		if (!conversation) {
			conversation = Conversation.create(projectId, model);
		}

		logger.info(
			`Creating OpenCode session for project ${projectId} inside container`,
		);

		// Handle both responseStyle: "data" (raw) and "fields" ({ data, error })
		const result: any = await client.session.create({
			body: {
				title: `Project ${projectId}`,
			},
			query: {
				directory: PROJECT_CONTAINER_DIRECTORY,
			},
		});

		const data = result?.data ?? result;
		const error = result?.error;

		if (error || !data?.id) {
			logger.error("Failed to create OpenCode session", error as any);
			throw new Error(
				`Failed to create OpenCode session: ${JSON.stringify(error)}`,
			);
		}

		db.conversations.update(conversation.id, {
			opencodeSessionId: data.id,
		});

		logger.info(
			`Created new OpenCode session ${data.id} for project ${projectId}`,
		);

		// NOTE: Initial prompt is sent by the chat interface, not here.
		// This avoids duplicate messages when both session creation and
		// chat interface try to send the initial prompt.

		return data;
	}

	static async sendPrompt(
		projectId: string,
		sessionId: string,
		message: string,
		model: string,
	): Promise<void> {
		const client = await getProjectOpencodeClient(projectId);

		try {
			// All models are accessed through OpenRouter
			// The model ID is the full path like "openai/gpt-5.1-codex"
			await client.session.prompt({
				path: { id: sessionId },
				body: {
					model: { providerID: "openrouter", modelID: model },
					parts: [{ type: "text", text: message }],
				},
			});
		} catch (error) {
			logger.error("Failed to send prompt", error as Error);
			throw error;
		}
	}

	static async abortSession(
		projectId: string,
		sessionId: string,
	): Promise<void> {
		const client = await getProjectOpencodeClient(projectId);
		await client.session.abort({
			path: { id: sessionId },
		});
		logger.info(`Aborted OpenCode session ${sessionId}`);
	}

	static async getMessages(
		projectId: string,
		sessionId: string,
	): Promise<{
		messages: any[];
		initialPrompt?: string | null;
	}> {
		const client = await getProjectOpencodeClient(projectId);
		// The OpenCode SDK can be configured with either

		//   - responseStyle: "fields" (default) → { data, error, ... }
		//   - responseStyle: "data" → raw data value
		// so we normalise both shapes here.
		const result: any = await client.session.messages({
			path: { id: sessionId },
		});

		const data = result?.data ?? result;
		const error = result?.error;

		if (error) {
			logger.error("Failed to get messages", error as any);
			throw new Error(`Failed to get messages`);
		}

		if (!data) {
			return { messages: [] };
		}

		let baseMessages: any[] | null = null;
		let columnarInitialPrompt: string | null | undefined;

		if (Array.isArray(data)) {
			if (isColumnarMessagesTable(data)) {
				const decoded = decodeColumnarMessagesTable(data);
				baseMessages = decoded.messages;
				columnarInitialPrompt = decoded.initialPrompt ?? null;
			} else {
				baseMessages = data;
			}
		} else if (Array.isArray((data as any).messages)) {
			baseMessages = (data as any).messages;
		} else {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const maybeIterable = data as any;
				if (Symbol.iterator in maybeIterable) {
					baseMessages = Array.from(maybeIterable);
				}
			} catch (_err) {
				// ignore
			}
		}

		if (!baseMessages) {
			logger.warn("session.messages returned unexpected shape", data as any);
			return { messages: [], initialPrompt: columnarInitialPrompt };
		}

		return {
			messages: baseMessages,
			initialPrompt: columnarInitialPrompt ?? null,
		};
	}
}

type ColumnarDecodeResult = {
	messages: any[];
	initialPrompt?: string | null;
};

function isColumnarMessagesTable(value: unknown): value is any[] {
	if (!Array.isArray(value) || value.length === 0) {
		return false;
	}

	const schema = value[0];
	return (
		schema !== null &&
		typeof schema === "object" &&
		"messages" in schema &&
		typeof (schema as Record<string, unknown>).messages === "number"
	);
}

function decodeColumnarMessagesTable(table: any[]): ColumnarDecodeResult {
	const cache = new Map<number, any>();

	const resolveIndex = (index: number): any => {
		if (cache.has(index)) {
			return cache.get(index);
		}

		const raw = table[index];
		let resolved: any;

		if (typeof raw === "number") {
			resolved = raw;
		} else if (Array.isArray(raw)) {
			resolved = raw.map(resolveValue);
		} else if (raw && typeof raw === "object") {
			resolved = Object.fromEntries(
				Object.entries(raw).map(([key, value]) => [key, resolveValue(value)]),
			);
		} else {
			resolved = raw;
		}

		cache.set(index, resolved);
		return resolved;
	};

	const resolveValue = (value: any): any => {
		if (
			typeof value === "number" &&
			Number.isInteger(value) &&
			value >= 0 &&
			value < table.length
		) {
			return resolveIndex(value);
		}

		if (Array.isArray(value)) {
			return value.map(resolveValue);
		}

		if (value && typeof value === "object") {
			return Object.fromEntries(
				Object.entries(value).map(([key, nested]) => [
					key,
					resolveValue(nested),
				]),
			);
		}

		return value;
	};

	const schema: any = resolveIndex(0) ?? {};
	const initialPromptValue =
		typeof schema.initialPrompt === "string" ? schema.initialPrompt : null;

	return {
		messages: Array.isArray(schema?.messages) ? schema.messages : [],
		initialPrompt: initialPromptValue,
	};
}
