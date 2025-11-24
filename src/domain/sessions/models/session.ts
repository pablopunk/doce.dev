import type { Session as OpencodeSession, Part } from "@opencode-ai/sdk";
import { Conversation } from "@/domain/conversations/models/conversation";
import * as db from "@/lib/db";
import { getProjectPath } from "@/lib/file-system";
import { createLogger } from "@/lib/logger";
import { getOpencodeClient, getOpencodeServer } from "@/lib/opencode";

const logger = createLogger("session-model");

export class Session {
	static async ensureServerRunning(): Promise<void> {
		try {
			await getOpencodeServer();
		} catch (error) {
			logger.error("Failed to start OpenCode server", error as Error);
			throw error;
		}
	}

	static async getOrCreateForProject(
		projectId: string,
		model?: string,
	): Promise<OpencodeSession> {
		await Session.ensureServerRunning();

		let conversation = Conversation.getByProjectId(projectId);

		if (conversation?.opencodeSessionId) {
			try {
				const client = getOpencodeClient();
				const { data, error } = await client.session.get({
					path: { id: conversation.opencodeSessionId },
				});

				if (!error && data) {
					logger.info(
						`Found existing OpenCode session ${conversation.opencodeSessionId} for project ${projectId}`,
					);
					return data;
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

		const projectPath = await getProjectPath(projectId);

		const client = getOpencodeClient();

		logger.info(
			`Creating OpenCode session for project ${projectId} at ${projectPath}`,
		);

		const { data, error } = await client.session.create({
			body: {
				title: `Project ${projectId}`,
			},
			query: {
				directory: projectPath,
			},
		});

		if (error || !data) {
			logger.error("Failed to create OpenCode session", error as any);
			logger.error(`Project path was: ${projectPath}`);
			logger.error(`Error details: ${JSON.stringify(error, null, 2)}`);
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

		return data;
	}

	static async sendPrompt(
		sessionId: string,
		message: string,
		model: string,
		conversationId: string,
	): Promise<void> {
		const client = getOpencodeClient();

		Conversation.saveMessage(conversationId, "user", message);

		const assistantMsg = Conversation.saveMessage(
			conversationId,
			"assistant",
			"",
			"streaming",
		);

		try {
			const [provider, modelId] = model.includes("/")
				? model.split("/")
				: ["openrouter", model];

			const { data, error } = await client.session.prompt({
				path: { id: sessionId },
				body: {
					model: { providerID: provider, modelID: modelId },
					parts: [{ type: "text", text: message }],
				},
			});

			if (error) {
				logger.error("Failed to send prompt", error as any);
				throw new Error(`Failed to send prompt`);
			}

			if (data?.parts) {
				const textContent = data.parts
					.filter((part: Part) => part.type === "text")
					.map((part: any) => part.text)
					.join("\n");

				Conversation.updateMessage(
					assistantMsg.id,
					textContent || "No response",
					"complete",
				);
			}
		} catch (error) {
			logger.error("Failed to send prompt", error as Error);
			Conversation.updateMessage(
				assistantMsg.id,
				`Error: ${(error as Error).message}`,
				"error",
			);
			throw error;
		}
	}

	static async abortSession(sessionId: string): Promise<void> {
		const client = getOpencodeClient();
		await client.session.abort({
			path: { id: sessionId },
		});
		logger.info(`Aborted OpenCode session ${sessionId}`);
	}

	static async getMessages(sessionId: string) {
		const client = getOpencodeClient();
		const { data, error } = await client.session.messages({
			path: { id: sessionId },
		});

		if (error) {
			logger.error("Failed to get messages", error as any);
			throw new Error(`Failed to get messages`);
		}

		return data || [];
	}
}
