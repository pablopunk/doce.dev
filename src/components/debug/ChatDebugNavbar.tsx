import {
	AlertTriangle,
	CheckCircle,
	HelpCircle,
	Image,
	ListTodo,
	MessageSquare,
	RefreshCw,
	Terminal,
	XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type ChatDebugScenario =
	| "compaction"
	| "empty"
	| "simple-conversation"
	| "tool-calls"
	| "errors"
	| "todos"
	| "permission"
	| "question"
	| "image"
	| "streaming"
	| "reasoning";

interface ChatDebugNavbarProps {
	activeScenario: ChatDebugScenario;
	onScenarioChange: (scenario: ChatDebugScenario) => void;
}

const scenarios: Array<{
	id: ChatDebugScenario;
	label: string;
	icon: React.ReactNode;
	description: string;
}> = [
	{
		id: "compaction",
		label: "Compaction",
		icon: <RefreshCw className="h-4 w-4" />,
		description: "Context compaction mid-conversation",
	},
	{
		id: "empty",
		label: "Empty",
		icon: <MessageSquare className="h-4 w-4" />,
		description: "Initial empty state",
	},
	{
		id: "simple-conversation",
		label: "Conversation",
		icon: <MessageSquare className="h-4 w-4" />,
		description: "Simple back-and-forth",
	},
	{
		id: "tool-calls",
		label: "Tools",
		icon: <Terminal className="h-4 w-4" />,
		description: "Tool call sequence",
	},
	{
		id: "errors",
		label: "Errors",
		icon: <XCircle className="h-4 w-4" />,
		description: "Error states",
	},
	{
		id: "todos",
		label: "Todos",
		icon: <ListTodo className="h-4 w-4" />,
		description: "Active todo list",
	},
	{
		id: "permission",
		label: "Permission",
		icon: <CheckCircle className="h-4 w-4" />,
		description: "Permission dialog",
	},
	{
		id: "question",
		label: "Question",
		icon: <HelpCircle className="h-4 w-4" />,
		description: "Question dialog",
	},
	{
		id: "image",
		label: "Image",
		icon: <Image className="h-4 w-4" />,
		description: "Image attachment",
	},
	{
		id: "streaming",
		label: "Streaming",
		icon: <MessageSquare className="h-4 w-4" />,
		description: "Streaming message",
	},
	{
		id: "reasoning",
		label: "Reasoning",
		icon: <AlertTriangle className="h-4 w-4" />,
		description: "With reasoning",
	},
];

export function ChatDebugNavbar({
	activeScenario,
	onScenarioChange,
}: ChatDebugNavbarProps) {
	return (
		<div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b overflow-x-auto">
			<div className="text-sm font-medium mr-2 whitespace-nowrap">
				Scenarios:
			</div>
			{scenarios.map((scenario) => (
				<Button
					key={scenario.id}
					variant={activeScenario === scenario.id ? "default" : "outline"}
					size="sm"
					className="flex items-center gap-1.5 whitespace-nowrap"
					onClick={() => onScenarioChange(scenario.id)}
					title={scenario.description}
				>
					{scenario.icon}
					<span className="hidden sm:inline">{scenario.label}</span>
				</Button>
			))}
		</div>
	);
}
