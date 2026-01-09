import { actions } from "astro:actions";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type ChatItem, useChatStore } from "@/stores/useChatStore";
import {
	createImagePart,
	createTextPart,
	type ImagePart,
	type Message,
	type MessagePart,
} from "@/types/message";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import type { ToolCall } from "./ToolCallDisplay";
import { ToolCallGroup } from "./ToolCallGroup";

interface ChatPanelProps {
	projectId: string;
	models?: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
	}>;
	onOpenFile?: ((filePath: string) => void) | undefined;
	onStreamingStateChange?:
		| ((userMessageCount: number, isStreaming: boolean) => void)
		| undefined;
}

/**
 * Normalize model ID from OpenCode messages by matching against available models.
 * OpenCode SDK strips vendor prefixes when sending models, but our UI needs them.
 * E.g., "claude-haiku-4-5" -> "anthropic/claude-haiku-4-5"
 */
function normalizeMessageModel(
	model: { providerID: string; modelID: string },
	availableModels: ReadonlyArray<{ id: string; provider: string }>,
): { providerID: string; modelID: string } {
	// If already has vendor prefix (contains /), return as-is
	if (model.modelID.includes("/")) {
		return model;
	}

	// Only normalize for opencode provider
	if (model.providerID !== "opencode") {
		return model;
	}

	// Try to find matching model in available models by checking if any model ID ends with our modelID
	// E.g., "claude-haiku-4-5" should match "anthropic/claude-haiku-4-5"
	const matchingModel = availableModels.find(
		(m) =>
			m.provider === "opencode" &&
			(m.id === model.modelID || m.id.endsWith(`/${model.modelID}`)),
	);

	if (matchingModel) {
		return {
			providerID: model.providerID,
			modelID: matchingModel.id,
		};
	}

	// Fallback: return as-is if no match found
	return model;
}

interface PresenceData {
	opencodeReady: boolean;
	initialPromptSent: boolean;
	userPromptMessageId: string | null;
	prompt: string;
	bootstrapSessionId: string | null;
}

