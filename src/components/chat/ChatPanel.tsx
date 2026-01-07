import { actions } from "astro:actions";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
}

interface ChatItem {
	type: "message" | "tool";
	id: string;
	data: Message | ToolCall;
}

interface PresenceData {
	opencodeReady: boolean;
	initialPromptSent: boolean;
	userPromptMessageId: string | null;
	prompt: string;
	model: string | null;
	bootstrapSessionId: string | null;
}

export function ChatPanel({
	projectId,
	models = [],
	onOpenFile,
}: ChatPanelProps) {
	const [items, setItems] = useState<ChatItem[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [opencodeReady, setOpencodeReady] = useState(false);
	const [initialPromptSent, setInitialPromptSent] = useState(true); // Assume sent until we know otherwise
	const [userPromptMessageId, setUserPromptMessageId] = useState<string | null>(
		null,
	);
	const [projectPrompt, setProjectPrompt] = useState<string | null>(null);
	const [currentModel, setCurrentModel] = useState<string | null>(null);
	const [historyLoaded, setHistoryLoaded] = useState(false);
	const [presenceLoaded, setPresenceLoaded] = useState(false);
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
	// Pending images for the chat input (lifted state for model switch handling)
	const [pendingImages, setPendingImages] = useState<ImagePart[]>([]);
	const [pendingImageError, setPendingImageError] = useState<string | null>(
		null,
	);
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
			// User scrolled back to bottom, re-enable auto-scroll
			setShouldAutoScroll(true);
		} else {
			// User scrolled up, disable auto-scroll
			setShouldAutoScroll(false);
		}
	}, [isNearBottom]);

	// Auto-scroll when items change (if shouldAutoScroll is enabled)
	useEffect(() => {
		if (shouldAutoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [items, shouldAutoScroll]);

	// Load existing session history when opencode is ready
	// We must wait for initPromptMessageId to be set (or confirmed null) before loading history
	// so we can properly filter out the init prompt conversation
	useEffect(() => {
		// Wait for opencodeReady and for presence data to be fully loaded
		// presenceLoaded ensures initPromptMessageId has been populated from presence API
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
				// API returns array of { info, parts } objects
				const messages = Array.isArray(messagesData)
					? messagesData
					: messagesData.messages || [];

				// Convert messages to chat items
				const historyItems: ChatItem[] = [];

				// Filter out init prompt conversation (AGENTS.md generation)
				// We skip ALL messages BEFORE the userPromptMessageId
				// This hides the initialization conversation from users
				let foundUserPrompt = false;

				for (const msg of messages) {
					const info = msg.info || {};
					const msgParts = msg.parts || [];
					const role = info.role;
					const messageId =
						info.id ||
						`hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

					// If we have a userPromptMessageId, skip all messages until we find it
					if (userPromptMessageId && !foundUserPrompt) {
						if (messageId === userPromptMessageId) {
							foundUserPrompt = true;
							// Continue to process this message (don't skip it)
						} else {
							continue; // Skip this message (it's part of init prompt conversation)
						}
					}

					if (role === "user" || role === "assistant") {
						// Build structured parts for this message
						const messageParts: MessagePart[] = [];

						for (const part of msgParts) {
							if (part.type === "text" && part.text) {
								messageParts.push(createTextPart(part.text, part.id));
							}
							// Handle tool calls in history
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
		scrollToBottom,
		userPromptMessageId,
		presenceLoaded,
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
						setOpencodeReady(true);
						setInitialPromptSent(data.initialPromptSent);
						setUserPromptMessageId(data.userPromptMessageId);
						setProjectPrompt(data.prompt);
						setCurrentModel(data.model);
						// Set session ID from bootstrap session created by queue
						if (data.bootstrapSessionId) {
							setSessionId(data.bootstrapSessionId);
						}
						// Mark presence data as loaded so history can be fetched with proper filtering
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
	}, [projectId, opencodeReady]);

	// Load initial prompt message when opencode is ready and prompt hasn't been sent yet
	useEffect(() => {
		if (!opencodeReady || initialPromptSent || !projectPrompt || !sessionId) {
			return;
		}

		// Add user message to UI to show the initial project prompt
		const userMessageId = `user_initial_${Date.now()}`;
		setItems((prev) => [
			...prev,
			{
				type: "message",
				id: userMessageId,
				data: {
					id: userMessageId,
					role: "user",
					parts: [createTextPart(projectPrompt)],
				},
			},
		]);
		scrollToBottom();

		// Mark that we've displayed the initial prompt in UI
		setInitialPromptSent(true);
	}, [
		opencodeReady,
		initialPromptSent,
		projectPrompt,
		sessionId,
		scrollToBottom,
	]);

	// Connect to event stream
	useEffect(() => {
		if (!opencodeReady) return;

		const controller = new AbortController();
		const eventSource = new EventSource(
			`/api/projects/${projectId}/opencode/event`,
		);
		eventSourceRef.current = eventSource;

		const handleChatEvent = (e: Event) => {
			// Prevent handler execution after abort
			if (controller.signal.aborted) return;

			try {
				const messageEvent = e as MessageEvent<string>;
				const event = JSON.parse(messageEvent.data);
				handleEvent(event);
			} catch {
				// Ignore parse errors
			}
		};

		eventSource.addEventListener("chat.event", handleChatEvent);

		eventSource.onerror = () => {
			// Prevent further processing if component is unmounting
			if (controller.signal.aborted) {
				eventSource.close();
				return;
			}

			// Close current connection
			eventSource.close();
			eventSourceRef.current = null;

			// Reconnect after a delay, but only if not aborted
			const timeoutId = setTimeout(() => {
				if (!controller.signal.aborted && eventSourceRef.current === null) {
					// Will be handled by the useEffect cleanup/re-run
				}
			}, 2000);

			// Cleanup timeout if abort signal fires
			controller.signal.addEventListener("abort", () => {
				clearTimeout(timeoutId);
			});
		};

		return () => {
			// Signal abort to prevent all async operations
			controller.abort();

			// Manually remove event listener
			eventSource.removeEventListener("chat.event", handleChatEvent);

			// Close connection
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [projectId, opencodeReady]);

	const handleEvent = (event: {
		type: string;
		projectId: string;
		sessionId?: string;
		payload: Record<string, unknown>;
	}) => {
		const { type, payload, sessionId: eventSessionId } = event;

		if (eventSessionId && !sessionId) {
			setSessionId(eventSessionId as string);
		}

		switch (type) {
			case "chat.message.part.added": {
				const { messageId, partId, partType, deltaText } = payload as {
					messageId: string;
					partId: string;
					partType: string;
					deltaText?: string;
				};

				setItems((prev) => {
					const existing = prev.find(
						(item) => item.type === "message" && item.id === messageId,
					);

					if (existing && existing.type === "message") {
						const msg = existing.data as Message;
						// Find or create text part
						const textPart = msg.parts.find((p) => p.type === "text") as any;

						// Create new parts array instead of mutating
						let updatedParts: MessagePart[];
						if (textPart && deltaText) {
							// Append delta to existing text part (create new part object)
							updatedParts = msg.parts.map((part) =>
								part === textPart && part.type === "text"
									? { ...part, text: part.text + deltaText }
									: part,
							);
						} else if (deltaText) {
							// Create new text part
							updatedParts = [...msg.parts, createTextPart(deltaText, partId)];
						} else {
							updatedParts = msg.parts;
						}

						return prev.map((item) =>
							item.id === messageId
								? {
										...item,
										data: { ...msg, parts: updatedParts, isStreaming: true },
									}
								: item,
						);
					}

					// New message
					if (partType === "text" && deltaText) {
						return [
							...prev,
							{
								type: "message",
								id: messageId,
								data: {
									id: messageId,
									role: "assistant",
									parts: [createTextPart(deltaText, partId)],
									isStreaming: true,
								},
							},
						];
					}
					return prev;
				});

				setIsStreaming(true);
				scrollToBottom();
				break;
			}

			case "chat.message.delta": {
				// Backward compatibility: handle old-style delta events
				const { messageId, deltaText } = payload as {
					messageId: string;
					deltaText: string;
				};

				setItems((prev) => {
					const existing = prev.find(
						(item) => item.type === "message" && item.id === messageId,
					);

					if (existing && existing.type === "message") {
						const msg = existing.data as Message;
						const textPart = msg.parts[msg.parts.length - 1];

						// Create new parts array instead of mutating
						let updatedParts: MessagePart[];
						if (textPart && textPart.type === "text") {
							// Append to existing text part (create new part object)
							updatedParts = msg.parts.map((part, index) =>
								index === msg.parts.length - 1 && part.type === "text"
									? { ...part, text: part.text + deltaText }
									: part,
							);
						} else {
							// Create new text part
							updatedParts = [...msg.parts, createTextPart(deltaText)];
						}

						return prev.map((item) =>
							item.id === messageId
								? {
										...item,
										data: { ...msg, parts: updatedParts, isStreaming: true },
									}
								: item,
						);
					}

					// New message
					return [
						...prev,
						{
							type: "message",
							id: messageId,
							data: {
								id: messageId,
								role: "assistant",
								parts: [createTextPart(deltaText)],
								isStreaming: true,
							},
						},
					];
				});

				setIsStreaming(true);
				scrollToBottom();
				break;
			}

			case "chat.message.final": {
				const { messageId } = payload as { messageId: string };

				setItems((prev) =>
					prev.map((item) =>
						item.id === messageId && item.type === "message"
							? {
									...item,
									data: { ...(item.data as Message), isStreaming: false },
								}
							: item,
					),
				);

				setIsStreaming(false);
				break;
			}

			case "chat.reasoning.part": {
				// Reasoning parts are handled as visual elements within messages
				// For now, we'll treat them similarly to tool parts - as separate items
				// This can be enhanced later to nest them within messages
				break;
			}

			case "chat.tool.update": {
				const { toolCallId, name, input, status, output, error } = payload as {
					toolCallId: string;
					name: string;
					input?: unknown;
					status: "running" | "success" | "error";
					output?: unknown;
					error?: unknown;
				};

				setItems((prev) => {
					// Check if tool already exists
					const existingIdx = prev.findIndex(
						(item) => item.type === "tool" && item.id === toolCallId,
					);

					if (existingIdx !== -1) {
						// Update existing tool
						return prev.map((item, idx) =>
							idx === existingIdx && item.type === "tool"
								? {
										...item,
										data: {
											...(item.data as ToolCall),
											input,
											output,
											error,
											status,
										},
									}
								: item,
						);
					}

					// Create new tool item
					return [
						...prev,
						{
							type: "tool",
							id: toolCallId,
							data: {
								id: toolCallId,
								name,
								input,
								output,
								error,
								status,
							},
						},
					];
				});

				scrollToBottom();
				break;
			}

			case "chat.session.status": {
				const { status } = payload as { status: string };
				if (status === "completed" || status === "idle") {
					setIsStreaming(false);
				}
				break;
			}
		}
	};

	const handleSend = async (content: string, images?: ImagePart[]) => {
		// Build message parts for UI
		const messageParts: MessagePart[] = [];

		// Add images first (displayed above text, following OpenCode pattern)
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

		// Add text part
		if (content) {
			messageParts.push(createTextPart(content));
		}

		// Add user message to UI immediately
		const userMessageId = `user_${Date.now()}`;
		setItems((prev) => [
			...prev,
			{
				type: "message",
				id: userMessageId,
				data: {
					id: userMessageId,
					role: "user",
					parts: messageParts,
				},
			},
		]);
		scrollToBottom();

		// Send to opencode
		try {
			// First, get or create a session
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

			// Build parts for API (following OpenCode pattern: images as "file" type)
			const apiParts: Array<{
				type: string;
				text?: string;
				mime?: string;
				url?: string;
				filename?: string;
			}> = [];

			// Add text part first for API
			if (content) {
				apiParts.push({ type: "text", text: content });
			}

			// Add images as file parts (OpenCode pattern)
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

			// Send message (async - response comes via SSE)
			const res = await fetch(
				`/api/projects/${projectId}/opencode/session/${currentSessionId}/prompt_async`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						parts: apiParts,
						// Include model if available - currentModel is in format "provider/vendor/model"
						...(currentModel && {
							model: (() => {
								const parts = currentModel.split("/");
								if (parts.length >= 2) {
									return {
										providerID: parts[0],
										modelID: parts.slice(1).join("/"),
									};
								}
								// Fallback for plain model IDs (shouldn't happen but be safe)
								return {
									providerID: "openrouter",
									modelID: currentModel,
								};
							})(),
						}),
					}),
				},
			);

			// prompt_async returns 204 No Content on success
			if (res.ok || res.status === 204) {
				setIsStreaming(true);
				// Clear pending images after successful send
				setPendingImages([]);
				setPendingImageError(null);
			}
		} catch (error) {
			console.error("Failed to send message:", error);
		}
	};

	const handleModelChange = async (newModelId: string) => {
		// newModelId is now without provider prefix (e.g., "google/gemini-3-flash")
		// Check if new model supports images
		const newModelConfig = models.find((m) => m.id === newModelId);
		const newModelSupportsImages = newModelConfig?.supportsImages ?? true;

		// Clear pending images if switching to a model that doesn't support them
		if (pendingImages.length > 0 && !newModelSupportsImages) {
			setPendingImages([]);
			setPendingImageError(null);
			toast.info("Images cleared", {
				description: "The selected model doesn't support image input",
			});
		}

		// Combine provider and model ID for storage
		const fullModelId = newModelConfig
			? `${newModelConfig.provider}/${newModelConfig.id}`
			: newModelId;

		// Optimistic update - update UI immediately
		const previousModel = currentModel;
		setCurrentModel(fullModelId);

		try {
			const result = await actions.projects.updateModel({
				projectId,
				model: fullModelId,
			});

			if (!result.data?.success) {
				// Revert on error
				setCurrentModel(previousModel);
				console.error("Failed to update model");
			}
		} catch (error) {
			// Revert on error
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
				// Collect consecutive tool items
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
				const modelSupport =
					models.find((m) => m.id === currentModel)?.supportsImages ?? true;
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
						model={currentModel}
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
