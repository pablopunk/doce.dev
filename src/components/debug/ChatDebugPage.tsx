// Simplified approach: Use React Context to provide mock data
// This avoids the complexity of mocking Zustand's internals

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { PermissionDock } from "@/components/chat/composer/PermissionDock";
import { QuestionDock } from "@/components/chat/composer/QuestionDock";
import { TodoDock } from "@/components/chat/composer/TodoDock";
import {
	ChatDebugNavbar,
	type ChatDebugScenario,
} from "@/components/debug/ChatDebugNavbar";
import { MockPreviewPanel } from "@/components/debug/MockPreviewPanel";
import { ResizableSeparator } from "@/components/preview/ResizableSeparator";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { chatScenarios } from "@/lib/debug/chatScenarios";
import type { ChatItem } from "@/stores/useChatStore";

const DEBUG_PROJECT_ID = "debug-chat-ui";

const mockModels = [
	{
		id: "claude-sonnet-4-20250514",
		name: "Claude Sonnet 4",
		provider: "anthropic",
		vendor: "Anthropic",
		supportsImages: true,
	},
];

// Context for debug state
interface DebugChatContextType {
	items: ChatItem[];
	opencodeReady: boolean;
	isStreaming: boolean;
	expandedTools: Set<string>;
	toggleToolExpanded: (id: string) => void;
	todos: import("@/stores/useChatStore").TodoItem[];
	pendingPermission:
		| import("@/stores/useChatStore").PendingPermissionRequest
		| null;
	pendingQuestion:
		| import("@/stores/useChatStore").PendingQuestionRequest
		| null;
}

const DebugChatContext = createContext<DebugChatContextType | null>(null);

function useDebugChat() {
	const ctx = useContext(DebugChatContext);
	if (!ctx) throw new Error("Must be used within DebugChatContext");
	return ctx;
}

// Pure ChatPanel implementation using context instead of store
function DebugChatPanel({
	models,
	onOpenFile,
	onStreamingStateChange,
}: {
	models: typeof mockModels;
	onOpenFile?: (path: string) => void;
	onStreamingStateChange?: (count: number, streaming: boolean) => void;
}) {
	const {
		items,
		opencodeReady,
		isStreaming,
		expandedTools,
		toggleToolExpanded,
		todos,
		pendingPermission,
		pendingQuestion,
	} = useDebugChat();
	const scrollRef = useRef<HTMLDivElement>(null);

	// Notify parent of streaming state changes
	useEffect(() => {
		const userMessageCount = items.filter(
			(item) =>
				item.type === "message" &&
				(item.data as import("@/types/message").Message).role === "user",
		).length;
		onStreamingStateChange?.(userMessageCount, isStreaming);
	}, [items, isStreaming, onStreamingStateChange]);

	const isBlocked = Boolean(pendingPermission || pendingQuestion);

	return (
		<div className="flex flex-col h-full">
			<div className="flex-1 overflow-y-auto" ref={scrollRef}>
				{items.length === 0 ? (
					<div className="flex items-center justify-center h-full text-muted-foreground">
						{opencodeReady ? (
							<p>Send a message to start chatting</p>
						) : (
							<div className="flex items-center gap-2">
								<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
								<p>Waiting for opencode...</p>
							</div>
						)}
					</div>
				) : (
					<ChatMessages
						items={items}
						expandedTools={expandedTools}
						onToggleTool={toggleToolExpanded}
						onOpenFile={onOpenFile}
					/>
				)}
			</div>

			{todos.length > 0 && !isBlocked && <TodoDock todos={todos} />}
			{pendingQuestion && (
				<QuestionDock
					request={pendingQuestion}
					onSubmit={() => {}}
					onReject={() => {}}
				/>
			)}
			{pendingPermission && (
				<PermissionDock request={pendingPermission} onDecide={() => {}} />
			)}
			{!isBlocked && (
				<ChatInput
					onSend={() => {}}
					disabled={!opencodeReady || isStreaming}
					placeholder={
						!opencodeReady
							? "Waiting for opencode..."
							: isStreaming
								? "Processing..."
								: "Type a message..."
					}
					model={models[0]?.id || null}
					models={models}
					onModelChange={() => {}}
					images={[]}
					onImagesChange={() => {}}
					imageError={null}
					onImageError={() => {}}
					supportsImages={models[0]?.supportsImages ?? true}
				/>
			)}
		</div>
	);
}