export function ChatPanel({
	projectId,
	models = [],
	onOpenFile,
	onStreamingStateChange,
}: ChatPanelProps) {
	// Get chat store for this project
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

	// UI-only state (not in store)
	const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

	// Refs for managing side effects
	const scrollRef = useRef<HTMLDivElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const loadingHistoryRef = useRef(false);

	// Check if scroll position is near the bottom (within 100px)
	const isNearBottom = useCallback(() => {
		if (!scrollRef.current) return false;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		return scrollHeight - (scrollTop + clientHeight) < 100;
	}, []);

	// Auto-scroll to bottom (only if shouldAutoScroll is true)
	const scrollToBottom = useCallback(() => {
		if (scrollRef.current && shouldAutoScroll) {
			// Use setTimeout to ensure DOM has updated
			setTimeout(() => {
				if (scrollRef.current) {
					scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
				}
			}, 0);
		}
	}, [shouldAutoScroll]);

	// Handle manual scroll events
	const handleScroll = useCallback(() => {
		if (isNearBottom()) {
			setShouldAutoScroll(true);
		} else {
			setShouldAutoScroll(false);
		}
	}, [isNearBottom]);

	// Auto-scroll when items change (if shouldAutoScroll is enabled)
	useEffect(() => {
		if (shouldAutoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [shouldAutoScroll]);

	// Load model from OpenCode config on mount (before messages load)
	const configLoadedRef = useRef(false);
	useEffect(() => {
		if (!opencodeReady || configLoadedRef.current) return;

		const loadConfig = async () => {
			try {
				configLoadedRef.current = true;
				const res = await fetch(`/api/projects/${projectId}/opencode/config`);
				if (!res.ok) {
					return;
				}

				const config = await res.json();

				// Extract model from config (format: "provider/model" or "provider/vendor/model")
				if (config.model) {
					const parts = config.model.split("/");
					if (parts.length >= 2) {
						const model = {
							providerID: parts[0] as string,
							modelID: parts.slice(1).join("/"),
						};

						// Set model from config
						setCurrentModel(model);
					}
				}
			} catch (error) {
				// Silently fail - will fall back to first available model
			}
		};

		loadConfig();
	}, [projectId, opencodeReady, setCurrentModel]);

	// Load existing session history when opencode is ready
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
				// Get list of sessions
				const sessionsRes = await fetch(
					`/api/projects/${projectId}/opencode/session`,
				);
				if (!sessionsRes.ok) {
					loadingHistoryRef.current = false;
					setHistoryLoaded(true);
					return;
				}

				const sessionsData = await sessionsRes.json();
				const sessions = sessionsData.sessions || sessionsData || [];

				if (sessions.length === 0) {
					loadingHistoryRef.current = false;
					setHistoryLoaded(true);
					return;
				}

				// Use the most recent session
				const latestSession = sessions[sessions.length - 1];
				const latestSessionId = latestSession.id || latestSession;
				setSessionId(latestSessionId);

				// Get messages for this session
				const messagesRes = await fetch(
					`/api/projects/${projectId}/opencode/session/${latestSessionId}/message`,
				);
				if (!messagesRes.ok) {
					loadingHistoryRef.current = false;
					setHistoryLoaded(true);
					return;
				}

				const messagesData = await messagesRes.json();
				const messages = Array.isArray(messagesData)
					? messagesData
					: messagesData.messages || [];

				// Extract model from last user message (like OpenCode does)
				// Find the last user message that has a model
				const lastUserMessageWithModel = messages
					.filter((m: any) => {
						const info = m.info || {};
						return info.role === "user" && info.model;
					})
					.pop();

				// If messages have a model, override the config model
				if (lastUserMessageWithModel?.info?.model) {
					const normalizedModel = normalizeMessageModel(
						lastUserMessageWithModel.info.model,
						models,
					);
					setCurrentModel(normalizedModel);
				}

				// Convert messages to chat items
				const historyItems: ChatItem[] = [];
				let foundUserPrompt = false;

				for (const msg of messages) {
					const info = msg.info || {};
					const msgParts = msg.parts || [];
					const role = info.role;
					const messageId =
						info.id ||
						`hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

					if (userPromptMessageId && !foundUserPrompt) {
						if (messageId === userPromptMessageId) {
							foundUserPrompt = true;
						} else {
							continue;
						}
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
											part.state?.status === "completed"
												? "success"
												: part.state?.status === "error"
													? "error"
													: "success",
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
									role: role as "user" | "assistant",
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
			} catch (error) {
				console.error("Failed to load chat history:", error);
			}

			loadingHistoryRef.current = false;
			setHistoryLoaded(true);
		};

		loadHistory();
	}, [
		projectId,
		opencodeReady,
		historyLoaded,
		setHistoryLoaded,
		setSessionId,
		setItems,
		scrollToBottom,
		userPromptMessageId,
		presenceLoaded,
		setCurrentModel,
		models,
	]);

	// Poll for opencode readiness and handle initial prompt
	useEffect(() => {
		if (opencodeReady) return;

		const checkReady = async () => {
			try {
				const viewerId =
					sessionStorage.getItem(`viewer_${projectId}`) || `chat_${Date.now()}`;
				const response = await fetch(`/api/projects/${projectId}/presence`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ viewerId }),
				});
				if (response.ok) {
					const data = (await response.json()) as PresenceData;
					if (data.opencodeReady) {
						setOpenCodeReady(true);
						setInitialPromptSent(data.initialPromptSent);
						setUserPromptMessageId(data.userPromptMessageId);
						setProjectPrompt(data.prompt);
						if (data.bootstrapSessionId) {
							setSessionId(data.bootstrapSessionId);
						}
						setPresenceLoaded(true);
					}
				}
			} catch {
				// Ignore errors
			}
		};

		checkReady();
		pollIntervalRef.current = setInterval(checkReady, 2000);

		return () => {
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
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

	// Load initial prompt message when opencode is ready
	useEffect(() => {
		if (!opencodeReady || initialPromptSent || !projectPrompt || !sessionId) {
			return;
		}

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

	// Notify parent when streaming state or user message count changes
	useEffect(() => {
		const userMessageCount = items.filter((item) => {
			if (item.type === "message") {
				const msg = item.data as Message;
				return msg.role === "user";
			}
			return false;
		}).length;
		onStreamingStateChange?.(userMessageCount, isStreaming);
	}, [items, isStreaming, onStreamingStateChange]);

	// Connect to event stream
	useEffect(() => {
		if (!opencodeReady) return;

		const controller = new AbortController();
		const eventSource = new EventSource(
			`/api/projects/${projectId}/opencode/event`,
		);
		eventSourceRef.current = eventSource;

		const handleChatEventWrapper = (e: Event) => {
			if (controller.signal.aborted) return;

			try {
				const messageEvent = e as MessageEvent<string>;
				const event = JSON.parse(messageEvent.data);
				handleChatEvent(event);
			} catch {
				// Ignore parse errors
			}
		};

		eventSource.addEventListener("chat.event", handleChatEventWrapper);

		eventSource.onerror = () => {
			if (controller.signal.aborted) {
				eventSource.close();
				return;
			}

			eventSource.close();
			eventSourceRef.current = null;

			const timeoutId = setTimeout(() => {
				if (!controller.signal.aborted && eventSourceRef.current === null) {
					// Will be handled by the useEffect cleanup/re-run
				}
			}, 2000);

			controller.signal.addEventListener("abort", () => {
				clearTimeout(timeoutId);
			});
		};

		return () => {
			controller.abort();
			eventSource.removeEventListener("chat.event", handleChatEventWrapper);
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [projectId, opencodeReady, handleChatEvent]);

	const handleSend = async (content: string, images?: ImagePart[]) => {
		const messageParts: MessagePart[] = [];

		if (images && images.length > 0) {
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

		if (content) {
			messageParts.push(createTextPart(content));
		}

		const userMessageId = `user_${Date.now()}`;
		addItem({
			type: "message",
			id: userMessageId,
			data: {
				id: userMessageId,
				role: "user",
				parts: messageParts,
			},
		});
		scrollToBottom();

		try {
			let currentSessionId = sessionId;

			if (!currentSessionId) {
				const createRes = await fetch(
					`/api/projects/${projectId}/opencode/session`,
					{ method: "POST" },
				);
				if (createRes.ok) {
					const data = await createRes.json();
					currentSessionId = data.id;
					setSessionId(currentSessionId as string);
				}
			}

			if (!currentSessionId) {
				console.error("Failed to get session");
				return;
			}

			const apiParts: Array<{
				type: string;
				text?: string;
				mime?: string;
				url?: string;
				filename?: string;
			}> = [];

			if (content) {
				apiParts.push({ type: "text", text: content });
			}

			if (images && images.length > 0) {
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
						// Always pass model explicitly (OpenCode handles fallbacks)
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
		// Parse composite key format: "provider:modelId"
		const [providerId, ...modelIdParts] = compositeKey.split(":");
		const modelId = modelIdParts.join(":"); // Handle modelIDs that might contain ':'

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

		// Create model object in OpenCode's format
		const newModel = newModelConfig
			? {
					providerID: newModelConfig.provider,
					modelID: newModelConfig.id,
				}
			: null;

		const previousModel = currentModel;
		setCurrentModel(newModel);

		try {
			// Store in opencode.json for persistence (using string format)
			const modelString = newModel
				? `${newModel.providerID}/${newModel.modelID}`
				: null;

			const result = await actions.projects.updateModel({
				projectId,
				model: modelString || "",
			});

			if (!result.data?.success) {
				setCurrentModel(previousModel);
				console.error("Failed to update model");
			}
		} catch (error) {
			setCurrentModel(previousModel);
			console.error("Failed to update model:", error);
		}
	};

	const toggleToolExpanded = (id: string) => {
		setExpandedTools((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const groupConsecutiveTools = (
		items: ChatItem[],
	): (ChatItem | { type: "toolGroup"; id: string; data: ToolCall[] })[] => {
		const grouped: (
			| ChatItem
			| { type: "toolGroup"; id: string; data: ToolCall[] }
		)[] = [];

		for (let i = 0; i < items.length; i++) {
			const item = items[i]!;

			if (item.type === "tool") {
				const toolGroup: ToolCall[] = [item.data as ToolCall];

				while (i + 1 < items.length && items[i + 1]?.type === "tool") {
					i++;
					const nextItem = items[i];
					if (nextItem) {
						toolGroup.push(nextItem.data as ToolCall);
					}
				}

				grouped.push({
					type: "toolGroup",
					id: `group_${toolGroup.map((t) => t.id).join("_")}`,
					data: toolGroup,
				});
			} else {
				grouped.push(item);
			}
		}

		return grouped;
	};

	return (
		<div className="flex flex-col h-full">
			<div
				className="flex-1 overflow-y-auto"
				ref={scrollRef}
				onScroll={handleScroll}
			>
				{items.length === 0 ? (
					<div className="flex items-center justify-center h-full text-muted-foreground">
						{opencodeReady ? (
							<p>Send a message to start chatting</p>
						) : (
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								<p>Waiting for opencode...</p>
							</div>
						)}
					</div>
				) : (
					<div className="divide-y">
						{groupConsecutiveTools(items).map((item) =>
							item.type === "message" ? (
								<ChatMessage key={item.id} message={item.data as Message} />
							) : item.type === "toolGroup" ? (
								<ToolCallGroup
									key={item.id}
									toolCalls={item.data as ToolCall[]}
									expandedTools={expandedTools}
									onToggle={toggleToolExpanded}
									onFileOpen={onOpenFile}
								/>
							) : null,
						)}
					</div>
				)}
			</div>

			{(() => {
				// Build composite key: "provider:modelId" for the UI
				const compositeModelKey = currentModel
					? `${currentModel.providerID}:${currentModel.modelID}`
					: null;
				const modelSupport =
					models.find(
						(m) =>
							currentModel &&
							m.id === currentModel.modelID &&
							m.provider === currentModel.providerID,
					)?.supportsImages ?? true;
				return (
					<ChatInput
						onSend={handleSend}
						disabled={!opencodeReady || isStreaming}
						placeholder={
							!opencodeReady
								? "Waiting for opencode..."
								: isStreaming
									? "Processing..."
									: "Type a message..."
						}
						model={compositeModelKey}
						models={models}
						onModelChange={handleModelChange}
						images={pendingImages}
						onImagesChange={setPendingImages}
						imageError={pendingImageError}
						onImageError={setPendingImageError}
						supportsImages={modelSupport}
					/>
				);
			})()}
		</div>
	);
}
