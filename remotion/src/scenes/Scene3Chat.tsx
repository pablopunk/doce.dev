import { loadFont } from "@remotion/google-fonts/Inter";
import {
	AbsoluteFill,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { useTheme } from "../theme";
import { CodeEditor } from "./ide/CodeEditor";
import { FileTree } from "./ide/FileTree";

const { fontFamily } = loadFont("normal", {
	weights: ["400", "500", "600", "700"],
	subsets: ["latin"],
});

const TOOL_CALLS = [
	{
		name: "write_file",
		display: "Write components/Dashboard.tsx",
		icon: "file-code",
	},
	{ name: "bash_command", display: "npm install...", icon: "terminal" },
	{ name: "read_file", display: "Read lib/auth.ts", icon: "file-text" },
	{
		name: "write_file",
		display: "Write pages/dashboard.tsx",
		icon: "file-code",
	},
];

const STAT_CARDS = [
	{ label: "Total Expenses", value: "$12,450" },
	{ label: "Monthly Budget", value: "$15,000" },
	{ label: "Team Members", value: "8" },
];
const BAR_HEIGHTS = [140, 95, 170, 120, 155];

const TAB_SWITCH_FRAME = 105;

const LogoIcon: React.FC = () => (
	<svg width="20" height="20" viewBox="0 0 1080 1080" fill="none">
		<path
			d="M196 283L207.5 281L308.244 260.163L883.75 156.75V167.146L836.748 236.635L785.919 752.058L401.156 1032.75L390.771 1027.83L387.492 1024L361.805 993.355L308.244 493.252L196.75 303.936L196 283Z"
			fill="#404040"
		/>
		<path
			d="M676.612 46.75L196 283L406.075 403.75L883.75 157.016L676.612 46.75Z"
			fill="#C3C3C3"
		/>
		<path
			d="M710.508 532.3L883.75 637.259L868.978 667.578L522.003 822.75L430.181 772.896L710.508 532.3Z"
			fill="#565656"
		/>
		<path
			d="M636.135 387.75L749.325 463.807L744.953 475.844L458.616 691.857L328.75 562.63L636.135 387.75Z"
			fill="#565656"
		/>
		<path
			d="M196.75 296L400.75 414.112V553.43V1028.75L275.5 976.847V479.5L196.75 430V296Z"
			fill="white"
		/>
		<path
			d="M410.75 553.732V414.319L883.75 167.75V548.265L536.519 730.869V813.423L883.75 637.927V784.994L410.75 1033.75V644.487L749.232 464.617V382.063L410.75 553.732Z"
			fill="white"
		/>
	</svg>
);

const MoonIcon: React.FC<{ color: string }> = ({ color }) => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
	</svg>
);

const AlphaBadge: React.FC<{ bg: string; textColor: string }> = ({
	bg,
	textColor,
}) => (
	<span
		style={{
			display: "inline-flex",
			alignItems: "center",
			borderRadius: "9999px",
			border: "1px solid rgba(255,255,255,0.1)",
			backgroundColor: bg,
			padding: "2px 8px",
			fontSize: "11px",
			fontWeight: 600,
			color: textColor,
		}}
	>
		alpha
	</span>
);

const UserIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 16,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
		<circle cx="12" cy="7" r="4" />
	</svg>
);

const BotIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 16,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M12 8V4H8" />
		<rect width="16" height="12" x="4" y="8" rx="2" />
		<path d="M2 14h2" />
		<path d="M20 14h2" />
		<path d="M15 13v2" />
		<path d="M9 13v2" />
	</svg>
);

const CheckIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 12,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="3"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polyline points="20 6 9 17 4 12" />
	</svg>
);

const FileCodeIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 14,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
		<path d="M14 2v4a2 2 0 0 0 2 2h4" />
		<path d="m9 18 3-3-3-3" />
		<path d="m5 12-3 3 3 3" />
	</svg>
);

const TerminalIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 14,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="m4 17 6-6-6-6" />
		<path d="M12 19h8" />
	</svg>
);

const FileTextIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 14,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
		<path d="M14 2v5a1 1 0 0 0 1 1h5" />
		<path d="M10 9H8" />
		<path d="M16 13H8" />
		<path d="M16 17H8" />
	</svg>
);

const PaperclipIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 20,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
	</svg>
);

const SendIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 16,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="m22 2-7 20-4-9-9-4 20-7z" />
		<path d="M22 2 11 13" />
	</svg>
);

const RocketIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 14,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
		<path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
		<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
		<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
	</svg>
);

const ToolIcon: React.FC<{ type: string; color: string }> = ({
	type,
	color,
}) => {
	switch (type) {
		case "file-code":
			return <FileCodeIcon color={color} />;
		case "terminal":
			return <TerminalIcon color={color} />;
		case "file-text":
			return <FileTextIcon color={color} />;
		default:
			return <FileCodeIcon color={color} />;
	}
};

const ChatMessage: React.FC<{
	role: "user" | "assistant";
	text: string;
	progress: number;
}> = ({ role, text, progress }) => {
	const t = useTheme();
	const isUser = role === "user";

	return (
		<div
			className="flex gap-3 p-4"
			style={{
				backgroundColor: isUser ? t.mutedBg50 : t.sceneBg,
				opacity: progress,
				transform: `translateY(${(1 - progress) * 20}px)`,
			}}
		>
			<div
				className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
				style={{
					backgroundColor: isUser ? t.buttonPrimary : t.assistantAvatarBg,
					color: isUser ? t.buttonPrimaryForeground : t.textMuted,
				}}
			>
				{isUser ? (
					<UserIcon color="currentColor" />
				) : (
					<BotIcon color="currentColor" />
				)}
			</div>
			<div className="flex-1 space-y-2">
				<div className="font-medium text-sm" style={{ color: t.textPrimary }}>
					{isUser ? "You" : "Assistant"}
				</div>
				<div
					className="space-y-2 text-sm leading-relaxed"
					style={{ color: isUser ? t.textPrimary : t.textSecondary }}
				>
					{text}
				</div>
			</div>
		</div>
	);
};

const ToolCallDisplay: React.FC<{
	name: string;
	display: string;
	icon: string;
	progress: number;
}> = ({ name, display, icon, progress }) => {
	const t = useTheme();

	return (
		<div
			className="border rounded-md overflow-hidden text-sm mx-4 mb-2"
			style={{
				borderColor: t.borderSubtle,
				opacity: progress,
				transform: `scale(${interpolate(progress, [0, 1], [0.95, 1])})`,
			}}
		>
			<div
				className="w-full flex items-center gap-2 px-3 py-2 text-left"
				style={{ backgroundColor: t.mutedBg50 }}
			>
				<ToolIcon type={icon} color={t.textMuted} />
				<span
					className="flex-1 font-mono text-xs"
					style={{ color: t.textPrimary }}
				>
					{name}
				</span>
				{display && (
					<span
						className="text-xs font-normal truncate max-w-[120px]"
						style={{ color: t.textMuted }}
					>
						{display}
					</span>
				)}
				<CheckIcon color={t.statusSuccess} />
			</div>
		</div>
	);
};

