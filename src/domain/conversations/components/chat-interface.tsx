import { actions } from "astro:actions";
import {
	Check,
	ChevronDown,
	ChevronRight,
	FileCode,
	Loader2,
	Send,
	Settings2,
	Square,
	Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	refreshCodePreview,
	setInitialGenerationInProgress,
} from "@/components/code-preview";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack";
import { Google } from "@/components/ui/svgs/google";
import { GrokDark } from "@/components/ui/svgs/grokDark";
import { KimiIcon } from "@/components/ui/svgs/kimiIcon";
import { Openai } from "@/components/ui/svgs/openai";
import { Textarea } from "@/components/ui/textarea";
import {
	AVAILABLE_AI_MODELS,
	DEFAULT_AI_MODEL,
} from "@/domain/llms/models/ai-models";
import { createLogger } from "@/lib/logger";

const logger = createLogger("chat-interface");

interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	tools?: string[];
	// Raw OpenCode message/part payload for richer UIs later
	_raw?: any;
}

interface AgentTodoItem {
	id: string;
	content: string;
	status: string;
	priority: string;
}

function formatTodoLabel(value: string): string {
	return value
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

const TODO_STATUS_STYLES: Record<string, string> = {
	pending: "text-muted border-border/70",
	in_progress: "text-warning border-border/70",
	completed: "text-strong border-border/70",
	cancelled: "text-danger border-border/70",
};

const TODO_PRIORITY_STYLES: Record<string, string> = {
	high: "text-danger border-border/70",
	medium: "text-strong border-border/70",
	low: "text-muted border-border/70",
};

function coerceTodos(value: unknown): AgentTodoItem[] | null {
	if (!value) return null;

	if (Array.isArray(value)) {
		return value as AgentTodoItem[];
	}

	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? (parsed as AgentTodoItem[]) : null;
		} catch {
			return null;
		}
	}

	if (typeof value === "object") {
		const obj = value as Record<string, unknown>;
		if (Array.isArray(obj.todos)) {
			return obj.todos as AgentTodoItem[];
		}
	}

	return null;
}

function parseTodosFromToolPart(part: any): AgentTodoItem[] | null {
	if (!part || part.type !== "tool") return null;

	const toolNameRaw =
		typeof part.tool === "string"
			? part.tool
			: typeof part.tool?.name === "string"
				? part.tool.name
				: "";

	if (!toolNameRaw.toLowerCase().startsWith("todo")) {
		return null;
	}

	const metadataTodos = coerceTodos(part.state?.metadata?.todos);
	if (metadataTodos) return metadataTodos;

	const outputTodos = coerceTodos(part.state?.output);
	if (outputTodos) return outputTodos;

	const inputTodos = coerceTodos(part.state?.input);
	if (inputTodos) return inputTodos;

	return null;
}

function extractTodosFromMessages(messages: any[]): AgentTodoItem[] | null {
	let latest: AgentTodoItem[] | null = null;

	for (const message of messages) {
		const parts = Array.isArray(message.parts)
			? message.parts
			: Array.isArray(message.message?.parts)
				? message.message.parts
				: [];

		for (const part of parts) {
			const parsed = parseTodosFromToolPart(part);
			if (parsed && parsed.length > 0) {
				latest = parsed;
			}
		}
	}

	return latest;
}

