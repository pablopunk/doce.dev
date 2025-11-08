import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Send,
	Loader2,
	ChevronDown,
	ChevronRight,
	FileCode,
	AlertCircle,
	Wrench,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { refreshCodePreview } from "@/components/code-preview";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
}

// Popular models for code generation
const AVAILABLE_MODELS = [
	{ 
		id: "anthropic/claude-3.5-sonnet",
		name: "Claude 3.5 Sonnet",
		provider: "Anthropic",
		supportsTools: true,
	},
	{ 
		id: "openai/gpt-4-turbo",
		name: "GPT-4 Turbo",
		provider: "OpenAI",
		supportsTools: true,
	},
	{ id: "openai/gpt-5", name: "GPT 5", provider: "OpenAI", supportsTools: true },
	{
		id: "anthropic/claude-3-opus",
		name: "Claude 3 Opus",
		provider: "Anthropic",
		supportsTools: true,
	},
	{ id: "google/gemini-pro-1.5", name: "Gemini 1.5 Pro", provider: "Google", supportsTools: true },
	{ id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI", supportsTools: false },
	{
		id: "meta-llama/llama-3.1-70b-instruct",
		name: "Llama 3.1 70B",
		provider: "Meta",
		supportsTools: false,
	},
	{
		id: "qwen/qwen-2.5-coder-32b-instruct",
		name: "Qwen 2.5 Coder 32B",
		provider: "Alibaba",
		supportsTools: false,
	},
	{
		id: "deepseek/deepseek-coder",
		name: "DeepSeek Coder",
		provider: "DeepSeek",
		supportsTools: false,
	},
];

export function ChatInterface({ projectId }: { projectId: string }) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(true);
	const [selectedModel, setSelectedModel] = useState("anthropic/claude-3.5-sonnet");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Check if current model supports tools
	const currentModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);
	const supportsTools = currentModelInfo?.supportsTools ?? false;

	// Load chat history on mount
	useEffect(() => {
		async function loadHistory() {
			try {
				const res = await fetch(`/api/chat/${projectId}/history`);
				if (res.ok) {
					const data = await res.json();
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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		const userMessage: Message = {
			id: Math.random().toString(),
			role: "user",
			content: input,
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

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
			});

			if (!response.ok) throw new Error("Failed to get response");

			const reader = response.body?.getReader();
			if (!reader) throw new Error("No response body");

			const decoder = new TextDecoder();
			let buffer = "";
			let assistantMessage = "";

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
								const resultMessage = `\n📋 **Result from ${data.toolName}:**\n\`\`\`json\n${JSON.stringify(data.result, null, 2)}\n\`\`\`\n\n`;
								assistantMessage += resultMessage;
								
								setMessages((prev) => {
									const updated = [...prev];
									if (updated[updated.length - 1]?.role === "assistant") {
										updated[updated.length - 1].content = assistantMessage;
									}
									return updated;
								});
							}
						} catch (e) {
							console.error("Failed to parse stream data:", e, line);
						}
					}
				}
			}

			// After streaming completes, refresh the code preview to show new files
			refreshCodePreview();
		} catch (error) {
			console.error("Chat error:", error);
			setMessages((prev) => [
				...prev.slice(0, -1), // Remove the empty assistant message
				{
					id: Math.random().toString(),
					role: "assistant",
					content: "Error: Failed to generate response. Please try again.",
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	// Component to render message content with collapsible code blocks
	function MessageContent({
		content,
		isStreaming = false,
	}: { content: string; isStreaming?: boolean }) {
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
			<div className="space-y-2 prose prose-sm dark:prose-invert max-w-none overflow-hidden">
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
												className="bg-muted px-1 py-0.5 rounded text-xs font-mono break-all"
												{...props}
											/>
										) : (
											<code className={className} {...props} />
										);
									},
									// Handle any remaining code blocks in markdown (shouldn't happen with our regex)
									pre: ({ children }: any) => (
										<pre className="bg-muted/30 p-4 rounded-md overflow-x-auto text-xs max-w-full">
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
								className="border border-border rounded-md overflow-hidden bg-background/50 not-prose max-w-full"
							>
								<div className="w-full flex items-center justify-between p-3 min-w-0">
									<div className="flex items-center gap-2 text-sm min-w-0 flex-1">
										<Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
										<span className="font-mono font-medium truncate">
											{part.file || `${part.language} code`}
										</span>
										<span className="text-xs text-muted-foreground flex-shrink-0">
											Generating...
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
							<div className="border border-border rounded-md overflow-hidden bg-background/50 not-prose max-w-full">
								<CollapsibleTrigger asChild>
									<button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors min-w-0">
										<div className="flex items-center gap-2 text-sm min-w-0 flex-1">
											<FileCode className="h-4 w-4 flex-shrink-0" />
											<span className="font-mono font-medium truncate">
												{part.file || `${part.language} code`}
											</span>
											<span className="text-xs text-muted-foreground flex-shrink-0">
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
									<pre className="p-4 overflow-x-auto text-xs bg-muted/30 max-w-full">
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
		<div className="flex-1 flex flex-col border-r border-border min-w-0">
			<div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
				{messages.length === 0 && (
					<div className="h-full flex items-center justify-center text-center">
						<div className="max-w-md space-y-4">
							<h2 className="text-2xl font-bold">Start Building</h2>
							<p className="text-muted-foreground">
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

					return (
						<div
							key={message.id}
							className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[80%] rounded-lg px-4 py-2 overflow-hidden ${
									message.role === "user"
										? "bg-primary text-primary-foreground"
										: "bg-muted text-foreground"
								}`}
							>
								{message.role === "assistant" ? (
									<MessageContent
										content={message.content}
										isStreaming={isStreamingMessage}
									/>
								) : (
									<p className="whitespace-pre-wrap break-words">
										{message.content}
									</p>
								)}
							</div>
						</div>
					);
				})}
				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-sm text-muted-foreground">
								Generating...
							</span>
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>
			<form
				onSubmit={handleSubmit}
				className="border-t border-border p-4 space-y-3"
			>
				{!supportsTools && (
					<div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
						<AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
						<div className="text-sm text-yellow-600 dark:text-yellow-400">
							<strong>Limited capabilities:</strong> This model doesn't support advanced tools (file reading, terminal commands, web fetching). 
							For best results, use Claude 3.5 Sonnet or GPT-4 Turbo.
						</div>
					</div>
				)}
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Model:</span>
					<Select value={selectedModel} onValueChange={setSelectedModel}>
						<SelectTrigger className="w-[240px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{AVAILABLE_MODELS.map((model) => (
								<SelectItem key={model.id} value={model.id}>
									<div className="flex items-center gap-2">
										<span>{model.name}</span>
										<span className="text-xs text-muted-foreground">
											({model.provider})
										</span>
										{model.supportsTools && (
											<span title="Supports tools (file reading, terminal, web fetch)">
												<Wrench className="h-3 w-3 text-green-500" />
											</span>
										)}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex gap-2">
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Enter your prompt here..."
						className="flex-1 min-h-[60px] max-h-[200px] resize-none"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSubmit(e);
							}
						}}
					/>
					<Button
						type="submit"
						disabled={isLoading || !input.trim()}
						size="icon"
					>
						<Send className="h-4 w-4" />
					</Button>
				</div>
			</form>
		</div>
	);
}
