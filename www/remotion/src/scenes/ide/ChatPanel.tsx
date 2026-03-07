import { loadFont } from "@remotion/google-fonts/Inter";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../../theme";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

type ChatPanelProps = { width: number };
const ACTION_PILLS = ["Create app", "Add auth", "Create dashboard.tsx", "Add expense upload", "Create monthly overview"];

type AvatarProps = { letter: string; bg: string };
const Avatar: React.FC<AvatarProps> = ({ letter, bg }) => (
	<div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ backgroundColor: bg }}>{letter}</div>
);

type MessageProps = { role: "user" | "assistant"; text: string };
const Message: React.FC<MessageProps> = ({ role, text }) => {
	const t = useTheme();
	const isUser = role === "user";
	return (
		<div className="flex gap-3 items-start">
			<Avatar letter={isUser ? "U" : "A"} bg={isUser ? "#7c3aed" : t.assistantAvatarBg} />
			<div className="flex flex-col gap-1">
				<span className="text-xs font-medium" style={{ color: isUser ? t.chatUserLabel : t.chatAssistantLabel }}>{isUser ? "You" : "Assistant"}</span>
				<span className="text-sm leading-relaxed" style={{ color: isUser ? t.chatUserText : t.chatAssistantText }}>{text}</span>
			</div>
		</div>
	);
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ width }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const t = useTheme();
	const inputProgress = spring({ frame: frame - 30, fps, config: { damping: 200 } });

	return (
		<div className="flex flex-col h-full" style={{ width, backgroundColor: t.chatPanelBg, fontFamily }}>
			<div className="flex-1 p-5 overflow-hidden flex flex-col gap-4">
				<Message role="user" text="Develop a SaaS tool to manage my team's finances. Integrate Google auth, expense uploads, and monthly dashboards." />
				<Message role="assistant" text="I'll create a SaaS finance management tool with Google authentication, expense tracking, and monthly dashboards." />
				<div className="flex flex-wrap gap-2 mt-1">
					{ACTION_PILLS.map((pill) => (
						<div key={pill} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs" style={{ backgroundColor: t.pillBg, border: `1px solid ${t.pillBorder}` }}>
							<span style={{ color: "#22c55e" }}>✓</span>
							<span style={{ color: t.pillText }}>{pill}</span>
						</div>
					))}
				</div>
				<Message role="assistant" text="Done! Your finance SaaS is ready with Google auth, expense uploads, and monthly dashboards." />
			</div>
			<div className="p-4 border-t" style={{ borderColor: t.borderSubtle, opacity: inputProgress }}>
				<div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: t.inputBg, color: t.textMuted }}>
					<span>Type a message...</span>
				</div>
				<div className="flex items-center gap-2 mt-2 text-xs" style={{ color: t.textMuted }}>
					<span>Claude Opus 4.6</span>
				</div>
			</div>
		</div>
	);
};
