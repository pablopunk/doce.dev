import { actions } from "astro:actions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLiveState } from "@/hooks/useLiveState";
import {
	buildHistoryItems,
	type RawSessionMessage,
} from "@/lib/chat/buildHistoryItems";
import { getSessionContextUsage } from "@/lib/chat/sessionContextUsage";
import type { InitialChatState } from "@/server/opencode/initialChat";

const CHAT_HISTORY_PAGE_LIMIT = 50;

import { useChatStore } from "@/stores/useChatStore";
import {
	createErrorPart,
	createPromptAttachmentPart,
	createTextPart,
	type Message,
	type MessagePart,
	type PromptAttachmentPart,
} from "@/types/message";

const MAX_SSE_RECONNECT_DELAY_MS = 10_000;
const MAX_SSE_RECONNECT_ATTEMPTS = 12;
const SSE_INACTIVITY_TIMEOUT_MS = 45_000;

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

/**
 * Normalize model ID from OpenCode messages by matching against available models.
 */
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

interface UseChatPanelOptions {
	projectId: string;
	models: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
		supportsAttachments?: boolean;
		contextLimit?: number;
	}>;
	onStreamingStateChange?:
		| ((userMessageCount: number, isStreaming: boolean) => void)
		| undefined;
	/**
	 * SSR-fetched initial state. When present we hydrate the store synchronously
	 * on mount so the panel paints with history already populated, skipping the
	 * client-side history fetch entirely.
	 */
	initialChat?: InitialChatState | null;
}