function parseMessageContent(rawMessage: any): {
	text: string;
	tools: string[];
} {
	if (!rawMessage) {
		return { text: "", tools: [] };
	}

	const parts = Array.isArray(rawMessage.parts)
		? rawMessage.parts
		: Array.isArray(rawMessage.message?.parts)
			? rawMessage.message.parts
			: [];

	const segments: string[] = [];
	const toolNames: string[] = [];

	for (const part of parts) {
		if (!part || typeof part !== "object") continue;

		if (part.type === "text" && typeof part.text === "string") {
			const trimmed = part.text.trim();
			if (trimmed) {
				segments.push(trimmed);
			}
			continue;
		}

		if (part.type === "tool") {
			const toolName =
				typeof part.tool === "string"
					? part.tool
					: typeof part.tool?.name === "string"
						? part.tool.name
						: "tool";
			toolNames.push(toolName);
		}
	}

	if (segments.length === 0) {
		const summary = rawMessage.info?.summary;
		if (summary) {
			const summarySegments: string[] = [];
			if (summary.title) summarySegments.push(summary.title);
			if (summary.body) summarySegments.push(summary.body);
			if (summarySegments.length > 0) {
				segments.push(summarySegments.join("\n"));
			}

			if (Array.isArray(summary.diffs) && summary.diffs.length > 0) {
				const diffLines = summary.diffs.slice(0, 3).map((diff: any) => {
					const file = diff.file || diff.path;
					if (!file) return null;
					return `- ${file}`;
				});
				const cleaned = diffLines.filter(Boolean);
				if (cleaned.length > 0) {
					segments.push(cleaned.join("\n"));
				}
			}
		}
	}

	if (
		segments.length === 0 &&
		typeof rawMessage.info?.finish === "string" &&
		toolNames.length === 0
	) {
		segments.push(`(${rawMessage.info.finish.replace(/-/g, " ")})`);
	}

	const uniqueToolNames = Array.from(new Set(toolNames));
	const visibleTools = uniqueToolNames.filter(
		(tool) => !tool.toLowerCase().startsWith("todo"),
	);

	return {
		text: segments.join("\n\n"),
		tools: visibleTools,
	};
}

