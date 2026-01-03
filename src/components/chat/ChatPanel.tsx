import { actions } from "astro:actions";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	createImagePart,
	createTextPart,
	type ImagePart,
	type Message,
	type ToolCall,
} from "@/types/message";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import type { ToolCall as ToolCallType } from "./ToolCallDisplay";
import { ToolCallGroup } from "./ToolCallGroup";
import { useChatSession } from "@/hooks/useChatSession";
import { useChatEvents, createMessageFromEvent } from "@/hooks/useChatEvents";
import { useChatHistory } from "@/hooks/useChatHistory";

interface ChatPanelProps {
	projectId: string;
	models?: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		supportsImages?: boolean;
	}>;
	onOpenFile?: ((filePath: string) => void) | undefined;
}

interface ChatItem {
	type: "message" | "tool";
	id: string;
	data: Message | ToolCall;
}

export function ChatPanel({
	projectId,
	models = [],
	onOpenFile,
}: ChatPanelProps) {
	const [items, setItems] = useState<ChatItem[]>([]);
	const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
	const [pendingImages, setPendingImages] = useState<ImagePart[]>([]);
	const [pendingImageError, setPendingImageError] = useState<string | null>(
		null,
	);
	const scrollRef = useCallback((el: HTMLDivElement | null) => {
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, []);

	const {
		sessionId,
		presenceLoaded,
		opencodeReady,
		initialPromptSent,
		userPromptMessageId,
		projectPrompt,
		currentModel,
		setOpencodeReady,
		setInitialPromptSent,
		setUserPromptMessageId,
		setProjectPrompt,
		setCurrentModel,
		setSessionId,
	} = useChatSession({
		projectId,
		opencodeReady: false,
		onSessionIdChange: (id) => {
			if (id) {
				setSessionId(id);
			}
		},
	});

	const { isStreaming, setStreaming } = useChatEvents({
		projectId,
		opencodeReady,
		sessionId,
	});

	const { historyLoaded, loadHistory } = useChatHistory({
		projectId,
		userPromptMessageId,
		scrollToBottom: () => {},
	});

	const scrollToBottom = useCallback(() => {
		if (scrollRef.current && shouldAutoScroll) {
			setTimeout(() => {
				if (scrollRef.current) {
					scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
				}
			}, 0);
		}
	}, [shouldAutoScroll]);

	const isNearBottom = useCallback(() => {
		if (!scrollRef.current) return false;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		return scrollHeight - (scrollTop + clientHeight) < 100;
	}, []);

	const handleScroll = useCallback(() => {
		if (isNearBottom()) {
			setShouldAutoScroll(true);
		} else {
			setShouldAutoScroll(false);
		}
	}, [isNearBottom]);

	useEffect(() => {
		if (shouldAutoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [items, shouldAutoScroll]);

	useEffect(() => {
		if (
			!opencodeReady ||
			historyLoaded ||
			loadingHistoryRef.current ||
			!presenceLoaded
		)
			return;

		const loadHistoryAsync = async () => {
			loadingHistoryRef.current = true;
			const historyItems = await loadHistory();
			if (historyItems.length > 0) {
				setItems(historyItems);
				setTimeout(scrollToBottom, 100);
			}
			loadingHistoryRef.current = false;
		};

		loadHistoryAsync();
	}, [
		opencodeReady,
		historyLoaded,
		presenceLoaded,
		loadHistory,
		scrollToBottom,
	]);

	useEffect(() => {
		if (!opencodeReady || initialPromptSent || !projectPrompt || !sessionId) {
			return;
		}

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
		setInitialPromptSent(true);
	}, [
		opencodeReady,
		initialPromptSent,
		projectPrompt,
		sessionId,
		scrollToBottom,
		setInitialPromptSent,
	]);

	const handleEvent = useCallback(
		(event: {
			type: string;
			payload: Record<string, unknown>;
			sessionId?: string;
		}) => {
			const { type, sessionId: eventSessionId } = event;

			if (eventSessionId && !sessionId) {
				setSessionId(eventSessionId as string);
			}

			if (
				type === "chat.message.part.added" ||
				type === "chat.message.delta" ||
				type === "chat.message.final" ||
				type === "chat.tool.update"
			) {
				setItems((prev) =>
					createMessageFromEvent(event as any, prev, scrollToBottom),
				);

				if (type !== "chat.message.final" && type !== "chat.session.status") {
					setStreaming(true);
					scrollToBottom();
				}
			}
		},
		[sessionId, setSessionId, setStreaming, scrollToBottom],
	);

	useEffect(() => {
		if (!opencodeReady) return;

		const controller = new AbortController();
		const eventSource = new EventSource(
			`/api/projects/${projectId}/opencode/event`,
		);

		const handleChatEvent = (e: Event) => {
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
			if (controller.signal.aborted) {
				eventSource.close();
				return;
			}

			eventSource.close();
		};

		return () => {
			controller.abort();
			eventSource.removeEventListener("chat.event", handleChatEvent);
			eventSource.close();
		};
	}, [projectId, opencodeReady, handleEvent]);

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
						...(currentModel && {
							model: {
								providerID: "openrouter",
								modelID: currentModel,
							},
						}),
					}),
				},
			);

			if (res.ok || res.status === 204) {
				setStreaming(true);
				setPendingImages([]);
				setPendingImageError(null);
			}
		} catch (error) {
			console.error("Failed to send message:", error);
		}
	};

	const handleModelChange = async (newModelId: string) => {
		const newModelConfig = models.find((m) => m.id === newModelId);
		const newModelSupportsImages = newModelConfig?.supportsImages ?? true;

		if (pendingImages.length > 0 && !newModelSupportsImages) {
			setPendingImages([]);
			setPendingImageError(null);
			toast.info("Images cleared", {
				description: "The selected model doesn't support image input",
			});
		}

		const previousModel = currentModel;
		setCurrentModel(newModelId);

		try {
			const result = await actions.projects.updateModel({
				projectId,
				model: newModelId,
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
		itemsToGroup: ChatItem[],
	): (ChatItem | { type: "toolGroup"; id: string; data: ToolCall[] })[] => {
		const grouped: (
			| ChatItem
			| { type: "toolGroup"; id: string; data: ToolCall[] }
		)[] = [];

		for (let i = 0; i < itemsToGroup.length; i++) {
			const item = itemsToGroup[i]!;

			if (item.type === "tool") {
				const toolGroup: ToolCall[] = [item.data as ToolCall];

				while (
					i + 1 < itemsToGroup.length &&
					itemsToGroup[i + 1]?.type === "tool"
				) {
					i++;
					const nextItem = itemsToGroup[i];
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
									toolCalls={item.data as ToolCallType[]}
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

let loadingHistoryRef = { current: false };
