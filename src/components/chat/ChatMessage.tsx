import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import { type Message, type TextPart, type ImagePart } from "@/types/message";
import "highlight.js/styles/atom-one-dark.css";

interface ChatMessageProps {
	message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
	const isUser = message.role === "user";

	return (
		<div
			className={cn("flex gap-3 p-4", isUser ? "bg-muted/50" : "bg-background")}
		>
			<div
				className={cn(
					"flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
					isUser ? "bg-primary text-primary-foreground" : "bg-muted",
				)}
			>
				{isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
			</div>
			<div className="flex-1 space-y-2 overflow-hidden">
				<div className="font-medium text-sm">
					{isUser ? "You" : "Assistant"}
				</div>
				<div className="space-y-2">
					{message.parts.map((part, idx) => {
						// Check if this is the last part and it's streaming
						const isLastPart = idx === message.parts.length - 1;
						const isStreaming = message.isStreaming && isLastPart;
						const streamingCursor = isStreaming ? (
							<span className="inline-block w-2 h-4 ml-0.5 bg-foreground animate-pulse" />
						) : null;

						if (part.type === "text") {
							const textPart = part as TextPart;
							return (
								<div key={part.id || idx}>
									{isUser ? (
										<pre className="whitespace-pre-wrap font-sans text-sm overflow-auto">
											{textPart.text}
											{streamingCursor}
										</pre>
									) : (
										<div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-h1:my-3 prose-h2:my-2 prose-h3:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-pre:p-3 prose-pre:rounded prose-blockquote:border-l-2 prose-blockquote:border-muted prose-blockquote:pl-4 prose-blockquote:italic">
											<ReactMarkdown
												remarkPlugins={[remarkGfm]}
												rehypePlugins={[rehypeRaw, rehypeHighlight]}
											>
												{textPart.text}
											</ReactMarkdown>
											{streamingCursor}
										</div>
									)}
								</div>
							);
						}

						// Handle other part types (reasoning, error, file, tool)
						// For now, just render their content
						if (part.type === "reasoning") {
							return (
								<details key={part.id || idx} className="cursor-pointer">
									<summary className="font-medium text-sm text-muted-foreground hover:text-foreground">
										💭 Thinking...
									</summary>
									<pre className="whitespace-pre-wrap font-mono text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-48">
										{(part as any).text}
									</pre>
								</details>
							);
						}

						if (part.type === "error") {
							return (
								<div
									key={part.id || idx}
									className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive"
								>
									<strong>Error:</strong> {(part as any).message}
									{(part as any).stack && (
										<details className="mt-2">
											<summary className="cursor-pointer text-xs">
												Stack trace
											</summary>
											<pre className="text-xs overflow-auto max-h-32 mt-1">
												{(part as any).stack}
											</pre>
										</details>
									)}
								</div>
							);
						}

						if (part.type === "file") {
							return (
								<div
									key={part.id || idx}
									className="p-2 bg-muted rounded text-sm inline-block"
								>
									📄 {(part as any).path}
									{(part as any).size && (
										<span className="text-xs text-muted-foreground ml-2">
											({((part as any).size / 1024).toFixed(1)} KB)
										</span>
									)}
								</div>
							);
						}

						if (part.type === "image") {
							const imagePart = part as ImagePart;
							return (
								<div key={part.id || idx} className="my-2">
									<img
										src={imagePart.dataUrl}
										alt={imagePart.filename || "Image attachment"}
										className="max-w-sm max-h-96 rounded-lg border border-input object-contain"
									/>
									{imagePart.filename && (
										<p className="text-xs text-muted-foreground mt-1">
											{imagePart.filename}
										</p>
									)}
								</div>
							);
						}

						return null;
					})}
				</div>
			</div>
		</div>
	);
}

export type { Message } from "@/types/message";
