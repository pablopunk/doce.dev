import type { ChatDebugScenario } from "@/components/debug/ChatDebugNavbar";
import {
	createMockDiagnostic,
	createMockErrorMessage,
	createMockMessageWithImage,
	createMockMessageWithReasoning,
	createMockPermissionRequest,
	createMockQuestionRequest,
	createMockTextMessage,
	createMockTodo,
	createMockToolCall,
} from "@/stores/mock/createMockChatStore";
import type {
	ChatItem,
	PendingPermissionRequest,
	PendingQuestionRequest,
	TodoItem,
} from "@/stores/useChatStore";

export interface ChatScenario {
	items: ChatItem[];
	opencodeReady: boolean;
	isStreaming: boolean;
	todos: TodoItem[];
	pendingPermission: PendingPermissionRequest | null;
	pendingQuestion: PendingQuestionRequest | null;
}

export const chatScenarios: Record<ChatDebugScenario, ChatScenario> = {
	compaction: {
		items: [
			createMockTextMessage(
				"user_1",
				"user",
				"Build me a full dashboard with charts, tables, auth, and dark mode",
			),
			createMockTextMessage(
				"assistant_1",
				"assistant",
				"I'll set up the dashboard layout with a sidebar navigation and main content area.",
			),
			createMockToolCall(
				"tool_1",
				"write",
				{ filePath: "/app/src/components/Dashboard.tsx" },
				"success",
				{ bytesWritten: 2400 },
			),
			createMockToolCall(
				"tool_2",
				"write",
				{ filePath: "/app/src/components/Sidebar.tsx" },
				"success",
				{ bytesWritten: 1800 },
			),
			createMockTextMessage(
				"assistant_2",
				"assistant",
				"Dashboard layout is ready. Now I'll add the charts and data tables.",
			),
			createMockToolCall(
				"tool_3",
				"write",
				{ filePath: "/app/src/components/Charts.tsx" },
				"success",
				{ bytesWritten: 3200 },
			),
			createMockToolCall(
				"compact_1",
				"compact_context",
				undefined,
				"success",
				"Session context compacted to preserve project momentum.",
			),
			createMockTextMessage(
				"assistant_3",
				"assistant",
				"Continuing with the auth system and dark mode support. The dashboard structure is solid.",
			),
			createMockToolCall(
				"tool_4",
				"write",
				{ filePath: "/app/src/components/AuthProvider.tsx" },
				"success",
				{ bytesWritten: 1600 },
			),
		],
		opencodeReady: true,
		isStreaming: false,
		todos: [],
		pendingPermission: null,
		pendingQuestion: null,
	},

	empty: {
		items: [],
		opencodeReady: true,
		isStreaming: false,
		todos: [],
		pendingPermission: null,
		pendingQuestion: null,
	},

	"simple-conversation": {
		items: [
			createMockTextMessage(
				"user_1",
				"user",
				"Create a React button component with hover effects",
			),
			createMockTextMessage(
				"assistant_1",
				"assistant",
				"I'll create a beautiful React button component with hover effects for you. This will include smooth transitions, scale effects, and color changes.",
			),
			createMockTextMessage(
				"user_2",
				"user",
				"Can you also add a loading state?",
			),
			createMockTextMessage(
				"assistant_2",
				"assistant",
				"Absolutely! I'll add a loading state with a spinner animation. The button will show a loading indicator and be disabled while the action is in progress.",
			),
		],
		opencodeReady: true,
		isStreaming: false,
		todos: [],
		pendingPermission: null,
		pendingQuestion: null,
	},

	"tool-calls": {
		items: [
			createMockTextMessage(
				"user_1",
				"user",
				"Create a todo app with React and TypeScript",
			),
			createMockTextMessage(
				"assistant_1",
				"assistant",
				"I'll create a todo app for you. Let me start by setting up the project structure and components.",
			),
			createMockToolCall(
				"tool_1",
				"write",
				{
					filePath: "/app/src/components/TodoList.tsx",
					content: "export function TodoList() { ... }",
				},
				"success",
				{ bytesWritten: 1250 },
			),
			createMockToolCall(
				"tool_2",
				"write",
				{
					filePath: "/app/src/components/TodoItem.tsx",
					content: "export function TodoItem() { ... }",
				},
				"success",
				{ bytesWritten: 890 },
			),
			createMockToolCall(
				"tool_3",
				"bash",
				{ command: "npm install lucide-react", description: "Install icons" },
				"running",
			),
			createMockTextMessage(
				"assistant_2",
				"assistant",
				"I've created the todo components and I'm installing the icon library. The app will have add, toggle, and delete functionality.",
			),
		],
		opencodeReady: true,
		isStreaming: false,
		todos: [],
		pendingPermission: null,
		pendingQuestion: null,
	},

	errors: {
		items: [
			createMockTextMessage("user_1", "user", "Deploy this to production"),
			createMockErrorMessage(
				"assistant_1",
				"assistant",
				"I'll deploy this to production for you.",
				"Failed to deploy: Docker container failed to start. Error: port 3000 already in use",
			),
			createMockToolCall(
				"tool_1",
				"bash",
				{ command: "docker ps", description: "Check running containers" },
				"error",
				undefined,
				"Command failed: docker daemon not running",
			),
		],
		opencodeReady: true,
		isStreaming: false,
		todos: [],
		pendingPermission: null,
		pendingQuestion: null,
	},

	todos: {
		items: [
			createMockTextMessage("user_1", "user", "Build a full-stack application"),
			createMockTextMessage(
				"assistant_1",
				"assistant",
				"I'll help you build a full-stack application. Let me break this down into manageable tasks.",
			),
		],
		opencodeReady: true,
		isStreaming: false,
		todos: [
			createMockTodo(
				"Set up project structure and dependencies",
				"completed",
				"high",
			),
			createMockTodo("Create database schema and models", "completed", "high"),
			createMockTodo("Build API endpoints", "in_progress", "high"),
			createMockTodo("Create frontend components", "pending", "medium"),
			createMockTodo("Add authentication", "pending", "medium"),
			createMockTodo("Write tests", "pending", "low"),
		],
		pendingPermission: null,
		pendingQuestion: null,
	},

	permission: {
		items: [
			createMockTextMessage(
				"user_1",
				"user",
				"Delete all files in the temp directory",
			),
			createMockTextMessage(
				"assistant_1",
				"assistant",
				"I need permission to delete files. Let me request that from you.",
			),
		],
		opencodeReady: true,
		isStreaming: false,
		todos: [],
		pendingPermission: createMockPermissionRequest("delete", ["/app/temp/*"]),
		pendingQuestion: null,
	},

	question: {
		items: [
			createMockTextMessage("user_1", "user", "Set up a new database"),
			createMockTextMessage(
				"assistant_1",
				"assistant",
				"I can help you set up a database. Let me ask a few questions first.",
			),
		],
		opencodeReady: true,
		isStreaming: false,
		todos: [],
		pendingPermission: null,
		pendingQuestion: createMockQuestionRequest([
			{
				header: "Database Selection",
				question: "Which database would you like to use?",
				options: [
					{ label: "PostgreSQL", description: "Robust relational database" },
					{ label: "MySQL", description: "Popular open-source database" },
					{ label: "SQLite", description: "Lightweight file-based database" },
					{ label: "MongoDB", description: "NoSQL document database" },
				],
			},
		]),
	},

	image: {
		items: [
			createMockMessageWithImage(
				"user_1",
				"user",
				"Can you create a component that looks like this design?",
				"design-mockup.png",
			),
			createMockTextMessage(
				"assistant_1",
				"assistant",
				"I can see your design mockup. I'll create a React component that matches this layout with the card design, shadows, and typography shown in the image.",
			),
		],
		opencodeReady: true,
		isStreaming: false,
		todos: [],
		pendingPermission: null,
		pendingQuestion: null,
	},

	streaming: {
		items: [
			createMockTextMessage("user_1", "user", "Explain how React hooks work"),
			createMockTextMessage(
				"assistant_1",
				"assistant",
				"React Hooks are functions that let you use state and other React features in functional components. The most commonly used hooks are:\n\n1. **useState** - Adds state to functional components\n2. **useEffect** - Handles side effects like data fetching\n3. **useContext** - Accesses React context\n4. **useRef** - Creates mutable references\n5. **useCallback** - Memoizes callbacks\n6. **useMemo** - Memoizes expensive computations\n\nHooks were introduced in React 16.8 and have revolutionized how we write React components...",
				{ isStreaming: true },
			),
		],
		opencodeReady: true,
		isStreaming: true,
		todos: [],
		pendingPermission: null,
		pendingQuestion: null,
	},

	reasoning: {
		items: [
			createMockTextMessage(
				"user_1",
				"user",
				"Optimize this slow database query",
			),
			createMockMessageWithReasoning(
				"assistant_1",
				"assistant",
				"Based on my analysis, here are the optimizations:\n\n1. Add an index on the `created_at` column\n2. Use `SELECT` with specific columns instead of `*`\n3. Add a `LIMIT` clause for pagination\n4. Consider using a materialized view for complex aggregations",
				"The user wants to optimize a slow database query. I should:\n1. Look for missing indexes\n2. Check for N+1 queries\n3. Suggest query restructuring\n4. Consider caching strategies\n5. Recommend pagination for large result sets",
			),
		],
		opencodeReady: true,
		isStreaming: false,
		todos: [],
		pendingPermission: null,
		pendingQuestion: null,
	},
};