export function ChatDebugPage() {
	const [activeScenario, setActiveScenario] =
		useState<ChatDebugScenario>("empty");
	const [items, setItems] = useState<ChatItem[]>(chatScenarios.empty.items);
	const [opencodeReady, setOpenCodeReady] = useState(true);
	const [isStreaming, setIsStreaming] = useState(false);
	const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
	const [todos, setTodos] = useState<
		import("@/stores/useChatStore").TodoItem[]
	>([]);
	const [pendingPermission, setPendingPermission] = useState<
		import("@/stores/useChatStore").PendingPermissionRequest | null
	>(null);
	const [pendingQuestion, setPendingQuestion] = useState<
		import("@/stores/useChatStore").PendingQuestionRequest | null
	>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const {
		leftPercent,
		rightPercent,
		isDragging,
		isMobile,
		isResizable,
		onSeparatorMouseDown,
	} = useResizablePanel({
		projectId: DEBUG_PROJECT_ID,
		minSize: 25,
		maxSize: 75,
		defaultSize: 40,
		containerRef,
	});

	const toggleToolExpanded = useCallback((id: string) => {
		setExpandedTools((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	// Update state when scenario changes
	useEffect(() => {
		const scenario = chatScenarios[activeScenario];
		setItems(scenario.items);
		setOpenCodeReady(scenario.opencodeReady);
		setIsStreaming(scenario.isStreaming);
		setTodos(scenario.todos);
		setPendingPermission(scenario.pendingPermission);
		setPendingQuestion(scenario.pendingQuestion);
		setExpandedTools(new Set());
	}, [activeScenario]);

	const contextValue: DebugChatContextType = {
		items,
		opencodeReady,
		isStreaming,
		expandedTools,
		toggleToolExpanded,
		todos,
		pendingPermission,
		pendingQuestion,
	};

	return (
		<DebugChatContext.Provider value={contextValue}>
			<div className="flex flex-col h-full overflow-hidden">
				<ChatDebugNavbar
					activeScenario={activeScenario}
					onScenarioChange={setActiveScenario}
				/>

				<div
					className="flex-1 flex w-full min-w-0 overflow-hidden relative"
					data-resizable-group
					ref={containerRef}
				>
					{isMobile ? (
						<div className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden">
							<DebugChatPanel
								models={mockModels}
								onOpenFile={(path) => console.log("Open file:", path)}
								onStreamingStateChange={(count, streaming) =>
									console.log("Streaming state:", count, streaming)
								}
							/>
						</div>
					) : (
						<>
							<div
								className="flex flex-col h-full border-r overflow-hidden"
								style={{ width: `${leftPercent}%` }}
							>
								<DebugChatPanel
									models={mockModels}
									onOpenFile={(path) => console.log("Open file:", path)}
									onStreamingStateChange={(count, streaming) =>
										console.log("Streaming state:", count, streaming)
									}
								/>
							</div>

							{isResizable && (
								<ResizableSeparator onMouseDown={onSeparatorMouseDown} />
							)}

							<div
								className="flex flex-col h-full overflow-hidden"
								style={{ width: `${rightPercent}%` }}
							>
								<MockPreviewPanel />
							</div>
						</>
					)}

					{isDragging && (
						<div
							style={{
								position: "fixed",
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								zIndex: 50,
								cursor: "col-resize",
								backgroundColor: "transparent",
							}}
						/>
					)}
				</div>
			</div>
		</DebugChatContext.Provider>
	);
}
