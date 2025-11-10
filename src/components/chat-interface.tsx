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
import { refreshCodePreview } from "@/components/code-preview";
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
	ContextMenuSeparator,
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
} from "@/shared/config/ai-models";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
}

export function ChatInterface({ projectId }: { projectId: string }) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState(() => {
		// Load saved input from localStorage on mount
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(`chat-input-${projectId}`);
			return saved || "";
		}
		return "";
	});
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(true);
	const [selectedModel, setSelectedModel] = useState(DEFAULT_AI_MODEL);
	const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
		null,
	);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

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

	// Load chat history on mount
	useEffect(() => {
		async function loadHistory() {
			try {
				console.log(`[ChatInterface] Loading history for project ${projectId}`);
				const { actions } = await import("astro:actions");
				const { data, error } = await actions.chat.getHistory({ projectId });
				if (!error && data) {
					console.log(
						`[ChatInterface] Loaded ${data.messages?.length || 0} messages, model: ${data.model}`,
					);
					setMessages(data.messages || []);
					if (data.model) {
						setSelectedModel(data.model);
					}
				}
			} catch (error) {
				console.error("Failed to load chat history:", error);
			} finally {
				setIsLoadingHistory(false);
			}
		}
		loadHistory();
	}, [projectId]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Save input to localStorage whenever it changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(`chat-input-${projectId}`, input);
		}
	}, [input, projectId]);

	const handleDeleteMessage = async (
		messageId: string,
		deleteFrom: boolean = false,
	) => {
		if (isLoading) return; // Don't allow deletion while generating

		setDeletingMessageId(messageId);

		try {
			const { actions } = await import("astro:actions");
			const { error } = await actions.chat.deleteMessage({
				projectId,
				messageId,
			});

			if (!error) {
				// Remove messages from UI
				setMessages((prev) => {
					const messageIndex = prev.findIndex((m) => m.id === messageId);
					if (messageIndex === -1) return prev;

					return deleteFrom
						? prev.slice(0, messageIndex) // Delete from this message onwards
						: prev.filter((m) => m.id !== messageId); // Delete only this message
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

	const reloadMessages = async () => {
		try {
			const { actions } = await import("astro:actions");
			const { data, error } = await actions.chat.getHistory({ projectId });
			if (!error && data) {
				setMessages(data.messages || []);
			}
		} catch (error) {
			console.error("Failed to reload messages:", error);
		}
	};

	const handleStop = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
			setIsLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		const userMessage: Message = {
			id: `temp-user-${Date.now()}`,
			role: "user",
			content: input,
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		// Clear localStorage when message is sent
		if (typeof window !== "undefined") {
			localStorage.removeItem(`chat-input-${projectId}`);
		}
		setIsLoading(true);

		// Create new AbortController for this request
		const abortController = new AbortController();
		abortControllerRef.current = abortController;

		try {
			const response = await fetch(`/api/chat/${projectId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [...messages, userMessage].map((m) => ({
						role: m.role,
						content: m.content,
					})),
					model: selectedModel,
				}),
				signal: abortController.signal,
			});

			if (!response.ok) throw new Error("Failed to get response");

			const reader = response.body?.getReader();
			if (!reader) throw new Error("No response body");

			const decoder = new TextDecoder();
			let buffer = "";
			let assistantMessage = "";
			let lastEventWasToolResult = false;

			// Add empty assistant message immediately
			setMessages((prev) => [
				...prev,
				{
					id: Math.random().toString(),
					role: "assistant",
					content: "",
				},
			]);

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");

				// Keep the last incomplete line in the buffer
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (!line.trim() || line.startsWith(":")) continue;

					// Parse data: prefix from SSE format
					if (line.startsWith("data: ")) {
						const jsonStr = line.slice(6); // Remove 'data: ' prefix

						// Skip [DONE] marker
						if (jsonStr.trim() === "[DONE]") {
							continue;
						}

						try {
							const data = JSON.parse(jsonStr);

							// Handle different message types from AI SDK
							if (data.type === "text-delta" && data.delta) {
								// Add spacing if this is the first text after a tool result
								if (lastEventWasToolResult) {
									// Add two line breaks to separate from tool results
									assistantMessage += "\n\n";
									lastEventWasToolResult = false;
								}

								assistantMessage += data.delta;

								// Update the last message (assistant) with new content
								setMessages((prev) => {
									const updated = [...prev];
									if (updated[updated.length - 1]?.role === "assistant") {
										updated[updated.length - 1].content = assistantMessage;
									}
									return updated;
								});
							}
							// Handle step transitions to add spacing between thinking steps
							else if (data.type === "finish-step") {
								// Mark that a step just finished so we can add spacing before next text
								lastEventWasToolResult = true;
							}
							// Handle tool call events
							else if (data.type === "tool-call" && data.toolName) {
								const toolMessage = `\n\n🔧 **Using tool: ${data.toolName}**\n\`\`\`json\n${JSON.stringify(data.args, null, 2)}\n\`\`\`\n`;
								assistantMessage += toolMessage;

								setMessages((prev) => {
									const updated = [...prev];
									if (updated[updated.length - 1]?.role === "assistant") {
										updated[updated.length - 1].content = assistantMessage;
									}
									return updated;
								});
							}
							// Handle tool result events
							else if (data.type === "tool-result" && data.toolName) {
								const resultMessage = `\n📋 **Result from ${data.toolName}:**\n\`\`\`json\n${JSON.stringify(data.result, null, 2)}\n\`\`\`\n`;
								assistantMessage += resultMessage;
								lastEventWasToolResult = true; // Mark that we just processed a tool result

								setMessages((prev) => {
									const updated = [...prev];
									if (updated[updated.length - 1]?.role === "assistant") {
										updated[updated.length - 1].content = assistantMessage;
									}
									return updated;
								});
							}
							// Handle step finish to ensure spacing between steps
							else if (data.type === "finish-step") {
								// Mark that a step just finished
								lastEventWasToolResult = true;
							}
						} catch (e) {
							console.error("Failed to parse stream data:", e, line);
						}
					}
				}
			}

			// After streaming completes, refresh the code preview and reload messages with real IDs
			refreshCodePreview();

			// Reload messages from server to get proper database IDs
			await reloadMessages();
		} catch (error: any) {
			console.error("Chat error:", error);

			// Check if the error was due to abort
			if (error.name === "AbortError") {
				console.log("Request was aborted by user");
				// Remove the empty assistant message that was added
				setMessages((prev) => prev.slice(0, -1));
			} else {
				setMessages((prev) => [
					...prev.slice(0, -1), // Remove the empty assistant message
					{
						id: `temp-error-${Date.now()}`,
						role: "assistant",
						content: "Error: Failed to generate response. Please try again.",
					},
				]);
			}
		} finally {
			abortControllerRef.current = null;
			setIsLoading(false);
		}
	};

	// Component to render message content with collapsible code blocks
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

		// Extract complete code blocks and text/streaming content
		const parts: Array<{
			type: "text" | "code";
			content: string;
			language?: string;
			file?: string;
			index?: number;
		}> = [];

		// Only match COMPLETE code blocks (with closing ```)
		const codeBlockRegex =
			/```(\w+)?(?:\s+file=["']([^"']+)["'])?\s*\n([\s\S]*?)```/g;

		let lastIndex = 0;
		let match;
		let blockIndex = 0;

		while ((match = codeBlockRegex.exec(content)) !== null) {
			// Add text before code block
			if (match.index > lastIndex) {
				parts.push({
					type: "text",
					content: content.slice(lastIndex, match.index),
				});
			}

			// Add complete code block
			parts.push({
				type: "code",
				language: match[1] || "plaintext",
				file: match[2],
				content: match[3].trim(),
				index: blockIndex++,
			});

			lastIndex = match.index + match[0].length;
		}

		// Add remaining text (including incomplete code blocks during streaming)
		if (lastIndex < content.length) {
			const remaining = content.slice(lastIndex);

			// Check if there's an incomplete code block being streamed
			const incompleteCodeMatch = remaining.match(
				/```(\w+)?(?:\s+file=["']([^"']+)["'])?\s*\n([\s\S]*)/,
			);

			if (
				incompleteCodeMatch &&
				isStreaming &&
				incompleteCodeMatch.index !== undefined
			) {
				// Add text before the incomplete code block
				const textBefore = remaining.slice(0, incompleteCodeMatch.index);
				if (textBefore.trim()) {
					parts.push({ type: "text", content: textBefore });
				}

				// Add the incomplete code block as a loading state
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
									// Render inline code differently from code blocks
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
									// Handle any remaining code blocks in markdown (shouldn't happen with our regex)
									pre: ({ children }: any) => (
										<pre className="bg-surface/30 p-4 rounded-md overflow-x-auto text-xs max-w-full">
											{children}
										</pre>
									),
									// Break long words in paragraphs
									p: ({ children }: any) => (
										<p className="break-words">{children}</p>
									),
								}}
							>
								{part.content}
							</ReactMarkdown>
						);
					}

					// Show loading state for incomplete code blocks
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
										<span className="text-xs text-muted flex-shrink-0">
											{part.content.split("\n").length} lines
										</span>
									</div>
								</div>
							</div>
						);
					}

					// Show complete code block with collapsible content
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
				{messages.length === 0 && (
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
				{messages.map((message, idx) => {
					const isLastMessage = idx === messages.length - 1;
					const isStreamingMessage =
						isLastMessage && isLoading && message.role === "assistant";
					const isDeleting = deletingMessageId === message.id;

					return (
						<ContextMenu key={message.id}>
							<ContextMenuTrigger asChild>
								<div
									className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`max-w-[80%] rounded-lg px-4 py-2 overflow-hidden cursor-context-menu ${
											message.role === "user"
												? "bg-strong text-surface"
												: "bg-surface text-strong"
										} ${isDeleting ? "opacity-50" : ""}`}
									>
										{message.role === "assistant" ? (
											<MessageContent
												content={message.content}
												isStreaming={isStreamingMessage}
											/>
										) : (
											<div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap break-words">
												{message.content}
											</div>
										)}
									</div>
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent className="w-72">
								<ContextMenuItem
									onClick={() => handleDeleteMessage(message.id, false)}
									disabled={isLoading || isDeleting}
									className="text-danger text-danger focus:text-danger focus:text-danger"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete this message only
								</ContextMenuItem>
								{idx > 0 && (
									<>
										<ContextMenuSeparator />
										<ContextMenuItem
											onClick={() => handleDeleteMessage(message.id, true)}
											disabled={isLoading || isDeleting}
											className="text-danger text-danger focus:text-danger focus:text-danger"
										>
											<Trash2 className="mr-2 h-4 w-4" />
											<ChevronDown className="mr-2 h-4 w-4" />
											Delete from here onwards
										</ContextMenuItem>
									</>
								)}
							</ContextMenuContent>
						</ContextMenu>
					);
				})}
				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-surface rounded-lg px-4 py-2 flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-sm text-muted">Generating...</span>
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
						disabled={isLoading}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								if (!isLoading) {
									handleSubmit(e);
								}
							}
						}}
					/>
					{isLoading ? (
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