export function useChatPanel({
	projectId,
	models,
	onStreamingStateChange,
	initialChat = null,
}: UseChatPanelOptions) {
	const store = useChatStore(projectId);
	const {
		items,
		sessionId,
		revertMessageId,
		opencodeReady,
		initialPromptSent,
		userPromptMessageId,
		projectPrompt,
		sessionTitle,
		sessionContextUsage,
		currentModel,
		historyLoaded,
		presenceLoaded,
		isStreaming,
		pendingAttachments,
		pendingAttachmentError,
		latestDiagnostic,
		pendingPermission,
		pendingQuestion,
		todos,
		setSessionId,
		setRevertMessageId,
		setOpenCodeReady,
		setInitialPromptSent,
		setUserPromptMessageId,
		setProjectPrompt,
		setSessionTitle,
		setSessionContextUsage,
		setCurrentModel,
		setHistoryLoaded,
		setPresenceLoaded,
		setIsStreaming,
		setPendingAttachments,
		setPendingAttachmentError,
		setItems,
		addItem,
		updateItem,
		handleChatEvent,
		setLatestDiagnostic,
		setPendingPermission,
		setPendingQuestion,
		setTodos,
	} = store;

	const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
	const [sessionTitleLoaded, setSessionTitleLoaded] = useState(
		() => sessionTitle !== null,
	);
	const [sessionContextLoaded, setSessionContextLoaded] = useState(false);
	const [draftSeed, setDraftSeed] = useState<{
		key: number;
		text: string;
		attachments: PromptAttachmentPart[];
	} | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const reconnectAttemptsRef = useRef(0);
	// Live state from SSE — replaces presence heartbeat polling
	const { data: liveData } = useLiveState(`/api/projects/${projectId}/live`);
	const loadingHistoryRef = useRef(false);
	const configLoadedRef = useRef(false);
	const streamDegradedRef = useRef(false);
	// initialChat is consumed by ProjectContentWrapper via useChatStoreSeed —
	// it lands in the store before this hook's first read. Reference it here
	// only to silence the unused-prop lint when callers pass it through.
	void initialChat;

	const isNearBottom = useCallback(() => {
		if (!scrollRef.current) return false;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		return scrollHeight - (scrollTop + clientHeight) < 100;
	}, []);

	const scrollToBottom = useCallback(() => {
		if (scrollRef.current && shouldAutoScroll) {
			setTimeout(() => {
				if (scrollRef.current) {
					scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
				}
			}, 0);
		}
	}, [shouldAutoScroll]);

	const handleScroll = useCallback(() => {
		setShouldAutoScroll(isNearBottom());
	}, [isNearBottom]);

	useEffect(() => {
		if (items.length > 0 && shouldAutoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [shouldAutoScroll, items]);

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
	}, [fetchJson, isStreaming, projectId, sessionId, setSessionContextUsage, setSessionTitle, currentModel, models]);

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

	// Load initial prompt
	useEffect(() => {
		if (!opencodeReady || initialPromptSent || !projectPrompt || !sessionId)
			return;
		const userMessageId = `user_initial_${Date.now()}`;
		addItem({
			type: "message",
			id: userMessageId,
			data: {
				id: userMessageId,
				role: "user",
				parts: [createTextPart(projectPrompt)],
			},
		});
		scrollToBottom();
		setInitialPromptSent(true);
	}, [
		opencodeReady,
		initialPromptSent,
		projectPrompt,
		sessionId,
		addItem,
		scrollToBottom,
		setInitialPromptSent,
	]);

	// SSE events
	useEffect(() => {
		if (!opencodeReady) return;

		const clearInactivityTimer = () => {
			if (inactivityTimeoutRef.current) {
				clearTimeout(inactivityTimeoutRef.current);
				inactivityTimeoutRef.current = null;
			}
		};

		const scheduleInactivityTimeout = () => {
			clearInactivityTimer();
			inactivityTimeoutRef.current = setTimeout(() => {
				setIsStreaming(false);
				if (!streamDegradedRef.current) {
					streamDegradedRef.current = true;
					toast.warning("Connection looks unstable", {
						description:
							"The assistant stream stalled. Reconnecting automatically...",
					});
				}
			}, SSE_INACTIVITY_TIMEOUT_MS);
		};

		const connect = () => {
			const eventSource = new EventSource(
				`/api/projects/${projectId}/opencode/event`,
			);
			eventSourceRef.current = eventSource;
			scheduleInactivityTimeout();

			const handler = (e: Event) => {
				try {
					scheduleInactivityTimeout();
					handleChatEvent(JSON.parse((e as MessageEvent).data));
					streamDegradedRef.current = false;
				} catch (error) {
					showRequestError("Failed to process live event", error);
				}
			};

			eventSource.addEventListener("chat.event", handler);
			eventSource.onopen = () => {
				reconnectAttemptsRef.current = 0;
				streamDegradedRef.current = false;
				scheduleInactivityTimeout();
			};

			eventSource.onerror = () => {
				clearInactivityTimer();
				if (eventSourceRef.current === eventSource) {
					eventSource.close();
					eventSourceRef.current = null;
				}

				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
				}

				const attempt = reconnectAttemptsRef.current;
				const delay = Math.min(
					MAX_SSE_RECONNECT_DELAY_MS,
					1_000 * 2 ** attempt + Math.floor(Math.random() * 250),
				);
				reconnectAttemptsRef.current = attempt + 1;

				if (reconnectAttemptsRef.current > MAX_SSE_RECONNECT_ATTEMPTS) {
					setIsStreaming(false);
					if (!streamDegradedRef.current) {
						streamDegradedRef.current = true;
						toast.error("Live updates disconnected", {
							description:
								"Please refresh the page if reconnection does not recover shortly.",
						});
					}
				}

				reconnectTimeoutRef.current = setTimeout(() => {
					if (opencodeReady) {
						connect();
					}
				}, delay);
			};

			return () => {
				clearInactivityTimer();
				eventSource.removeEventListener("chat.event", handler);
				eventSource.close();
			};
		};

		const cleanup = connect();
		return () => {
			cleanup();
			clearInactivityTimer();
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}
			eventSourceRef.current = null;
		};
	}, [
		handleChatEvent,
		opencodeReady,
		projectId,
		setIsStreaming,
		showRequestError,
	]);

	// Streaming state change
	useEffect(() => {
		const userMessageCount = items.filter(
			(item) =>
				item.type === "message" && (item.data as Message).role === "user",
		).length;
		onStreamingStateChange?.(userMessageCount, isStreaming);
	}, [items, isStreaming, onStreamingStateChange]);

	const handleSend = async (
		content: string,
		attachments?: PromptAttachmentPart[],
	) => {
		const messageParts: MessagePart[] = [];
		if (attachments) {
			for (const attachment of attachments) {
				messageParts.push(
					createPromptAttachmentPart({
						filename: attachment.filename,
						mime: attachment.mime,
						kind: attachment.kind,
						...(attachment.dataUrl ? { dataUrl: attachment.dataUrl } : {}),
						...(attachment.size !== undefined ? { size: attachment.size } : {}),
						...(attachment.textPreview
							? { textPreview: attachment.textPreview }
							: {}),
						id: attachment.id,
					}),
				);
			}
		}
		if (content) messageParts.push(createTextPart(content));

		const userMessageId = `user_${Date.now()}`;
		addItem({
			type: "message",
			id: userMessageId,
			data: {
				id: userMessageId,
				role: "user",
				parts: messageParts,
				localStatus: "pending",
			},
		});
		scrollToBottom();

		try {
			let currentSessionId = sessionId;
			if (!currentSessionId) {
				const data = await fetchJson<{ id: string }>(
					`/api/projects/${projectId}/opencode/session`,
					{
						method: "POST",
					},
				);
				currentSessionId = data.id;
				setSessionId(currentSessionId);
				await refreshBlockingState(currentSessionId);
			}
			if (!currentSessionId) {
				throw new Error("Session could not be created");
			}

			type ApiPromptPart =
				| { type: "text"; text: string }
				| {
						type: "file";
						mime: string;
						url: string;
						filename: string;
				  };

			const apiParts: ApiPromptPart[] = [];
			if (content) apiParts.push({ type: "text", text: content });
			if (attachments) {
				for (const attachment of attachments) {
					if (!attachment.dataUrl) continue;
					apiParts.push({
						type: "file",
						mime: attachment.mime,
						url: attachment.dataUrl,
						filename: attachment.filename,
					});
				}
			}

			await fetchJson(
				`/api/projects/${projectId}/opencode/session/${currentSessionId}/prompt_async`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						parts: apiParts,
						...(currentModel && { model: currentModel }),
					}),
				},
			);
			updateItem(userMessageId, { localStatus: "sent" });
			setIsStreaming(true);
			setPendingAttachments([]);
			setPendingAttachmentError(null);
			// Sending a new prompt branches from the revert point; the visible-items
			// slice should no longer hide the new message + its response.
			if (revertMessageId) setRevertMessageId(null);
		} catch (error) {
			updateItem(userMessageId, {
				localStatus: "failed",
				localError: toErrorMessage(error),
				parts: [
					...messageParts,
					createErrorPart("Message failed to send", toErrorMessage(error)),
				],
			});
			showRequestError("Failed to send message", error);
		}
	};

	const handleModelChange = async (compositeKey: string) => {
		const [providerId, ...modelIdParts] = compositeKey.split(":");
		const modelId = modelIdParts.join(":");
		const newModelConfig = models.find(
			(m) => m.id === modelId && m.provider === providerId,
		);
		const newModelSupportsAttachments =
			newModelConfig?.supportsAttachments ?? true;

		if (pendingAttachments.length > 0 && !newModelSupportsAttachments) {
			const textAttachments = pendingAttachments.filter(
				(a) => a.kind !== "image",
			);
			const imageAttachments = pendingAttachments.filter(
				(a) => a.kind === "image",
			);
			if (imageAttachments.length > 0) {
				setPendingAttachments(textAttachments);
				setPendingAttachmentError(null);
				toast.info("Images cleared", {
					description: "The selected model doesn't support image input",
				});
			}
		}

		const newModel = newModelConfig
			? { providerID: newModelConfig.provider, modelID: newModelConfig.id }
			: null;
		const previousModel = currentModel;
		setCurrentModel(newModel);

		try {
			const modelString = newModel
				? `${newModel.providerID}/${newModel.modelID}`
				: null;
			const result = await actions.projects.updateModel({
				projectId,
				model: modelString || "",
			});
			if (!result.data?.success) setCurrentModel(previousModel);
		} catch {
			setCurrentModel(previousModel);
		}
	};

	const handlePermissionDecision = useCallback(
		async (reply: "once" | "always" | "reject") => {
			if (!pendingPermission) return;

			try {
				await fetchJson(
					`/api/projects/${projectId}/opencode/permission/${pendingPermission.requestId}/reply`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ reply }),
					},
				);
				setPendingPermission(null);
			} catch (error) {
				showRequestError("Failed to respond to permission request", error);
			}
		},
		[
			fetchJson,
			pendingPermission,
			projectId,
			setPendingPermission,
			showRequestError,
		],
	);

	const handleQuestionSubmit = useCallback(
		async (answers: string[][]) => {
			if (!pendingQuestion) return;

			try {
				await fetchJson(
					`/api/projects/${projectId}/opencode/question/${pendingQuestion.requestId}/reply`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ answers }),
					},
				);
				setPendingQuestion(null);
			} catch (error) {
				showRequestError("Failed to submit question response", error);
			}
		},
		[
			fetchJson,
			pendingQuestion,
			projectId,
			setPendingQuestion,
			showRequestError,
		],
	);

	const handleQuestionReject = useCallback(async () => {
		if (!pendingQuestion) return;

		try {
			await fetchJson(
				`/api/projects/${projectId}/opencode/question/${pendingQuestion.requestId}/reject`,
				{
					method: "POST",
				},
			);
			setPendingQuestion(null);
		} catch (error) {
			showRequestError("Failed to reject question", error);
		}
	}, [
		fetchJson,
		pendingQuestion,
		projectId,
		setPendingQuestion,
		showRequestError,
	]);

	const toggleToolExpanded = (id: string) => {
		setExpandedTools((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleRestore = useCallback(
		async ({
			messageId,
			role,
			text,
			attachments,
		}: {
			messageId: string;
			role: "user" | "assistant";
			text: string;
			attachments: PromptAttachmentPart[];
		}) => {
			// Optimistic: snapshot prev state, apply, roll back on failure.
			const prevRevert = revertMessageId;
			setRevertMessageId(messageId);
			if (role === "user") {
				setDraftSeed({ key: Date.now(), text, attachments });
			}
			try {
				const result = await actions.chat.revertToMessage({
					projectId,
					messageId,
				});
				if (result.error) {
					throw new Error(result.error.message);
				}
				// Trust server-returned revert pointer.
				const serverId = result.data?.revertMessageId ?? messageId;
				if (serverId !== messageId) setRevertMessageId(serverId);
				toast.success("Conversation restored");
			} catch (error) {
				setRevertMessageId(prevRevert);
				if (role === "user") setDraftSeed(null);
				showRequestError("Failed to restore conversation", error);
				throw error;
			}
		},
		[projectId, revertMessageId, setRevertMessageId, showRequestError],
	);

	const handleUnrevert = useCallback(async () => {
		const prevRevert = revertMessageId;
		if (!prevRevert) return;
		setRevertMessageId(null);
		try {
			const result = await actions.chat.unrevertSession({ projectId });
			if (result.error) throw new Error(result.error.message);
		} catch (error) {
			setRevertMessageId(prevRevert);
			showRequestError("Failed to cancel restore", error);
			throw error;
		}
	}, [projectId, revertMessageId, setRevertMessageId, showRequestError]);

	const clearDraftSeed = useCallback(() => setDraftSeed(null), []);

	const visibleItems = useMemo(() => {
		if (!revertMessageId) return items;
		const boundary = items.findIndex(
			(item) => item.type === "message" && item.id === revertMessageId,
		);
		if (boundary < 0) return items;
		return items.slice(0, boundary);
	}, [items, revertMessageId]);

	return {
		items: visibleItems,
		rawItems: items,
		sessionId,
		revertMessageId,
		handleRestore,
		handleUnrevert,
		draftSeed,
		clearDraftSeed,
		opencodeReady,
		isStreaming,
		pendingPermission,
		pendingQuestion,
		todos,
		pendingAttachments,
		pendingAttachmentError,
		currentModel,
		expandedTools,
		scrollRef,
		latestDiagnostic,
		setPendingAttachments,
		setPendingAttachmentError,
		handleSend,
		handleModelChange,
		handlePermissionDecision,
		handleQuestionSubmit,
		handleQuestionReject,
		toggleToolExpanded,
		handleScroll,
		clearDiagnostic: () => setLatestDiagnostic(null),
		sessionTitle,
		sessionTitleLoaded,
		sessionContextUsage,
		sessionContextLoaded,
	};
}