// Diagnostic scenarios for testing error display
export const diagnosticScenarios = {
	auth: createMockDiagnostic(
		"auth",
		"Authentication Failed",
		"Your API key for Anthropic is invalid or has expired.",
		[
			{
				id: "check-key",
				label: "Check API Key",
				description: "Verify your API key in settings",
			},
			{
				id: "regenerate",
				label: "Regenerate Key",
				description: "Generate a new API key",
			},
		],
	),
	provider_model: createMockDiagnostic(
		"provider_model",
		"Model Unavailable",
		"The selected model (claude-opus) is currently at capacity.",
		[
			{
				id: "retry",
				label: "Retry",
				description: "Try again in a few moments",
			},
			{
				id: "switch",
				label: "Switch Model",
				description: "Use a different model",
			},
		],
	),
	runtime_unreachable: createMockDiagnostic(
		"runtime_unreachable",
		"Runtime Unavailable",
		"Cannot connect to the OpenCode runtime. The container may have stopped.",
		[
			{
				id: "restart",
				label: "Restart Runtime",
				description: "Restart the OpenCode container",
			},
			{
				id: "check-logs",
				label: "View Logs",
				description: "Check runtime logs for errors",
			},
		],
	),
	timeout: createMockDiagnostic(
		"timeout",
		"Request Timeout",
		"The request timed out after 30 seconds.",
		[
			{ id: "retry", label: "Retry", description: "Try the request again" },
			{
				id: "simplify",
				label: "Simplify",
				description: "Break down your request into smaller parts",
			},
		],
	),
	unknown: createMockDiagnostic(
		"unknown",
		"Unknown Error",
		"An unexpected error occurred while processing your request.",
		[
			{ id: "retry", label: "Retry", description: "Try again" },
			{
				id: "report",
				label: "Report Issue",
				description: "Report this error to support",
			},
		],
	),
};
