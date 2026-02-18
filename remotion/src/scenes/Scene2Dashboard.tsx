import { loadFont } from "@remotion/google-fonts/Inter";
import {
	AbsoluteFill,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { useTheme } from "../theme";

const { fontFamily } = loadFont("normal", {
	weights: ["400", "500", "600", "700"],
	subsets: ["latin"],
});

const PLACEHOLDER_TEXT = "It all starts here...";
const TYPEWRITER_TEXT =
	"Develop a SaaS tool to manage my team's finances. Integrate Google authentication, enable expense uploads, and create monthly overview dashboards.";

const MODELS = [
	{ name: "Claude Sonnet 4.5", provider: "Anthropic" },
	{ name: "Claude Opus 4.6", provider: "Anthropic" },
	{ name: "GPT-4.1", provider: "OpenAI" },
	{ name: "Gemini 2.5 Pro", provider: "Google" },
];

const TYPING_START = 12;
const TYPING_END = 55;
const ZOOM_MODEL_START = 58;
const DROPDOWN_OPEN = 72;
const MODEL_SWITCH = 90;
const DROPDOWN_CLOSE = 100;
const ZOOM_BUTTON_START = 105;
const BUTTON_PRESS = 120;

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

const AnthropicLogo: React.FC<{ size?: number }> = ({ size = 16 }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
		<rect width="24" height="24" rx="4" fill="#d97757" />
		<text
			x="12"
			y="17"
			textAnchor="middle"
			fill="white"
			fontSize="14"
			fontWeight="600"
		>
			A
		</text>
	</svg>
);

const OpenAILogo: React.FC<{ size?: number }> = ({ size = 16 }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
		<rect width="24" height="24" rx="4" fill="#10a37f" />
		<text
			x="12"
			y="17"
			textAnchor="middle"
			fill="white"
			fontSize="14"
			fontWeight="600"
		>
			G
		</text>
	</svg>
);

const ChevronsUpDownIcon: React.FC<{ color: string; size?: number }> = ({
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
		opacity="0.5"
	>
		<path d="m7 15 5 5 5-5" />
		<path d="m7 9 5-5 5 5" />
	</svg>
);

const SparklesIcon: React.FC<{ color: string; size?: number }> = ({
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
		<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
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

export const Scene2Dashboard: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const t = useTheme();

	const entranceProgress = spring({
		frame,
		fps,
		config: { damping: 200 },
		durationInFrames: 10,
	});

	const dashboardOpacity = entranceProgress;
	const dashboardScale = interpolate(entranceProgress, [0, 1], [0.95, 1]);

	const isTyping = frame >= TYPING_START && frame <= TYPING_END;
	const visibleChars = Math.floor(
		interpolate(
			frame,
			[TYPING_START, TYPING_END],
			[0, TYPEWRITER_TEXT.length],
			{
				extrapolateRight: "clamp",
				extrapolateLeft: "clamp",
			},
		),
	);
	const displayedText = TYPEWRITER_TEXT.slice(0, visibleChars);
	const cursorBlink = Math.floor(frame / 4) % 2 === 0 ? 1 : 0;

	const zoomToModelProgress = spring({
		frame: frame - ZOOM_MODEL_START,
		fps,
		config: { damping: 18, stiffness: 80, mass: 0.8 },
	});

	const panToButtonProgress = spring({
		frame: frame - ZOOM_BUTTON_START,
		fps,
		config: { damping: 18, stiffness: 80, mass: 0.8 },
	});

	const zoomScale = interpolate(zoomToModelProgress, [0, 1], [1, 2.8]);
	const panX =
		interpolate(zoomToModelProgress, [0, 1], [0, 12]) +
		interpolate(panToButtonProgress, [0, 1], [0, -24]);
	const panY = interpolate(zoomToModelProgress, [0, 1], [0, -10]);

	const dropdownVisible = frame >= DROPDOWN_OPEN && frame < DROPDOWN_CLOSE;
	const dropdownProgress = spring({
		frame: frame - DROPDOWN_OPEN,
		fps,
		config: { damping: 200 },
		durationInFrames: 8,
	});
	const dropdownOpacity = dropdownVisible ? dropdownProgress : 0;
	const dropdownTranslateY = interpolate(dropdownProgress, [0, 1], [-8, 0]);

	const opusSelected = frame >= MODEL_SWITCH;
	const currentModelLabel = opusSelected
		? "Claude Opus 4.6"
		: "Claude Sonnet 4.5";

	const highlightOpusProgress = spring({
		frame: frame - (MODEL_SWITCH - 4),
		fps,
		config: { damping: 200 },
		durationInFrames: 6,
	});

	const buttonPressed = frame >= BUTTON_PRESS;
	const buttonPressProgress = spring({
		frame: frame - BUTTON_PRESS,
		fps,
		config: { damping: 15, stiffness: 300 },
		durationInFrames: 10,
	});
	const buttonScale = buttonPressed
		? interpolate(buttonPressProgress, [0, 0.5, 1], [1, 0.92, 0.95])
		: 1;

	return (
		<AbsoluteFill style={{ backgroundColor: t.sceneBg, fontFamily }}>
			<div
				style={{
					opacity: dashboardOpacity,
					transform: `scale(${dashboardScale * zoomScale}) translate(${panX}%, ${panY}%)`,
					transformOrigin: "50% 70%",
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
				}}
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

				<div className="flex-1 flex flex-col items-center justify-center px-8">
					<h1
						className="text-[32px] sm:text-[36px] lg:text-[40px] font-bold mb-8 text-center"
						style={{ color: t.textPrimary }}
					>
						What are you building today?
					</h1>

					<div
						className="w-full max-w-2xl rounded-2xl border flex flex-col gap-3"
						style={{
							backgroundColor: t.cardBg,
							borderColor: t.inputBorderColor,
							padding: "16px",
						}}
					>
						<div
							className="min-h-[80px] text-base leading-relaxed whitespace-pre-wrap"
							style={{ color: t.textPrimary }}
						>
							{displayedText ||
								(!isTyping && frame < TYPING_START ? (
									<span style={{ color: t.textMuted }}>{PLACEHOLDER_TEXT}</span>
								) : null)}
							{isTyping && <span style={{ opacity: cursorBlink }}>|</span>}
						</div>

						<div className="flex items-center justify-between gap-2 min-w-0 pt-2">
							<div className="relative">
								<button
									type="button"
									className="rounded-lg border inline-flex items-center gap-1.5 h-8 px-2.5 text-sm"
									style={{
										backgroundColor: t.sceneBg,
										borderColor: t.borderSubtle,
									}}
								>
									<AnthropicLogo size={16} />
									<span
										className="truncate"
										style={{ color: t.textPrimary, maxWidth: "140px" }}
									>
										{currentModelLabel}
									</span>
									<ChevronsUpDownIcon color={t.textMuted} size={14} />
								</button>

								{dropdownVisible && (
									<div
										className="absolute top-full left-0 mt-2 w-64 rounded-xl border py-2 overflow-hidden shadow-lg"
										style={{
											backgroundColor: t.cardBg,
											borderColor: t.borderSubtle,
											opacity: dropdownOpacity,
											transform: `translateY(${dropdownTranslateY}px)`,
										}}
									>
										<div className="px-3 pb-2">
											<div
												className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
												style={{ backgroundColor: t.sceneBg }}
											>
												<svg
													width="14"
													height="14"
													viewBox="0 0 24 24"
													fill="none"
													stroke={t.textMuted}
													strokeWidth="2"
												>
													<circle cx="11" cy="11" r="8" />
													<path d="m21 21-4.3-4.3" />
												</svg>
												<span style={{ color: t.textMuted }}>
													Search models...
												</span>
											</div>
										</div>
										<div className="px-3 py-1.5">
											<span
												className="text-xs font-medium"
												style={{ color: t.textMuted }}
											>
												Anthropic
											</span>
										</div>
										{MODELS.map((model) => {
											const isCurrentlySelected =
												(model.name === "Claude Sonnet 4.5" && !opusSelected) ||
												(model.name === "Claude Opus 4.6" && opusSelected);
											const isOpusHighlighting =
												model.name === "Claude Opus 4.6" &&
												frame >= MODEL_SWITCH - 4;
											const bgHighlight = isOpusHighlighting
												? `rgba(99, 102, 241, ${highlightOpusProgress * 0.15})`
												: "transparent";

											return (
												<div
													key={model.name}
													className="flex items-center justify-between px-3 py-2 text-sm mx-1 rounded-md"
													style={{ backgroundColor: bgHighlight }}
												>
													<div className="flex items-center gap-2">
														{model.provider === "Anthropic" && (
															<AnthropicLogo size={16} />
														)}
														{model.provider === "OpenAI" && (
															<OpenAILogo size={16} />
														)}
														<span
															style={{
																color: isCurrentlySelected
																	? t.textPrimary
																	: t.textMuted,
															}}
														>
															{model.name}
														</span>
													</div>
													{isCurrentlySelected && (
														<svg
															width="16"
															height="16"
															viewBox="0 0 24 24"
															fill="none"
															stroke={t.mode === "dark" ? "#6366f1" : "#4f46e5"}
															strokeWidth="3"
															strokeLinecap="round"
															strokeLinejoin="round"
														>
															<polyline points="20 6 9 17 4 12" />
														</svg>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>

							<div className="flex items-center gap-1.5">
								<button
									type="button"
									className="w-8 h-8 rounded-lg flex items-center justify-center"
									style={{ backgroundColor: "transparent" }}
								>
									<PaperclipIcon color={t.textMuted} size={20} />
								</button>

								<button
									type="button"
									className="h-8 rounded-lg px-2.5 flex items-center gap-1.5 text-sm font-medium"
									style={{
										backgroundColor: t.buttonPrimary,
										color: t.buttonPrimaryForeground,
										transform: `scale(${buttonScale})`,
									}}
								>
									<SparklesIcon color={t.chart1} size={18} />
									<span
										style={{
											background: `linear-gradient(90deg, ${t.chart1}, ${t.chart4}, ${t.chart5})`,
											WebkitBackgroundClip: "text",
											WebkitTextFillColor: "transparent",
											backgroundClip: "text",
											fontWeight: 600,
										}}
									>
										Create
									</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default Scene2Dashboard;
