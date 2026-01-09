import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useChatStore } from "@/stores/useChatStore";
import {
	createTextPart,
	createImagePart,
	type ImagePart,
	type Message,
	type MessagePart,
} from "@/types/message";
import { actions } from "astro:actions";

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
		handleChatEvent,
	} = store;

	const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const loadingHistoryRef = useRef(false);
	const configLoadedRef = useRef(false);

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

	// Load model from OpenCode config
	useEffect(() => {
		if (!opencodeReady || configLoadedRef.current) return;

		const loadConfig = async () => {
			try {
				configLoadedRef.current = true;
				const res = await fetch(`/api/projects/${projectId}/opencode/config`);
				if (!res.ok) return;
				const config = await res.json();
				if (config.model) {
					const parts = config.model.split("/");
					if (parts.length >= 2) {
						setCurrentModel({
							providerID: parts[0],
							modelID: parts.slice(1).join("/"),
						});
					}
				}
			} catch {}
		};
		loadConfig();
	}, [projectId, opencodeReady, setCurrentModel]);

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
				const sessionsRes = await fetch(
					`/api/projects/${projectId}/opencode/session`,
				);
				if (!sessionsRes.ok) {
					setHistoryLoaded(true);
					loadingHistoryRef.current = false;
					return;
				}
				const sessionsData = await sessionsRes.json();
				const sessions = sessionsData.sessions || sessionsData || [];
				if (sessions.length === 0) {
					setHistoryLoaded(true);
					loadingHistoryRef.current = false;
					return;
				}

				const latestSession = sessions[sessions.length - 1];
				const latestSessionId = latestSession.id || latestSession;
				setSessionId(latestSessionId);

				const messagesRes = await fetch(
					`/api/projects/${projectId}/opencode/session/${latestSessionId}/message`,
				);
				if (!messagesRes.ok) {
					setHistoryLoaded(true);
					loadingHistoryRef.current = false;
					return;
				}
				const messagesData = await messagesRes.json();
				const messages = Array.isArray(messagesData)
					? messagesData
					: messagesData.messages || [];

				const lastUserMessageWithModel = messages
					.filter((m: any) => m.info?.role === "user" && m.info?.model)
					.pop();

				if (lastUserMessageWithModel?.info?.model) {
					setCurrentModel(
						normalizeMessageModel(lastUserMessageWithModel.info.model, models),
					);
				}

				const historyItems: any[] = [];
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
						if (messageParts.length > 0) {
							historyItems.push({
								type: "message",
								id: messageId,
								data: {
									id: messageId,
									role,
									parts: messageParts,
									isStreaming: false,
								},
							});
						}
					}
				}
				if (historyItems.length > 0) {
					setItems(historyItems);
					setTimeout(scrollToBottom, 100);
				}
			} catch {}
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
		setItems,
		scrollToBottom,
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
		const eventSource = new EventSource(
			`/api/projects/${projectId}/opencode/event`,
		);
		eventSourceRef.current = eventSource;
		const handler = (e: any) => {
			try {
				handleChatEvent(JSON.parse(e.data));
			} catch {}
		};
		eventSource.addEventListener("chat.event", handler);
		eventSource.onerror = () => {
			eventSource.close();
			eventSourceRef.current = null;
		};
		return () => {
			eventSource.removeEventListener("chat.event", handler);
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [projectId, opencodeReady, handleChatEvent]);

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
			data: { id: userMessageId, role: "user", parts: messageParts },
		});
		scrollToBottom();

		try {
			let currentSessionId = sessionId;
			if (!currentSessionId) {
				const res = await fetch(`/api/projects/${projectId}/opencode/session`, {
					method: "POST",
				});
				if (res.ok) {
					const data = await res.json();
					currentSessionId = data.id;
					setSessionId(currentSessionId!);
				}
			}
			if (!currentSessionId) return;

			const apiParts: any[] = [];
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

			const res = await fetch(
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
			if (res.ok || res.status === 204) {
				setIsStreaming(true);
				setPendingImages([]);
				setPendingImageError(null);
			}
		} catch (error) {
			console.error("Failed to send message:", error);
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
		pendingImages,
		pendingImageError,
		currentModel,
		expandedTools,
		scrollRef,
		setPendingImages,
		setPendingImageError,
		handleSend,
		handleModelChange,
		toggleToolExpanded,
		handleScroll,
	};
}
