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
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	refreshCodePreview,
	startDevServerForProject,
} from "@/components/code-preview";
import AIBlob from "@/components/ui/ai-blob";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useProjectStateOptional } from "@/domain/projects/hooks/use-project-state";
import { createLogger } from "@/lib/logger";

const logger = createLogger("chat-interface");

interface ToolInfo {
	name: string;
	detail?: string;
	status?: "running" | "completed" | "error";
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	tools?: ToolInfo[];
	_raw?: unknown;
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

function parseTodosFromToolPart(part: unknown): AgentTodoItem[] | null {
	if (!part || typeof part !== "object") return null;
	const p = part as Record<string, unknown>;
	if (p.type !== "tool") return null;

	const toolNameRaw =
		typeof p.tool === "string"
			? p.tool
			: typeof (p.tool as Record<string, unknown>)?.name === "string"
				? (p.tool as Record<string, unknown>).name
				: "";

	if (!(toolNameRaw as string).toLowerCase().startsWith("todo")) {
		return null;
	}

	const state = p.state as Record<string, unknown> | undefined;
	const metadataTodos = coerceTodos(
		(state?.metadata as Record<string, unknown> | undefined)?.todos,
	);
	if (metadataTodos) return metadataTodos;

	const outputTodos = coerceTodos(state?.output);
	if (outputTodos) return outputTodos;

	const inputTodos = coerceTodos(state?.input);
	if (inputTodos) return inputTodos;

	return null;
}

function extractTodosFromMessages(messages: unknown[]): AgentTodoItem[] | null {
	let latest: AgentTodoItem[] | null = null;

	for (const message of messages) {
		const msg = message as Record<string, unknown>;
		const parts = Array.isArray(msg.parts)
			? msg.parts
			: Array.isArray((msg.message as Record<string, unknown>)?.parts)
				? (msg.message as Record<string, unknown>).parts
				: [];

		for (const part of parts as unknown[]) {
			const parsed = parseTodosFromToolPart(part);
			if (parsed && parsed.length > 0) {
				latest = parsed;
			}
		}
	}

	return latest;
}

function extractToolDetail(
	toolName: string,
	part: Record<string, unknown>,
): string | undefined {
	const state = part.state as Record<string, unknown> | undefined;
	const input = (state?.input ?? part.input ?? {}) as Record<string, unknown>;
	const normalizedName = toolName.toLowerCase();

	if (
		normalizedName === "read" ||
		normalizedName === "write" ||
		normalizedName === "edit"
	) {
		const filePath = (input.filePath || input.path || input.file) as
			| string
			| undefined;
		if (filePath) {
			const parts = filePath.split("/");
			return parts[parts.length - 1];
		}
	}

	if (normalizedName === "bash" || normalizedName === "shell") {
		const cmd = (input.command || input.cmd) as string | undefined;
		if (cmd) {
			return cmd.length > 30 ? `${cmd.slice(0, 27)}...` : cmd;
		}
	}

	if (normalizedName === "glob" || normalizedName === "grep") {
		const pattern = (input.pattern || input.glob) as string | undefined;
		if (pattern) {
			return pattern.length > 25 ? `${pattern.slice(0, 22)}...` : pattern;
		}
	}

	if (normalizedName === "list") {
		const path = (input.path || input.directory) as string | undefined;
		if (path) {
			const parts = path.split("/");
			return parts[parts.length - 1] || path;
		}
		return "cwd";
	}

	if (normalizedName === "task" || normalizedName === "agent") {
		const desc = (input.description || input.task) as string | undefined;
		if (desc) {
			return desc.length > 30 ? `${desc.slice(0, 27)}...` : desc;
		}
	}

	return undefined;
}

function extractToolStatus(
	part: Record<string, unknown>,
): "running" | "completed" | "error" | undefined {
	const state = part.state as Record<string, unknown> | undefined;
	if (!state) return undefined;

	if (
		state.error ||
		(state.output as Record<string, unknown> | undefined)?.error
	) {
		return "error";
	}

	if (
		state.output !== undefined &&
		state.output !== null &&
		state.output !== ""
	) {
		return "completed";
	}

	if (state.input !== undefined) {
		return "running";
	}

	return undefined;
}

function parseMessageContent(rawMessage: unknown): {
	text: string;
	tools: ToolInfo[];
} {
	if (!rawMessage) {
		return { text: "", tools: [] };
	}

	const msg = rawMessage as Record<string, unknown>;
	const parts = Array.isArray(msg.parts)
		? msg.parts
		: Array.isArray((msg.message as Record<string, unknown>)?.parts)
			? (msg.message as Record<string, unknown>).parts
			: [];

	const segments: string[] = [];
	const toolInfos: ToolInfo[] = [];
	const seenTools = new Set<string>();

	for (const part of parts as unknown[]) {
		if (!part || typeof part !== "object") continue;
		const p = part as Record<string, unknown>;

		if (p.type === "text" && typeof p.text === "string") {
			const trimmed = p.text.trim();
			if (trimmed) {
				segments.push(trimmed);
			}
			continue;
		}

		if (p.type === "tool") {
			const toolName =
				typeof p.tool === "string"
					? p.tool
					: typeof (p.tool as Record<string, unknown>)?.name === "string"
						? ((p.tool as Record<string, unknown>).name as string)
						: "tool";

			if (toolName.toLowerCase().startsWith("todo")) {
				continue;
			}

			const detail = extractToolDetail(toolName, p);
			const status = extractToolStatus(p);

			const key = `${toolName}:${detail || ""}`;
			if (!seenTools.has(key)) {
				seenTools.add(key);
				toolInfos.push({
					name: toolName,
					detail,
					status,
				});
			}
		}
	}

	if (segments.length === 0) {
		const info = msg.info as Record<string, unknown> | undefined;
		const summary = info?.summary as Record<string, unknown> | undefined;
		if (summary) {
			const summarySegments: string[] = [];
			if (summary.title) summarySegments.push(summary.title as string);
			if (summary.body) summarySegments.push(summary.body as string);
			if (summarySegments.length > 0) {
				segments.push(summarySegments.join("\n"));
			}

			if (Array.isArray(summary.diffs) && summary.diffs.length > 0) {
				const diffLines = (summary.diffs as Record<string, unknown>[])
					.slice(0, 3)
					.map((diff) => {
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

	// Don't add placeholder text for empty messages - they'll be filtered out
	return {
		text: segments.join("\n\n"),
		tools: toolInfos,
	};
}

// Compact tool group component
function ToolGroup({ tools }: { tools: ToolInfo[] }) {
	if (tools.length === 0) return null;

	return (
		<div className="bg-raised border border-border rounded-xl px-3 py-2 space-y-1">
			{tools.map((tool, index) => (
				<div
					key={`${tool.name}-${tool.detail || index}`}
					className="flex items-center gap-2 text-xs"
				>
					<span
						className={`uppercase font-medium w-12 flex-shrink-0 ${
							tool.status === "error"
								? "text-danger"
								: tool.status === "running"
									? "text-warning"
									: "text-muted"
						}`}
					>
						{tool.name}
					</span>
					{tool.detail && (
						<span className="text-fg font-mono truncate">{tool.detail}</span>
					)}
					{tool.status === "running" && (
						<Loader2 className="h-3 w-3 animate-spin text-warning ml-auto flex-shrink-0" />
					)}
				</div>
			))}
		</div>
	);
}

interface ChatInterfaceProps {
	projectId: string;
	initialPrompt?: string | null;
	isSquircleMode?: boolean;
}

export function ChatInterface({
	projectId,
	initialPrompt,
	isSquircleMode = false,
}: ChatInterfaceProps) {
	const projectState = useProjectStateOptional();

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
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [currentStatus, setCurrentStatus] = useState<string | null>(null);
	const [hasActiveStream, setHasActiveStream] = useState(false);
	const [containerReady, setContainerReady] = useState(false);
	const [waitingForContainer, setWaitingForContainer] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const hasLoadedRef = useRef(false);
	const hasSentInitialPromptRef = useRef(false);

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

	// Ensure container is ready before proceeding
	const ensureContainerReady = useCallback(async (): Promise<boolean> => {
		setWaitingForContainer(true);
		projectState?.setContainerStatus("starting");

		try {
			// Check current status
			const { data: statusData } = await actions.projects.getPreviewStatus({
				id: projectId,
			});

			if (statusData?.status === "running") {
				setContainerReady(true);
				setWaitingForContainer(false);
				projectState?.setContainerStatus("running");
				return true;
			}

			// Start container if not running
			logger.info("Container not running, starting...");
			const { error: createError } = await actions.projects.createPreview({
				id: projectId,
			});

			if (createError) {
				logger.error("Failed to create preview:", createError);
				projectState?.setContainerStatus("failed");
				projectState?.setError(
					createError.message || "Failed to start container",
				);
				setWaitingForContainer(false);
				return false;
			}

			// Poll for container to be ready
			let attempts = 0;
			while (attempts < 30) {
				await new Promise((r) => setTimeout(r, 2000));
				const { data: pollStatus } = await actions.projects.getPreviewStatus({
					id: projectId,
				});

				if (pollStatus?.status === "running") {
					setContainerReady(true);
					setWaitingForContainer(false);
					projectState?.setContainerStatus("running");
					return true;
				}
				attempts++;
			}

			projectState?.setContainerStatus("failed");
			projectState?.setError("Container startup timeout");
			setWaitingForContainer(false);
			return false;
		} catch (err) {
			logger.error("Error ensuring container ready:", err as Error);
			projectState?.setContainerStatus("failed");
			projectState?.setError(
				err instanceof Error ? err.message : "Unknown error",
			);
			setWaitingForContainer(false);
			return false;
		}
	}, [projectId, projectState]);

	const loadHistory = useCallback(async () => {
		if (!hasLoadedRef.current) {
			setIsLoadingHistory(true);
		}

		try {
			const { data, error } = await actions.chat.getHistory({ projectId });
			if (!error && data) {
				const rawMessages = (data.messages || []) as unknown[];

				const mapped: ChatMessage[] = rawMessages
					.map((m) => {
						const msg = m as Record<string, unknown>;
						const info = msg.info as Record<string, unknown> | undefined;
						const role =
							(info?.role as ChatMessage["role"]) ||
							(msg.role as ChatMessage["role"]) ||
							"assistant";

						const { text, tools } = parseMessageContent(m);

						return {
							id: (msg.id as string) || crypto.randomUUID(),
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
					// If we have messages, check if session is busy
					// Default to "ready" to show split view with preview
					try {
						const { data: sessionStatus } = await actions.sessions.getStatus({
							projectId,
						});
						if (sessionStatus?.status === "busy") {
							projectState?.setPhase("generating");
							setHasActiveStream(true);
						} else {
							// idle, completed, unknown, or any other status - show ready
							projectState?.setPhase("ready");
						}
					} catch {
						// If we can't get session status, assume ready if we have messages
						projectState?.setPhase("ready");
					}
					return;
				}

				// No OpenCode messages yet - check for initial prompt
				// But if there's an existing session, wait for container instead of re-sending
				const promptToSend = data.initialPrompt || initialPrompt;
				if (
					promptToSend &&
					!hasSentInitialPromptRef.current &&
					!data.hasExistingSession
				) {
					const initialMessage: ChatMessage = {
						id: `initial-${projectId}`,
						role: "user",
						content: promptToSend,
					};

					setTodos(null);
					setMessages([initialMessage]);
					if (data.model) setSelectedModel(data.model);

					// Show loading state immediately
					hasSentInitialPromptRef.current = true;
					setHasActiveStream(true);
					setCurrentStatus("Starting environment...");

					logger.info(
						"Ensuring container is ready before sending initial prompt",
					);

					const ready = await ensureContainerReady();
					if (!ready) {
						logger.error("Container not ready, cannot send initial prompt");
						hasSentInitialPromptRef.current = false;
						setHasActiveStream(false);
						setCurrentStatus(null);
						return;
					}

					// Now send the initial prompt
					logger.info("Container ready, sending initial prompt to OpenCode");
					projectState?.setPhase("generating");
					setCurrentStatus("Processing request...");

					try {
						const { error: sendError } = await actions.sessions.sendMessage({
							projectId,
							message: promptToSend,
							model: data.model || selectedModel,
						});

						if (sendError) {
							logger.error("Failed to send initial message:", sendError);
							setHasActiveStream(false);
							setCurrentStatus(null);
							hasSentInitialPromptRef.current = false;
						}
					} catch (err) {
						logger.error("Failed to send initial message:", err as Error);
						setHasActiveStream(false);
						setCurrentStatus(null);
						hasSentInitialPromptRef.current = false;
					}
				} else if (data.hasExistingSession) {
					// Project has been generated before but container isn't ready yet
					// Show loading state and wait for container, then reload history
					if (promptToSend) {
						const initialMessage: ChatMessage = {
							id: `initial-${projectId}`,
							role: "user",
							content: promptToSend,
						};
						setMessages([initialMessage]);
					}
					setHasActiveStream(true);
					setCurrentStatus("Reconnecting to session...");

					// For existing projects, go to ready state immediately to show split view
					// The preview will show loading state while container starts
					projectState?.setPhase("ready");

					// Wait for container to be ready, then reload history
					const ready = await ensureContainerReady();
					if (ready) {
						// Container is ready, reload to get actual messages
						setCurrentStatus("Loading history...");
						// Reset the loaded ref so we can reload
						hasLoadedRef.current = false;
						loadHistory();
					} else {
						setHasActiveStream(false);
						setCurrentStatus(null);
					}
				} else {
					setTodos(null);
					setMessages([]);
					// No initial prompt and no existing session - this is an empty project
					projectState?.setPhase("ready");
				}
			}
		} catch (err) {
			logger.error("Failed to load chat history:", err as Error);
		} finally {
			if (!hasLoadedRef.current) {
				hasLoadedRef.current = true;
				setIsLoadingHistory(false);
			}
		}
	}, [
		projectId,
		initialPrompt,
		selectedModel,
		ensureContainerReady,
		projectState,
	]);

	// SSE connection effect
	useEffect(() => {
		// Don't connect SSE until container is ready
		if (!containerReady && !hasLoadedRef.current) {
			// Start loading history which will trigger container setup
			loadHistory();
			return;
		}

		if (typeof window === "undefined") return;

		let es: EventSource | null = null;
		let reconnectAttempts = 0;
		let reconnectTimer: NodeJS.Timeout | null = null;
		let isMounted = true;

		const connect = () => {
			if (!isMounted) return;

			es = new EventSource(`/api/sessions/${projectId}/events`);

			es.onopen = () => {
				logger.info("SSE connection opened");
				reconnectAttempts = 0;
			};

			es.onmessage = (event) => {
				try {
					const payload = JSON.parse(event.data);

					switch (payload.type) {
						case "server.connected":
							logger.info(
								`Connected to SSE (session: ${payload.sessionId || "unknown"})`,
							);
							break;

						case "message.part.updated": {
							setHasActiveStream(true);
							const part = payload.properties?.part as
								| Record<string, unknown>
								| undefined;
							if (part?.type === "text" && part.text) {
								setCurrentStatus("Writing response...");
							} else if (part?.type === "tool") {
								const toolName =
									typeof part.tool === "string"
										? part.tool
										: (part.tool as Record<string, unknown>)?.name || "tool";
								const input = ((part.state as Record<string, unknown>)?.input ??
									{}) as Record<string, unknown>;

								let detail = "";
								const normalizedTool = (toolName as string).toLowerCase();
								if (
									normalizedTool === "read" ||
									normalizedTool === "write" ||
									normalizedTool === "edit"
								) {
									const filePath = (input.filePath ||
										input.path ||
										"") as string;
									const fileName = filePath.split("/").pop() || filePath;
									detail = fileName ? `: ${fileName}` : "";
								} else if (
									normalizedTool === "bash" ||
									normalizedTool === "shell"
								) {
									const cmd = (input.command || input.cmd || "") as string;
									detail = cmd
										? `: ${cmd.length > 20 ? `${cmd.slice(0, 17)}...` : cmd}`
										: "";
								} else if (
									normalizedTool === "glob" ||
									normalizedTool === "grep"
								) {
									const pattern = (input.pattern || "") as string;
									detail = pattern ? `: ${pattern}` : "";
								}

								setCurrentStatus(`Running ${toolName}${detail}`);
							} else {
								setCurrentStatus("Processing...");
							}
							break;
						}

						case "tool.execute": {
							setHasActiveStream(true);
							const toolName = payload.properties?.name || "tool";
							const input = (payload.properties?.input ?? {}) as Record<
								string,
								unknown
							>;

							let detail = "";
							const normalizedTool = (toolName as string).toLowerCase();
							if (
								normalizedTool === "read" ||
								normalizedTool === "write" ||
								normalizedTool === "edit"
							) {
								const filePath = (input.filePath || input.path || "") as string;
								const fileName = filePath.split("/").pop() || filePath;
								detail = fileName ? `: ${fileName}` : "";
							} else if (
								normalizedTool === "bash" ||
								normalizedTool === "shell"
							) {
								const cmd = (input.command || input.cmd || "") as string;
								detail = cmd
									? `: ${cmd.length > 20 ? `${cmd.slice(0, 17)}...` : cmd}`
									: "";
							}

							setCurrentStatus(`Running ${toolName}${detail}`);
							break;
						}

						case "tool.result":
							setCurrentStatus("Processing results...");
							break;

						case "session.updated": {
							const status = payload.properties?.info?.status;
							if (status === "completed" || status === "idle") {
								setHasActiveStream(false);
								setCurrentStatus(null);
								projectState?.transitionToReady();
								startDevServerForProject(projectId);
								refreshCodePreview();
								loadHistory();
							} else if (status === "busy" || status === "running") {
								setHasActiveStream(true);
								setCurrentStatus((prev) => prev || "Processing...");
							}
							break;
						}

						case "message.updated":
						case "messages.synced":
							loadHistory();
							setHasActiveStream(false);
							setCurrentStatus(null);
							refreshCodePreview();
							break;

						case "session.idle":
							setHasActiveStream(false);
							setCurrentStatus(null);
							projectState?.transitionToReady();
							startDevServerForProject(projectId);
							refreshCodePreview();
							break;

						case "todo.updated": {
							const todoItems = Array.isArray(payload.properties?.todos)
								? (payload.properties.todos as AgentTodoItem[])
								: [];
							setTodos(todoItems.length > 0 ? todoItems : null);
							break;
						}

						case "file.edited":
							setCurrentStatus(
								`Edited: ${payload.properties?.file?.split("/").pop() || "file"}`,
							);
							break;

						case "error":
							logger.error("Session error:", payload.message);
							setHasActiveStream(false);
							setCurrentStatus(null);
							break;

						default:
							logger.debug("Session event:", payload);
					}
				} catch (err) {
					logger.error("Failed to parse session SSE event:", err as Error);
				}
			};

			es.onerror = () => {
				if (!isMounted) return;

				es?.close();
				es = null;

				const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
				reconnectAttempts++;

				logger.info(
					`SSE disconnected, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`,
				);

				reconnectTimer = setTimeout(() => {
					if (isMounted) {
						connect();
					}
				}, delay);
			};
		};

		connect();

		return () => {
			isMounted = false;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}
			es?.close();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectId, containerReady, loadHistory, projectState]);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	// Persist input to localStorage
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(`chat-input-${projectId}`, input);
		}
	}, [input, projectId]);

	const handleStop = async () => {
		try {
			await actions.sessions.abort({ projectId });
			setHasActiveStream(false);
			setCurrentStatus(null);
		} catch (err) {
			logger.error("Failed to abort session:", err as Error);
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
				logger.error("Failed to send message:", error as Error);
				setHasActiveStream(false);
				setCurrentStatus(null);
			}
		} catch (err) {
			logger.error("Failed to send message:", err as Error);
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
		let match: RegExpExecArray | null = null;
		let blockIndex = 0;

		while (true) {
			match = codeBlockRegex.exec(content);
			if (match === null) break;

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
								key={`text-${part.content.slice(0, 20)}-${i}`}
								remarkPlugins={[remarkGfm]}
								components={{
									code: ({ className, ...props }: { className?: string }) => {
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
									pre: ({ children }) => (
										<pre className="bg-surface/30 p-4 rounded-md overflow-x-auto text-xs max-w-full">
											{children}
										</pre>
									),
									p: ({ children }) => (
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
								key={`streaming-${part.file || part.language || "code"}`}
								className="border border-border rounded-md overflow-hidden bg-bg/50 not-prose max-w-full"
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
							key={`code-${part.index}`}
							open={expandedBlocks.has(part.index!)}
							onOpenChange={() => toggleBlock(part.index!)}
						>
							<div className="border border-border rounded-md overflow-hidden bg-bg/50 not-prose max-w-full">
								<CollapsibleTrigger asChild>
									<button
										type="button"
										className="w-full flex items-center justify-between p-3 hover:bg-surface/50 transition-colors min-w-0"
									>
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

	// Show loading state while waiting for container
	if (waitingForContainer && messages.length === 0) {
		return (
			<div
				className={`flex-1 flex flex-col ${isSquircleMode ? "" : "border-r border-border"} min-w-0`}
			>
				<div className="flex-1 flex items-center justify-center p-4">
					<div className="text-center space-y-6">
						<AIBlob size={80} className="mx-auto" />
						<div>
							<p className="text-lg font-medium text-strong">
								Starting preview environment...
							</p>
							<p className="text-sm text-muted mt-2">
								Setting up your development container
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`flex-1 flex flex-col ${isSquircleMode ? "" : "border-r border-border"} min-w-0`}
		>
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
				{(() => {
					// Group consecutive tool-only assistant messages
					const groupedMessages: Array<{
						type: "user" | "assistant-text" | "assistant-tools";
						messages: ChatMessage[];
						allTools: ToolInfo[];
					}> = [];

					for (const message of messages) {
						const toolInfos = message.tools ?? [];
						const textContent = (message.content || "").trim();
						const hasTextContent = textContent.length > 0;
						const isToolOnly =
							message.role === "assistant" &&
							!hasTextContent &&
							toolInfos.length > 0;

						if (message.role === "user") {
							groupedMessages.push({
								type: "user",
								messages: [message],
								allTools: [],
							});
						} else if (isToolOnly) {
							// Check if we can merge with previous tool-only group
							const lastGroup = groupedMessages[groupedMessages.length - 1];
							if (lastGroup?.type === "assistant-tools") {
								lastGroup.messages.push(message);
								lastGroup.allTools.push(...toolInfos);
							} else {
								groupedMessages.push({
									type: "assistant-tools",
									messages: [message],
									allTools: [...toolInfos],
								});
							}
						} else {
							// Assistant message with text content
							groupedMessages.push({
								type: "assistant-text",
								messages: [message],
								allTools: toolInfos,
							});
						}
					}

					return groupedMessages.map((group, groupIndex) => {
						if (group.type === "user") {
							const message = group.messages[0];
							return (
								<div key={message.id} className="flex justify-end">
									<div className="max-w-[85%] rounded-2xl px-4 py-3 overflow-hidden bg-strong text-surface">
										<div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap break-words">
											{message.content}
										</div>
									</div>
								</div>
							);
						}

						if (group.type === "assistant-tools") {
							// Render all tools from consecutive tool-only messages in one bubble
							return (
								<div
									key={`tools-${groupIndex}-${group.messages[0].id}`}
									className="flex justify-start"
								>
									<div className="max-w-[85%] rounded-2xl px-4 py-3 overflow-hidden bg-surface text-strong">
										<ToolGroup tools={group.allTools} />
									</div>
								</div>
							);
						}

						// Assistant message with text
						const message = group.messages[0];
						const textContent = (message.content || "").trim();
						return (
							<div key={message.id} className="flex justify-start">
								<div className="max-w-[85%] rounded-2xl px-4 py-3 overflow-hidden bg-surface text-strong">
									{textContent && <MessageContent content={textContent} />}
									{group.allTools.length > 0 && (
										<div className={textContent ? "mt-3" : ""}>
											<ToolGroup tools={group.allTools} />
										</div>
									)}
								</div>
							</div>
						);
					});
				})()}
				{isGenerating && (
					<div className="flex justify-start">
						<div className="bg-surface rounded-2xl px-4 py-3 flex items-center gap-3">
							<Loader2 className="h-4 w-4 animate-spin text-muted" />
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
				className={`border-t border-border p-4 space-y-3 ${isSquircleMode ? "bg-surface/50" : ""}`}
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