export function ChatInterface({ projectId }: { projectId: string }) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [todos, setTodos] = useState<AgentTodoItem[] | null>(null);
	const [input, setInput] = useState(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(`chat-input-${projectId}`);
			return saved || "";
		}
		return "";
	});
	const [isLoadingHistory, setIsLoadingHistory] = useState(true);
	const [selectedModel, setSelectedModel] = useState(DEFAULT_AI_MODEL);
	const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
		null,
	);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [currentStatus, setCurrentStatus] = useState<string | null>(null);
	const [hasActiveStream, setHasActiveStream] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const hasLoadedRef = useRef(false);

	const isGenerating = hasActiveStream;

	const getProviderIcon = (provider: string, size: "sm" | "md" = "md") => {
		const iconClass =
			size === "sm"
				? "h-4 w-4 text-strong [&_*]:!fill-current [&_path]:!fill-current"
				: "h-5 w-5 text-strong [&_*]:!fill-current [&_path]:!fill-current";
		switch (provider) {
			case "OpenAI":
				return <Openai className={iconClass} />;
			case "Anthropic":
				return <AnthropicBlack className={iconClass} />;
			case "Google":
				return <Google className={iconClass} />;
			case "xAI":
				return <GrokDark className={iconClass} />;
			case "MoonshotAI":
				return <KimiIcon className={iconClass} />;
			default:
				return null;
		}
	};

	const handleModelChange = (modelId: string) => {
		setSelectedModel(modelId);
		setPopoverOpen(false);
	};

	async function loadHistory() {
		// Only show the global "Loading chat..." spinner on the first load.
		if (!hasLoadedRef.current) {
			setIsLoadingHistory(true);
		}

		try {
			const { data, error } = await actions.chat.getHistory({ projectId });
			if (!error && data) {
				const rawMessages = (data.messages || []) as any[];

				// Map raw OpenCode messages into a simple shape for the UI.
				const mapped: ChatMessage[] = rawMessages
					.map((m: any) => {
						const role =
							(m.info?.role as ChatMessage["role"]) ||
							(m.role as ChatMessage["role"]) ||
							"assistant";

						const { text, tools } = parseMessageContent(m);

						return {
							id: m.id || crypto.randomUUID(),
							role,
							content: text,
							tools,
							_raw: m,
						};
					})
					.filter(
						(message) =>
							message.role !== "assistant" ||
							message.content.trim().length > 0 ||
							(message.tools && message.tools.length > 0),
					);

				const latestTodos = extractTodosFromMessages(rawMessages);
				setTodos(latestTodos && latestTodos.length > 0 ? latestTodos : null);

				if (mapped.length > 0) {
					setMessages(mapped);
					if (data.model) setSelectedModel(data.model);
					return;
				}

				// No OpenCode messages yet: fall back to the
				// project's stored initial prompt if available.
				if (data.initialPrompt) {
					const initialMessage: ChatMessage = {
						id: `initial-${projectId}`,
						role: "user",
						content: data.initialPrompt,
					};

					setTodos(null);
					setMessages([initialMessage]);
					if (data.model) setSelectedModel(data.model);

					logger.info("Auto-sending initial project prompt to OpenCode");
					setHasActiveStream(true);
					setCurrentStatus("Processing initial request...");
					setInitialGenerationInProgress(projectId, true);

					try {
						const { error: sendError } = await actions.sessions.sendMessage({
							projectId,
							message: data.initialPrompt,
							model: data.model || selectedModel,
						});

						if (sendError) {
							console.error("Failed to send initial message:", sendError);
							setHasActiveStream(false);
							setCurrentStatus(null);
							setInitialGenerationInProgress(projectId, false);
						} else {
							await loadHistory();
							setHasActiveStream(false);
							setCurrentStatus(null);
							setInitialGenerationInProgress(projectId, false);
						}
					} catch (err) {
						console.error("Failed to send initial message:", err);
						setHasActiveStream(false);
						setCurrentStatus(null);
						setInitialGenerationInProgress(projectId, false);
					}
				} else {
					setTodos(null);
					setMessages([]);
				}
			}
		} catch (error) {
			console.error("Failed to load chat history:", error);
		} finally {
			if (!hasLoadedRef.current) {
				hasLoadedRef.current = true;
				setIsLoadingHistory(false);
			}
		}
	}

	useEffect(() => {
		loadHistory();

		if (typeof window === "undefined") return;

		const es = new EventSource(`/api/sessions/${projectId}/events`);

		es.onmessage = (event) => {
			try {
				const payload = JSON.parse(event.data);

				switch (payload.type) {
					case "server.connected":
						logger.info(
							`Connected to SSE (session: ${payload.sessionId || "unknown"})`,
						);
						break;

					case "message.part.updated":
						setHasActiveStream(true);
						setCurrentStatus("Generating response...");
						break;

					case "message.updated":
					case "messages.synced":
						// Finalize current assistant message and refresh history
						loadHistory();
						setHasActiveStream(false);
						setCurrentStatus(null);
						setInitialGenerationInProgress(projectId, false);
						refreshCodePreview();
						break;

					case "session.idle":
						setHasActiveStream(false);
						setCurrentStatus(null);
						setInitialGenerationInProgress(projectId, false);
						refreshCodePreview();
						break;

					case "todo.updated": {
						const todoItems = Array.isArray(payload.properties?.todos)
							? (payload.properties.todos as AgentTodoItem[])
							: [];
						setTodos(todoItems.length > 0 ? todoItems : null);
						break;
					}

					case "error":
						logger.error("Session error:", payload.message);
						setHasActiveStream(false);
						setCurrentStatus(null);
						break;

					default:
						logger.debug("Session event:", payload);
				}
			} catch (err) {
				console.error("Failed to parse session SSE event:", err);
			}
		};

		es.onerror = (err) => {
			console.error("Session SSE error:", err);
		};

		return () => {
			es.close();
		};
	}, [projectId]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(`chat-input-${projectId}`, input);
		}
	}, [input, projectId]);

	const handleDeleteMessage = async (
		messageId: string,
		deleteFrom: boolean = false,
	) => {
		if (isGenerating) return;

		setDeletingMessageId(messageId);

		try {
			const { error } = await actions.chat.deleteMessage({
				projectId,
				messageId,
			});

			if (!error) {
				setMessages((prev) => {
					const messageIndex = prev.findIndex((m) => m.id === messageId);
					if (messageIndex === -1) return prev;

					return deleteFrom
						? prev.slice(0, messageIndex)
						: prev.filter((m) => m.id !== messageId);
				});
			} else {
				console.error("Failed to delete message:", error);
			}
		} catch (error) {
			console.error("Failed to delete message:", error);
		} finally {
			setDeletingMessageId(null);
		}
	};

	const handleStop = async () => {
		try {
			await actions.sessions.abort({ projectId });
			setHasActiveStream(false);
			setCurrentStatus(null);
		} catch (error) {
			console.error("Failed to abort session:", error);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isGenerating) return;

		const userMessage: ChatMessage = {
			id: `temp-user-${Date.now()}`,
			role: "user",
			content: input,
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		if (typeof window !== "undefined") {
			localStorage.removeItem(`chat-input-${projectId}`);
		}

		setHasActiveStream(true);
		setCurrentStatus("Sending message...");

		try {
			const { error } = await actions.sessions.sendMessage({
				projectId,
				message: input,
				model: selectedModel,
			});

			if (error) {
				console.error("Failed to send message:", error);
				setHasActiveStream(false);
				setCurrentStatus(null);
			} else {
				await loadHistory();
				setHasActiveStream(false);
				setCurrentStatus(null);
				setInitialGenerationInProgress(projectId, false);
			}
		} catch (error) {
			console.error("Failed to send message:", error);
			setHasActiveStream(false);
			setCurrentStatus(null);
		}
	};

	function MessageContent({
		content,
		isStreaming = false,
	}: {
		content: string;
		isStreaming?: boolean;
	}) {
		const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(
			new Set(),
		);

		const parts: Array<{
			type: "text" | "code";
			content: string;
			language?: string;
			file?: string;
			index?: number;
		}> = [];

		const codeBlockRegex =
			/```(\w+)?(?:\s+file=["']([^"']+)["'])?\s*\n([\s\S]*?)```/g;

		let lastIndex = 0;
		let match: RegExpExecArray | null;
		let blockIndex = 0;

		while ((match = codeBlockRegex.exec(content)) !== null) {
			if (match.index > lastIndex) {
				parts.push({
					type: "text",
					content: content.slice(lastIndex, match.index),
				});
			}

			parts.push({
				type: "code",
				language: match[1] || "plaintext",
				file: match[2],
				content: match[3].trim(),
				index: blockIndex++,
			});

			lastIndex = match.index + match[0].length;
		}

		if (lastIndex < content.length) {
			const remaining = content.slice(lastIndex);
			const incompleteCodeMatch = remaining.match(
				/```(\w+)?(?:\s+file=["']([^"']+)["'])?\s*\n([\s\S]*)/,
			);

			if (
				incompleteCodeMatch &&
				isStreaming &&
				incompleteCodeMatch.index !== undefined
			) {
				const textBefore = remaining.slice(0, incompleteCodeMatch.index);
				if (textBefore.trim()) {
					parts.push({ type: "text", content: textBefore });
				}

				parts.push({
					type: "code",
					language: incompleteCodeMatch[1] || "plaintext",
					file: incompleteCodeMatch[2],
					content: "streaming",
					index: blockIndex++,
				});
			} else {
				parts.push({ type: "text", content: remaining });
			}
		}

		const toggleBlock = (index: number) => {
			setExpandedBlocks((prev) => {
				const next = new Set(prev);
				if (next.has(index)) {
					next.delete(index);
				} else {
					next.add(index);
				}
				return next;
			});
		};

		return (
			<div className="space-y-2 prose prose-sm prose-invert max-w-none overflow-hidden">
				{parts.map((part, i) => {
					if (part.type === "text") {
						return (
							<ReactMarkdown
								key={i}
								remarkPlugins={[remarkGfm]}
								components={{
									code: ({ node, className, ...props }: any) => {
										const isInline = !className?.includes("language-");
										return isInline ? (
											<code
												className="bg-surface px-1 py-0.5 rounded text-xs font-mono break-all"
												{...props}
											/>
										) : (
											<code className={className} {...props} />
										);
									},
									pre: ({ children }: any) => (
										<pre className="bg-surface/30 p-4 rounded-md overflow-x-auto text-xs max-w-full">
											{children}
										</pre>
									),
									p: ({ children }: any) => (
										<p className="break-words">{children}</p>
									),
								}}
							>
								{part.content}
							</ReactMarkdown>
						);
					}

					if (part.content === "streaming") {
						return (
							<div
								key={i}
								className="border border-border-border rounded-md overflow-hidden bg-bg/50 not-prose max-w-full"
							>
								<div className="w-full flex items-center justify-between p-3 min-w-0">
									<div className="flex items-center gap-2 text-sm min-w-0 flex-1">
										<Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
										<span className="font-mono font-medium truncate">
											{part.file || `${part.language} code`}
										</span>
									</div>
								</div>
							</div>
						);
					}

					return (
						<Collapsible
							key={i}
							open={expandedBlocks.has(part.index!)}
							onOpenChange={() => toggleBlock(part.index!)}
						>
							<div className="border border-border-border rounded-md overflow-hidden bg-bg/50 not-prose max-w-full">
								<CollapsibleTrigger asChild>
									<button className="w-full flex items-center justify-between p-3 hover:bg-surface/50 transition-colors min-w-0">
										<div className="flex items-center gap-2 text-sm min-w-0 flex-1">
											<FileCode className="h-4 w-4 flex-shrink-0" />
											<span className="font-mono font-medium truncate">
												{part.file || `${part.language} code`}
											</span>
											<span className="text-xs text-muted flex-shrink-0">
												{part.content.split("\n").length} lines
											</span>
										</div>
										{expandedBlocks.has(part.index!) ? (
											<ChevronDown className="h-4 w-4 flex-shrink-0" />
										) : (
											<ChevronRight className="h-4 w-4 flex-shrink-0" />
										)}
									</button>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<pre className="p-4 overflow-x-auto text-xs bg-surface/30 max-w-full">
										<code>{part.content}</code>
									</pre>
								</CollapsibleContent>
							</div>
						</Collapsible>
					);
				})}
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col border-r border-border-border min-w-0">
			<div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
				{messages.length === 0 && !isLoadingHistory && (
					<div className="h-full flex items-center justify-center text-center">
						<div className="max-w-md space-y-4">
							<h2 className="text-2xl font-bold">Start Building</h2>
							<p className="text-muted">
								Describe the website you want to build, and I'll generate the
								code for you.
							</p>
						</div>
					</div>
				)}
				{isLoadingHistory && (
					<div className="h-full flex items-center justify-center">
						<div className="flex items-center gap-2">
							<Loader2 className="h-5 w-5 animate-spin" />
							<span className="text-sm text-muted">Loading chat...</span>
						</div>
					</div>
				)}
				{todos && todos.length > 0 && (
					<div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
						<div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
							<span>Agent To-Dos</span>
							<span>{todos.length}</span>
						</div>
						<div className="space-y-2">
							{todos.map((todo) => {
								const statusClass =
									TODO_STATUS_STYLES[todo.status] ??
									"text-muted border-border/70";
								const priorityClass =
									TODO_PRIORITY_STYLES[todo.priority] ??
									"text-muted border-border/70";
								return (
									<div
										key={todo.id}
										className="flex flex-col gap-2 rounded-xl border border-border/70 bg-raised px-3 py-2"
									>
										<p className="text-sm text-strong">{todo.content}</p>
										<div className="flex flex-wrap items-center gap-2">
											<span
												className={`text-[11px] uppercase tracking-wide border rounded-full px-2 py-0.5 ${statusClass}`}
											>
												{formatTodoLabel(todo.status)}
											</span>
											<span
												className={`text-[11px] uppercase tracking-wide border rounded-full px-2 py-0.5 ${priorityClass}`}
											>
												Priority: {formatTodoLabel(todo.priority)}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
				{messages.map((message) => {
					const isDeleting = deletingMessageId === message.id;
					const toolNames = message.tools ?? [];
					const textContent = (message.content || "").trim();
					const hasTextContent = textContent.length > 0;

					return (
						<ContextMenu key={message.id}>
							<ContextMenuTrigger asChild>
								<div
									className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`max-w-[80%] rounded-lg px-4 py-3 overflow-hidden cursor-context-menu ${
											message.role === "user"
												? "bg-strong text-surface"
												: "bg-surface text-strong"
										} ${isDeleting ? "opacity-50" : ""}`}
									>
										{message.role === "assistant" ? (
											hasTextContent ? (
												<MessageContent content={message.content} />
											) : null
										) : (
											<div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap break-words">
												{message.content}
											</div>
										)}
										{toolNames.length > 0 && (
											<div
												className={`flex flex-wrap gap-2 ${
													hasTextContent ? "mt-3" : ""
												}`}
											>
												{toolNames.map((tool, index) => (
													<span
														key={`${message.id}-tool-${index}-${tool}`}
														className="text-[11px] uppercase tracking-wide border border-border/70 rounded-full px-2 py-0.5 text-muted bg-raised"
													>
														{tool}
													</span>
												))}
											</div>
										)}
									</div>
								</div>
							</ContextMenuTrigger>

							<ContextMenuContent className="w-72">
								<ContextMenuItem
									onClick={() => handleDeleteMessage(message.id, false)}
									disabled={isGenerating || isDeleting}
									className="text-danger text-danger focus:text-danger focus:text-danger"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete this message only
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					);
				})}
				{isGenerating && (
					<div className="flex justify-start">
						<div className="bg-surface rounded-lg px-4 py-2 flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-sm text-muted">
								{currentStatus || "Generating..."}
							</span>
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>
			<form
				onSubmit={handleSubmit}
				className="border-t border-border-border p-4 space-y-3"
			>
				<div className="flex items-center gap-2">
					<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm" className="gap-2">
								{AVAILABLE_AI_MODELS.find((m) => m.id === selectedModel) ? (
									<>
										{getProviderIcon(
											AVAILABLE_AI_MODELS.find((m) => m.id === selectedModel)!
												.provider,
											"sm",
										)}
										<span className="text-sm">
											{
												AVAILABLE_AI_MODELS.find((m) => m.id === selectedModel)!
													.name
											}
										</span>
									</>
								) : (
									<>
										<Settings2 className="h-4 w-4" />
										<span className="text-sm">Select Model</span>
									</>
								)}
								<ChevronDown className="h-3 w-3 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[32rem] p-3" align="start">
							<div className="space-y-3">
								<div>
									<Label className="text-xs font-semibold uppercase tracking-wider text-muted">
										AI Model
									</Label>
									{AVAILABLE_AI_MODELS.find((m) => m.id === selectedModel) && (
										<p className="mt-1 text-xs text-muted">
											Currently using:{" "}
											{
												AVAILABLE_AI_MODELS.find((m) => m.id === selectedModel)!
													.name
											}
										</p>
									)}
								</div>
								<Separator />
								<div className="space-y-1">
									{AVAILABLE_AI_MODELS.map((model) => (
										<button
											key={model.id}
											onClick={() => handleModelChange(model.id)}
											className="flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-raised/90"
											type="button"
										>
											<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
												{getProviderIcon(model.provider)}
											</div>
											<div className="flex-1 space-y-0.5">
												<div className="flex items-center gap-2">
													{selectedModel === model.id && (
														<Check className="h-3.5 w-3.5 text-strong" />
													)}
													<span className="text-sm font-medium">
														{model.name}
													</span>
													<span className="text-xs text-muted">
														{model.provider}
													</span>
												</div>
												<p className="text-xs text-muted">
													{model.description}
												</p>
											</div>
										</button>
									))}
								</div>
							</div>
						</PopoverContent>
					</Popover>
				</div>
				<div className="flex gap-2">
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Enter your prompt here..."
						className="flex-1 min-h-[60px] max-h-[200px] resize-none"
						disabled={isGenerating}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								if (!isGenerating) {
									handleSubmit(e);
								}
							}
						}}
					/>
					{isGenerating ? (
						<Button
							type="button"
							onClick={handleStop}
							size="icon"
							variant="destructive"
						>
							<Square className="h-4 w-4" />
						</Button>
					) : (
						<Button type="submit" disabled={!input.trim()} size="icon">
							<Send className="h-4 w-4" />
						</Button>
					)}
				</div>
			</form>
		</div>
	);
}
