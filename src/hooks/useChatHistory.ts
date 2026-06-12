import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	buildHistoryItems,
	type RawSessionMessage,
} from "@/lib/chat/buildHistoryItems";
import { getSessionContextUsage } from "@/lib/chat/sessionContextUsage";
import type { OpencodeDiagnostic } from "@/server/opencode/diagnostics";
import type { ProjectLiveState } from "@/types/live";

const CHAT_HISTORY_PAGE_LIMIT = 50;

interface ProxyErrorPayload {
	message?: string;
	error?: string;
	title?: string;
	category?: string;
	source?: string;
}

class ChatApiError extends Error {
	status: number;
	body: ProxyErrorPayload | null;

	constructor(message: string, status: number, body: ProxyErrorPayload | null) {
		super(message);
		this.name = "ChatApiError";
		this.status = status;
		this.body = body;
	}
}

function normalizeMessageModel(
	model: { providerID: string; modelID: string },
	availableModels: ReadonlyArray<{ id: string; provider: string }>,
): { providerID: string; modelID: string } {
	if (model.modelID.includes("/")) return model;
	if (model.providerID !== "opencode") return model;

	const matchingModel = availableModels.find(
		(m) =>
			m.provider === "opencode" &&
			(m.id === model.modelID || m.id.endsWith(`/${model.modelID}`)),
	);

	return matchingModel
		? { providerID: model.providerID, modelID: matchingModel.id }
		: model;
}

interface UseChatHistoryOptions {
	projectId: string;
	models: ReadonlyArray<{
		id: string;
		provider: string;
		contextLimit?: number;
	}>;
	sessionId: string | null;
	opencodeReady: boolean;
	historyLoaded: boolean;
	presenceLoaded: boolean;
	userPromptMessageId: string | null;
	sessionTitle: string | null;
	currentModel: { providerID: string; modelID: string } | null;
	liveData: ProjectLiveState | null | undefined;
	setSessionId: (sessionId: string | null) => void;
	setRevertMessageId: (messageId: string | null) => void;
	setCurrentModel: (
		model: { providerID: string; modelID: string } | null,
	) => void;
	setHistoryLoaded: (loaded: boolean) => void;
	setSessionTitle: (title: string | null) => void;
	setSessionContextUsage: (
		usage: ReturnType<typeof getSessionContextUsage>,
	) => void;
	setPendingPermission: (
		permission: {
			requestId: string;
			sessionId: string;
			permission: string;
			patterns: string[];
			messageId?: string;
			toolCallId?: string;
		} | null,
	) => void;
	setPendingQuestion: (
		question: {
			requestId: string;
			sessionId: string;
			questions: Array<{
				header: string;
				question: string;
				options: Array<{ label: string; description: string }>;
				multiple?: boolean;
				custom?: boolean;
			}>;
			messageId?: string;
			toolCallId?: string;
		} | null,
	) => void;
	setTodos: (
		todos: Array<{ content: string; status: string; priority: string }>,
	) => void;
	setLatestDiagnostic: (diagnostic: OpencodeDiagnostic | null) => void;
	setOpenCodeReady: (ready: boolean) => void;
	setInitialPromptSent: (sent: boolean) => void;
	setUserPromptMessageId: (messageId: string | null) => void;
	setProjectPrompt: (prompt: string) => void;
	setPresenceLoaded: (loaded: boolean) => void;
	setItems: (items: ReturnType<typeof buildHistoryItems>) => void;
	scrollToBottom: () => void;
}

