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
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
}

// Popular models for code generation
const AVAILABLE_MODELS = [
	{ id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI" },
	{ id: "openai/gpt-5", name: "GPT 5", provider: "OpenAI" },
	{
		id: "anthropic/claude-3.5-sonnet",
		name: "Claude 3.5 Sonnet",
		provider: "Anthropic",
	},
	{
		id: "anthropic/claude-3-opus",
		name: "Claude 3 Opus",
		provider: "Anthropic",
	},
	{ id: "google/gemini-pro-1.5", name: "Gemini 1.5 Pro", provider: "Google" },
	{
		id: "meta-llama/llama-3.1-70b-instruct",
		name: "Llama 3.1 70B",
		provider: "Meta",
	},
	{
		id: "qwen/qwen-2.5-coder-32b-instruct",
		name: "Qwen 2.5 Coder 32B",
		provider: "Alibaba",
	},
	{
		id: "deepseek/deepseek-coder",
		name: "DeepSeek Coder",
		provider: "DeepSeek",
	},
];

export function ChatInterface({ projectId }: { projectId: string }) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(true);
	const [selectedModel, setSelectedModel] = useState("openai/gpt-4.1-mini");
	const messagesEndRef = useRef<HTMLDivElement>(null);

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
						try {
							const jsonStr = line.slice(6); // Remove 'data: ' prefix
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
						} catch (e) {
							console.error("Failed to parse stream data:", e, line);
						}
					}
				}
			}
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
			parts.push({ type: "text", content: content.slice(lastIndex) });
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
			<div className="space-y-2 prose prose-sm dark:prose-invert max-w-none">
				{parts.map((part, i) =>
					part.type === "text" ? (
						<ReactMarkdown
							key={i}
							remarkPlugins={[remarkGfm]}
							components={{
								// Render inline code differently from code blocks
								code: ({ node, className, ...props }: any) => {
									const isInline = !className?.includes("language-");
									return isInline ? (
										<code
											className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
											{...props}
										/>
									) : (
										<code className={className} {...props} />
									);
								},
								// Handle any remaining code blocks in markdown (shouldn't happen with our regex)
								pre: ({ children }: any) => (
									<pre className="bg-muted/30 p-4 rounded-md overflow-x-auto text-xs">
										{children}
									</pre>
								),
							}}
						>
							{part.content}
						</ReactMarkdown>
					) : (
						<Collapsible
							key={i}
							open={expandedBlocks.has(part.index!)}
							onOpenChange={() => toggleBlock(part.index!)}
						>
							<div className="border border-border rounded-md overflow-hidden bg-background/50 not-prose">
								<CollapsibleTrigger asChild>
									<button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
										<div className="flex items-center gap-2 text-sm">
											<FileCode className="h-4 w-4" />
											<span className="font-mono font-medium">
												{part.file || `${part.language} code`}
											</span>
											<span className="text-xs text-muted-foreground">
												{part.content.split("\n").length} lines
											</span>
										</div>
										{expandedBlocks.has(part.index!) ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</button>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<pre className="p-4 overflow-x-auto text-xs bg-muted/30">
										<code>{part.content}</code>
									</pre>
								</CollapsibleContent>
							</div>
						</Collapsible>
					),
				)}
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col border-r border-border">
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
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
								className={`max-w-[80%] rounded-lg px-4 py-2 ${
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
									<p className="whitespace-pre-wrap">{message.content}</p>
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
						placeholder="Describe your website..."
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