const ChatInput: React.FC<{ progress: number }> = ({ progress }) => {
	const t = useTheme();

	return (
		<div className="w-full p-4" style={{ opacity: progress }}>
			<div
				className="flex flex-col gap-3 rounded-2xl border p-4"
				style={{ backgroundColor: t.cardBg, borderColor: t.inputBorderColor }}
			>
				<div className="min-h-[60px] text-base" style={{ color: t.textMuted }}>
					Type a message...
				</div>
				<div className="flex items-center justify-between gap-3">
					<button
						type="button"
						className="rounded-lg border inline-flex items-center gap-1.5 h-8 px-2.5 text-sm"
						style={{ backgroundColor: t.sceneBg, borderColor: t.borderSubtle }}
					>
						<div
							style={{
								width: 16,
								height: 16,
								backgroundColor: "#d97757",
								borderRadius: 4,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<span style={{ color: "white", fontSize: 10, fontWeight: 600 }}>
								A
							</span>
						</div>
						<span className="truncate" style={{ color: t.textPrimary }}>
							Claude Opus 4.6
						</span>
					</button>
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="w-8 h-8 rounded-lg flex items-center justify-center"
						>
							<PaperclipIcon color={t.textMuted} size={20} />
						</button>
						<button
							type="button"
							className="h-8 rounded-lg px-3 flex items-center gap-1.5 text-sm font-medium"
							style={{
								backgroundColor: t.buttonPrimary,
								color: t.buttonPrimaryForeground,
							}}
						>
							<SendIcon color="currentColor" size={16} />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

const DeployButton: React.FC<{
	variant: "outline" | "default";
	progress: number;
}> = ({ variant, progress }) => {
	const t = useTheme();
	const isOutline = variant === "outline";

	return (
		<button
			type="button"
			className="h-7 px-2.5 rounded-md text-sm font-medium inline-flex items-center gap-1.5"
			style={{
				backgroundColor: isOutline ? t.sceneBg : t.buttonPrimary,
				color: isOutline ? t.textPrimary : t.buttonPrimaryForeground,
				border: isOutline ? `1px solid ${t.borderSubtle}` : "none",
				opacity: progress,
			}}
		>
			{isOutline ? (
				<>
					<RocketIcon color={t.textMuted} />
					<span>Deploy</span>
				</>
			) : (
				<>
					<CheckIcon color={t.statusSuccess} size={14} />
					<span>Deployed</span>
				</>
			)}
		</button>
	);
};

export const Scene3Chat: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const t = useTheme();

	const sceneEntrance = spring({ frame, fps, config: { damping: 200 } });
	const showFiles = frame >= TAB_SWITCH_FRAME;
	const userMsgProgress = spring({
		frame: frame - 5,
		fps,
		config: { damping: 200 },
	});
	const assistantMsgProgress = spring({
		frame: frame - 20,
		fps,
		config: { damping: 200 },
	});
	const doneMsgProgress = spring({
		frame: frame - 85,
		fps,
		config: { damping: 200 },
	});
	const inputProgress = spring({
		frame: frame - 95,
		fps,
		config: { damping: 200 },
	});

	const previewLoadingOpacity = interpolate(
		frame,
		[0, 44, 45, 52],
		[1, 1, 1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);
	const previewDashboardOpacity = interpolate(frame, [44, 52], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	return (
		<AbsoluteFill
			style={{ backgroundColor: t.sceneBg, fontFamily, opacity: sceneEntrance }}
		>
			<nav
				className="w-full h-14 border-b flex items-center justify-between px-6"
				style={{ backgroundColor: t.navbarBg, borderColor: t.borderSubtle }}
			>
				<div className="flex items-center gap-2">
					<LogoIcon />
					<span
						className="font-semibold text-sm tracking-tight"
						style={{ color: t.textPrimary }}
					>
						doce<span style={{ color: t.textMuted }}>.dev</span>
					</span>
					<AlphaBadge bg={t.pillBg} textColor={t.textMuted} />
				</div>
				<div />
				<div className="flex items-center">
					<MoonIcon color={t.textMuted} />
				</div>
			</nav>

			<div
				className="flex flex-1"
				style={{ minHeight: 0, height: "calc(100% - 56px)" }}
			>
				<div
					className="flex flex-col overflow-hidden"
					style={{ width: "35%", backgroundColor: t.chatPanelBg }}
				>
					<div className="flex-1 overflow-hidden flex flex-col">
						<ChatMessage
							role="user"
							text="Develop a SaaS tool to manage my team's finances. Integrate Google auth, expense uploads, and monthly dashboards."
							progress={userMsgProgress}
						/>
						<ChatMessage
							role="assistant"
							text="I'll create a SaaS finance management tool with Google authentication, expense tracking, and monthly dashboards."
							progress={assistantMsgProgress}
						/>

						{/* Tool calls */}
						<div className="py-2">
							{TOOL_CALLS.map((tool, i) => {
								const toolProgress = spring({
									frame: frame - (40 + i * 8),
									fps,
									config: { damping: 200 },
								});
								return (
									<ToolCallDisplay
										key={tool.name + i}
										name={tool.name}
										display={tool.display}
										icon={tool.icon}
										progress={toolProgress}
									/>
								);
							})}
						</div>

						<ChatMessage
							role="assistant"
							text="Done! Your finance SaaS is ready with Google auth, expense uploads, and monthly dashboards."
							progress={doneMsgProgress}
						/>
					</div>

					<ChatInput progress={inputProgress} />
				</div>

				<div style={{ width: 1, backgroundColor: t.divider }} />

				<div
					className="flex flex-col flex-1 overflow-hidden"
					style={{ backgroundColor: t.rightPanelBg }}
				>
					{/* Toolbar with tabs and deploy button */}
					<div
						className="flex items-center justify-between gap-3 px-4 py-2 border-b"
						style={{
							backgroundColor: t.mutedBg50,
							borderColor: t.borderSubtle,
						}}
					>
						<div
							className="inline-flex rounded-lg p-1 gap-1"
							style={{ backgroundColor: t.tabsListBg }}
						>
							{["Preview", "Files", "Assets"].map((tab, i) => {
								const isActive =
									i === 0 ? !showFiles : i === 1 ? showFiles : false;
								return (
									<button
										key={tab}
										type="button"
										className="px-3 py-1 rounded-md text-sm font-medium"
										style={{
											backgroundColor: isActive
												? t.tabsTriggerActive
												: "transparent",
											color: isActive ? t.textPrimary : t.textMuted,
											boxShadow: isActive
												? "0 1px 2px rgba(0,0,0,0.1)"
												: "none",
										}}
									>
										{tab}
									</button>
								);
							})}
						</div>
						<DeployButton variant="outline" progress={1} />
					</div>

					{!showFiles ? (
						<div className="flex-1 flex items-center justify-center relative">
							<div
								className="absolute inset-0 flex flex-col items-center justify-center gap-4"
								style={{ opacity: previewLoadingOpacity }}
							>
								<div
									style={{
										width: 32,
										height: 32,
										border: `3px solid ${t.spinnerTrack}`,
										borderTopColor: t.spinnerArc,
										borderRadius: "50%",
										transform: `rotate(${(frame * 12) % 360}deg)`,
									}}
								/>
								<span className="text-sm" style={{ color: t.textMuted }}>
									Building your app...
								</span>
								<div
									style={{
										width: 200,
										height: 4,
										backgroundColor: t.borderSubtle,
										borderRadius: 2,
										overflow: "hidden",
									}}
								>
									<div
										style={{
											width: `${interpolate(frame, [5, 44], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
											height: "100%",
											backgroundColor: "#6366f1",
											borderRadius: 2,
										}}
									/>
								</div>
							</div>
							<div
								className="absolute inset-0 flex flex-col p-6 gap-5"
								style={{ opacity: previewDashboardOpacity }}
							>
								<h2
									className="text-xl font-bold"
									style={{ color: t.textPrimary }}
								>
									Finance Dashboard
								</h2>
								<div className="flex gap-4">
									{STAT_CARDS.map((card, i) => {
										const cardProgress = spring({
											frame: frame - (50 + i * 5),
											fps,
											config: { damping: 200 },
										});
										return (
											<div
												key={card.label}
												className="flex-1 rounded-xl p-4"
												style={{
													backgroundColor: t.pillBg,
													border: `1px solid ${t.pillBorder}`,
													opacity: cardProgress,
													transform: `translateY(${(1 - cardProgress) * 15}px)`,
												}}
											>
												<div
													className="text-xs mb-1"
													style={{ color: t.textMuted }}
												>
													{card.label}
												</div>
												<div
													className="text-2xl font-bold"
													style={{ color: t.textPrimary }}
												>
													{card.value}
												</div>
											</div>
										);
									})}
								</div>
								<div className="flex-1 flex items-end gap-4 pb-4 px-2">
									{BAR_HEIGHTS.map((targetHeight, i) => {
										const barProgress = interpolate(
											frame,
											[60 + i * 4, 78 + i * 4],
											[0, 1],
											{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
										);
										return (
											<div
												key={`bar-${i}`}
												className="flex-1 rounded-t-lg"
												style={{
													height: targetHeight * barProgress,
													background:
														"linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%)",
												}}
											/>
										);
									})}
								</div>
							</div>
						</div>
					) : (
						<div className="flex flex-1" style={{ minHeight: 0 }}>
							<FileTree width={320} startFrame={TAB_SWITCH_FRAME} />
							<div style={{ width: 1, backgroundColor: t.codeTabBorder }} />
							<CodeEditor width={9999} startFrame={TAB_SWITCH_FRAME} />
						</div>
					)}
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default Scene3Chat;