export function useChatHistory({
	projectId,
	models,
	sessionId,
	opencodeReady,
	historyLoaded,
	presenceLoaded,
	userPromptMessageId,
	sessionTitle,
	currentModel,
	liveData,
	setSessionId,
	setRevertMessageId,
	setCurrentModel,
	setHistoryLoaded,
	setSessionTitle,
	setSessionContextUsage,
	setPendingPermission,
	setPendingQuestion,
	setTodos,
	setLatestDiagnostic,
	setOpenCodeReady,
	setInitialPromptSent,
	setUserPromptMessageId,
	setProjectPrompt,
	setPresenceLoaded,
	setItems,
	scrollToBottom,
}: UseChatHistoryOptions) {
	const [sessionTitleLoaded, setSessionTitleLoaded] = useState(
		() => sessionTitle !== null,
	);
	const [sessionContextLoaded, setSessionContextLoaded] = useState(false);
	const loadingHistoryRef = useRef(false);
	const configLoadedRef = useRef(false);

	const toErrorMessage = useCallback((error: unknown): string => {
		if (error instanceof ChatApiError) {
			return (
				error.body?.message ||
				error.body?.error ||
				error.body?.title ||
				error.message
			);
		}
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}, []);

	const fetchJson = useCallback(
		async <T>(url: string, init?: RequestInit): Promise<T> => {
			const response = await fetch(url, init);
			if (response.status === 204) {
				return {} as T;
			}

			const contentType = response.headers.get("content-type") ?? "";
			const hasJson = contentType.includes("application/json");
			const body = hasJson
				? ((await response.json()) as ProxyErrorPayload | T)
				: null;

			if (!response.ok) {
				throw new ChatApiError(
					`Request failed with status ${response.status}`,
					response.status,
					(body as ProxyErrorPayload | null) ?? null,
				);
			}

			return (body as T) ?? ({} as T);
		},
		[],
	);

	const showRequestError = useCallback(
		(title: string, error: unknown) => {
			const message = toErrorMessage(error);
			toast.error(title, { description: message });
			setLatestDiagnostic({
				timestamp: new Date().toISOString(),
				source: "unknown",
				category: "unknown",
				title,
				message,
				technicalDetails: undefined,
				remediation: [],
				isRetryable: true,
			});
		},
		[setLatestDiagnostic, toErrorMessage],
	);

	const refreshBlockingState = useCallback(
		async (activeSessionId: string) => {
			try {
				const [permissions, questions, sessionTodos] = await Promise.all([
					fetchJson<
						Array<{
							id: string;
							sessionID: string;
							permission: string;
							patterns: string[];
							tool?: { messageID: string; callID: string };
						}>
					>(`/api/projects/${projectId}/opencode/permission`),
					fetchJson<
						Array<{
							id: string;
							sessionID: string;
							questions: Array<{
								header: string;
								question: string;
								options: Array<{ label: string; description: string }>;
								multiple?: boolean;
								custom?: boolean;
							}>;
							tool?: { messageID: string; callID: string };
						}>
					>(`/api/projects/${projectId}/opencode/question`),
					fetchJson<
						Array<{ content: string; status: string; priority: string }>
					>(
						`/api/projects/${projectId}/opencode/session/${activeSessionId}/todo`,
					),
				]);

				const permission = permissions.find(
					(request) => request.sessionID === activeSessionId,
				);
				const question = questions.find(
					(request) => request.sessionID === activeSessionId,
				);

				setPendingPermission(
					permission
						? {
								requestId: permission.id,
								sessionId: permission.sessionID,
								permission: permission.permission,
								patterns: permission.patterns,
								...(permission.tool?.messageID
									? { messageId: permission.tool.messageID }
									: {}),
								...(permission.tool?.callID
									? { toolCallId: permission.tool.callID }
									: {}),
							}
						: null,
				);

				setPendingQuestion(
					question
						? {
								requestId: question.id,
								sessionId: question.sessionID,
								questions: question.questions,
								...(question.tool?.messageID
									? { messageId: question.tool.messageID }
									: {}),
								...(question.tool?.callID
									? { toolCallId: question.tool.callID }
									: {}),
							}
						: null,
				);

				setTodos(Array.isArray(sessionTodos) ? sessionTodos : []);
			} catch {
				// The stream will eventually sync this state. Ignore best-effort hydration errors.
			}
		},
		[fetchJson, projectId, setPendingPermission, setPendingQuestion, setTodos],
	);

	useEffect(() => {
		if (!sessionId) return;

		const loadSessionMetadata = async () => {
			try {
				const [session, messagesData] = await Promise.all([
					fetchJson<{ title?: string | null }>(
						`/api/projects/${projectId}/opencode/session/${sessionId}`,
					),
					fetchJson<RawSessionMessage[] | { messages?: RawSessionMessage[] }>(
						`/api/projects/${projectId}/opencode/session/${sessionId}/message?limit=${CHAT_HISTORY_PAGE_LIMIT}`,
					),
				]);
				setSessionTitle(session.title ?? null);
				const messages = Array.isArray(messagesData)
					? messagesData
					: (messagesData.messages ?? []);
				setSessionContextUsage(
					getSessionContextUsage(messages, currentModel, models),
				);
			} catch {
				// Best-effort only. The chat works fine without this metadata.
			} finally {
				setSessionTitleLoaded(true);
				setSessionContextLoaded(true);
			}
		};

		void loadSessionMetadata();
	}, [
		fetchJson,
		projectId,
		sessionId,
		setSessionContextUsage,
		setSessionTitle,
		currentModel,
		models,
	]);

	// Load model from OpenCode config
	useEffect(() => {
		if (!opencodeReady || configLoadedRef.current) return;

		const loadConfig = async () => {
			try {
				configLoadedRef.current = true;
				const config = await fetchJson<{ model?: string }>(
					`/api/projects/${projectId}/opencode/config`,
				);
				if (config.model) {
					const parts = config.model.split("/");
					const providerID = parts[0];
					if (parts.length >= 2 && providerID) {
						setCurrentModel({
							providerID,
							modelID: parts.slice(1).join("/"),
						});
					}
				}
			} catch (error) {
				showRequestError("Failed to load model config", error);
			}
		};
		loadConfig();
	}, [fetchJson, opencodeReady, projectId, setCurrentModel, showRequestError]);

	// Load history
	useEffect(() => {
		if (
			!opencodeReady ||
			historyLoaded ||
			loadingHistoryRef.current ||
			!presenceLoaded
		)
			return;

		const loadHistory = async () => {
			loadingHistoryRef.current = true;
			try {
				// Resolve session id without an extra roundtrip when possible.
				// liveData hands us bootstrapSessionId; fall back to the list call only
				// for legacy projects that predate that field.
				let latestSessionId = sessionId ?? liveData?.bootstrapSessionId ?? null;

				if (!latestSessionId) {
					type SessionListItem = { id?: string } | string;
					const sessionsData = await fetchJson<
						SessionListItem[] | { sessions?: SessionListItem[] }
					>(`/api/projects/${projectId}/opencode/session`);
					const sessions = Array.isArray(sessionsData)
						? sessionsData
						: sessionsData.sessions || [];
					const latest = sessions[sessions.length - 1];
					latestSessionId =
						(typeof latest === "string" ? latest : latest?.id) ?? null;
				}

				if (!latestSessionId) {
					setHistoryLoaded(true);
					loadingHistoryRef.current = false;
					return;
				}
				setSessionId(latestSessionId);

				// Run the three remaining requests in parallel — none of them depend
				// on each other, so the perceived latency drops to the slowest one.
				const [, sessionInfoResult, messagesResult] = await Promise.allSettled([
					refreshBlockingState(latestSessionId),
					fetchJson<{ revert?: { messageID?: string } }>(
						`/api/projects/${projectId}/opencode/session/${latestSessionId}`,
					),
					fetchJson<RawSessionMessage[] | { messages?: RawSessionMessage[] }>(
						`/api/projects/${projectId}/opencode/session/${latestSessionId}/message?limit=${CHAT_HISTORY_PAGE_LIMIT}`,
					),
				]);

				if (sessionInfoResult.status === "fulfilled") {
					setRevertMessageId(
						sessionInfoResult.value?.revert?.messageID ?? null,
					);
				}

				if (messagesResult.status !== "fulfilled") {
					if (messagesResult.status === "rejected") {
						showRequestError(
							"Failed to load chat history",
							messagesResult.reason,
						);
					}
					setHistoryLoaded(true);
					loadingHistoryRef.current = false;
					return;
				}

				const messagesData = messagesResult.value;
				const messages = Array.isArray(messagesData)
					? messagesData
					: (messagesData.messages ?? []);

				const lastUserMessageWithModel = messages
					.filter(
						(message) => message.info?.role === "user" && message.info.model,
					)
					.pop();

				const resolvedModel = lastUserMessageWithModel?.info?.model
					? normalizeMessageModel(lastUserMessageWithModel.info.model, models)
					: null;

				if (resolvedModel) {
					setCurrentModel(resolvedModel);
				}
				setSessionContextUsage(
					getSessionContextUsage(messages, resolvedModel, models),
				);
				setSessionContextLoaded(true);

				const historyItems = buildHistoryItems(
					messages,
					userPromptMessageId ?? null,
				);
				if (historyItems.length > 0) {
					setItems(historyItems);
					setTimeout(scrollToBottom, 100);
				}
			} catch (error) {
				showRequestError("Failed to load chat history", error);
			}
			loadingHistoryRef.current = false;
			setHistoryLoaded(true);
		};
		loadHistory();
	}, [
		projectId,
		opencodeReady,
		historyLoaded,
		presenceLoaded,
		userPromptMessageId,
		models,
		sessionId,
		liveData?.bootstrapSessionId,
		setHistoryLoaded,
		setSessionId,
		setCurrentModel,
		fetchJson,
		refreshBlockingState,
		setRevertMessageId,
		setItems,
		scrollToBottom,
		showRequestError,
		setSessionContextUsage,
	]);

	// React to live state for readiness
	useEffect(() => {
		if (!liveData || opencodeReady) return;
		if (liveData.opencodeReady) {
			setOpenCodeReady(true);
			setInitialPromptSent(liveData.initialPromptSent);
			setUserPromptMessageId(liveData.userPromptMessageId);
			setProjectPrompt(liveData.prompt ?? "");
			if (liveData.bootstrapSessionId)
				setSessionId(liveData.bootstrapSessionId);
			setPresenceLoaded(true);
		}
	}, [
		liveData,
		opencodeReady,
		setOpenCodeReady,
		setInitialPromptSent,
		setUserPromptMessageId,
		setProjectPrompt,
		setSessionId,
		setPresenceLoaded,
	]);

	return {
		fetchJson,
		toErrorMessage,
		showRequestError,
		refreshBlockingState,
		sessionTitleLoaded,
		sessionContextLoaded,
		setSessionContextLoaded,
	};
}
