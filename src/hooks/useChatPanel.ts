import { actions } from "astro:actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type ChatItem, useChatStore } from "@/stores/useChatStore";
import {
	createErrorPart,
	createImagePart,
	createTextPart,
	type ImagePart,
	type Message,
	type MessagePart,
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
	}>;
	onStreamingStateChange?:
		| ((userMessageCount: number, isStreaming: boolean) => void)
		| undefined;
}

export function useChatPanel({
	projectId,
	models,
	onStreamingStateChange,
}: UseChatPanelOptions) {
	const store = useChatStore(projectId);
	const {
		items,
		sessionId,
		opencodeReady,
		initialPromptSent,
		userPromptMessageId,
		projectPrompt,
		currentModel,
		historyLoaded,
		presenceLoaded,
		isStreaming,
		pendingImages,
		pendingImageError,
		latestDiagnostic,
		pendingPermission,
		pendingQuestion,
		todos,
		setSessionId,
		setOpenCodeReady,
		setInitialPromptSent,
		setUserPromptMessageId,
		setProjectPrompt,
		setCurrentModel,
		setHistoryLoaded,
		setPresenceLoaded,
		setIsStreaming,
		setPendingImages,
		setPendingImageError,
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
	const scrollRef = useRef<HTMLDivElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const reconnectAttemptsRef = useRef(0);
	const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const loadingHistoryRef = useRef(false);
	const configLoadedRef = useRef(false);
	const streamDegradedRef = useRef(false);

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
				type SessionListItem = { id?: string } | string;
				type SessionMessage = {
					info?: {
						id?: string;
						role?: "user" | "assistant";
						model?: { providerID: string; modelID: string };
						error?: { name?: string; data?: { message?: string } };
					};
					parts?: Array<{
						type?: string;
						id?: string;
						text?: string;
						tool?: string;
						callID?: string;
						state?: {
							input?: unknown;
							output?: unknown;
							status?: string;
							error?: unknown;
						};
					}>;
				};

				const sessionsData = await fetchJson<
					SessionListItem[] | { sessions?: SessionListItem[] }
				>(`/api/projects/${projectId}/opencode/session`);
				const sessions = Array.isArray(sessionsData)
					? sessionsData
					: sessionsData.sessions || [];
				if (sessions.length === 0) {
					setHistoryLoaded(true);
					loadingHistoryRef.current = false;
					return;
				}

				const latestSession = sessions[sessions.length - 1];
				const latestSessionId =
					typeof latestSession === "string" ? latestSession : latestSession?.id;
				if (!latestSessionId) {
					setHistoryLoaded(true);
					loadingHistoryRef.current = false;
					return;
				}
				setSessionId(latestSessionId);
				await refreshBlockingState(latestSessionId);

				const messagesData = await fetchJson<
					SessionMessage[] | { messages?: SessionMessage[] }
				>(
					`/api/projects/${projectId}/opencode/session/${latestSessionId}/message`,
				);
				const messages = Array.isArray(messagesData)
					? messagesData
					: messagesData.messages || [];

				const lastUserMessageWithModel = messages
					.filter(
						(message) => message.info?.role === "user" && message.info.model,
					)
					.pop();

				if (lastUserMessageWithModel?.info?.model) {
					setCurrentModel(
						normalizeMessageModel(lastUserMessageWithModel.info.model, models),
					);
				}

				const historyItems: ChatItem[] = [];
				let foundUserPrompt = false;

				for (const msg of messages) {
					const info = msg.info || {};
					const msgParts = msg.parts || [];
					const role = info.role;
					const messageId = info.id || `hist_${Date.now()}_${Math.random()}`;

					if (userPromptMessageId && !foundUserPrompt) {
						if (messageId === userPromptMessageId) foundUserPrompt = true;
						else continue;
					}

					if (role === "user" || role === "assistant") {
						const messageParts: MessagePart[] = [];
						const assistantError = info.error?.data?.message;
						for (const part of msgParts) {
							if (part.type === "text" && part.text) {
								messageParts.push(createTextPart(part.text, part.id));
							}
							if (part.type === "tool" && part.tool && part.callID) {
								historyItems.push({
									type: "tool",
									id: part.callID,
									data: {
										id: part.callID,
										name: part.tool,
										input: part.state?.input,
										output: part.state?.output,
										status:
											part.state?.status === "error" ? "error" : "success",
									},
								});
							}
						}
						if (role === "assistant" && assistantError) {
							messageParts.push(createErrorPart(assistantError));
						}
						if (messageParts.length > 0) {
							historyItems.push({
								type: "message",
								id: messageId,
								data: {
									id: messageId,
									role,
									parts: messageParts,
									isStreaming: false,
									localStatus: "sent",
								},
							});
						}
					}
				}
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
		setHistoryLoaded,
		setSessionId,
		setCurrentModel,
		fetchJson,
		refreshBlockingState,
		setItems,
		scrollToBottom,
		showRequestError,
	]);

	// Poll for readiness
	useEffect(() => {
		if (opencodeReady) return;
		const checkReady = async () => {
			try {
				const viewerId =
					sessionStorage.getItem(`viewer_${projectId}`) || `chat_${Date.now()}`;
				const { data, error } = await actions.projects.presence({
					projectId,
					viewerId,
				});
				if (!error && data.opencodeReady) {
					setOpenCodeReady(true);
					setInitialPromptSent(data.initialPromptSent);
					setUserPromptMessageId(data.userPromptMessageId);
					setProjectPrompt(data.prompt);
					if (data.bootstrapSessionId) setSessionId(data.bootstrapSessionId);
					setPresenceLoaded(true);
				}
			} catch {}
		};
		checkReady();
		pollIntervalRef.current = setInterval(checkReady, 2000);
		return () => {
			if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
		};
	}, [
		projectId,
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
						void actions.projects
							.presence({
								projectId,
								viewerId: `chat_reconnect_${Date.now()}`,
							})
							.then((result) => {
								if (result.error || !result.data?.opencodeReady) {
									setOpenCodeReady(false);
									return;
								}
								connect();
							})
							.catch(() => {
								setOpenCodeReady(false);
							});
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
		setOpenCodeReady,
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

	const handleSend = async (content: string, images?: ImagePart[]) => {
		const messageParts: MessagePart[] = [];
		if (images) {
			for (const img of images) {
				messageParts.push(
					createImagePart(
						img.dataUrl,
						img.filename,
						img.mime,
						img.size,
						img.id,
					),
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
			if (images) {
				for (const img of images) {
					apiParts.push({
						type: "file",
						mime: img.mime,
						url: img.dataUrl,
						filename: img.filename,
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
			setPendingImages([]);
			setPendingImageError(null);
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
		const newModelSupportsImages = newModelConfig?.supportsImages ?? true;

		if (pendingImages.length > 0 && !newModelSupportsImages) {
			setPendingImages([]);
			setPendingImageError(null);
			toast.info("Images cleared", {
				description: "The selected model doesn't support image input",
			});
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

	return {
		items,
		opencodeReady,
		isStreaming,
		pendingPermission,
		pendingQuestion,
		todos,
		pendingImages,
		pendingImageError,
		currentModel,
		expandedTools,
		scrollRef,
		latestDiagnostic,
		setPendingImages,
		setPendingImageError,
		handleSend,
		handleModelChange,
		handlePermissionDecision,
		handleQuestionSubmit,
		handleQuestionReject,
		toggleToolExpanded,
		handleScroll,
		clearDiagnostic: () => setLatestDiagnostic(null),
	};
}
