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
	weights: ["400", "600", "700"],
	subsets: ["latin"],
});

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

const CheckCircleIcon: React.FC<{ color: string; size?: number }> = ({
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
		<circle cx="12" cy="12" r="10" />
		<path d="m9 12 2 2 4-4" />
	</svg>
);

const LoaderIcon: React.FC<{
	color: string;
	rotation: number;
	size?: number;
}> = ({ color, rotation, size = 14 }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		style={{ transform: `rotate(${rotation}deg)` }}
	>
		<path d="M21 12a9 9 0 1 1-6.219-8.56" />
	</svg>
);

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

export const Scene5Deploy: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const t = useTheme();

	const entranceOpacity = spring({
		frame,
		fps,
		config: { damping: 20, stiffness: 100 },
	});
	const zoomScale = interpolate(frame, [0, 20], [1, 2.5], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	// State transitions
	const isButtonPressed = frame >= 25 && frame < 50;
	const isDeployed = frame >= 50;
	const buttonScale = isButtonPressed ? 0.95 : 1;
	const spinnerRotation = (frame * 12) % 360;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: t.sceneBg,
				fontFamily,
				opacity: entranceOpacity,
				transform: `scale(${zoomScale})`,
				transformOrigin: "top right",
			}}
		>
			{/* Navbar */}
			<div
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
			</div>

			{/* Toolbar with tabs and deploy button */}
			<div
				className="flex items-center justify-between gap-3 px-4 py-2 border-b"
				style={{ backgroundColor: t.mutedBg50, borderColor: t.borderSubtle }}
			>
				<div
					className="inline-flex rounded-lg p-1 gap-1"
					style={{ backgroundColor: t.tabsListBg }}
				>
					{["Preview", "Files", "Assets"].map((tab) => (
						<button
							key={tab}
							type="button"
							className="px-3 py-1 rounded-md text-sm font-medium"
							style={{
								backgroundColor:
									tab === "Preview" ? t.tabsTriggerActive : "transparent",
								color: tab === "Preview" ? t.textPrimary : t.textMuted,
								boxShadow:
									tab === "Preview" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
							}}
						>
							{tab}
						</button>
					))}
				</div>

				{/* Deploy button with state transitions */}
				<button
					type="button"
					className="h-7 px-2.5 rounded-md text-sm font-medium inline-flex items-center gap-1.5"
					style={{
						backgroundColor: isDeployed ? t.buttonPrimary : t.sceneBg,
						color: isDeployed ? t.buttonPrimaryForeground : t.textPrimary,
						border: isDeployed ? "none" : `1px solid ${t.borderSubtle}`,
						transform: `scale(${buttonScale})`,
					}}
				>
					{isDeployed ? (
						<>
							<CheckCircleIcon color={t.statusSuccess} size={14} />
							<span>Deployed</span>
						</>
					) : isButtonPressed ? (
						<>
							<LoaderIcon
								color={t.textMuted}
								rotation={spinnerRotation}
								size={14}
							/>
							<span>Building...</span>
						</>
					) : (
						<>
							<RocketIcon color={t.textMuted} size={14} />
							<span>Deploy</span>
						</>
					)}
				</button>
			</div>

			{/* Blurred background content */}
			<div
				style={{
					flex: 1,
					display: "flex",
					filter: "blur(2px)",
					opacity: 0.4,
					pointerEvents: "none",
				}}
			>
				<div
					style={{
						width: 240,
						backgroundColor: t.blurredBg,
						borderRight: `1px solid ${t.blurredBorder}`,
						padding: 16,
					}}
				>
					<div
						style={{
							height: 8,
							width: 120,
							backgroundColor: t.blurredPlaceholder,
							borderRadius: 4,
							marginBottom: 12,
						}}
					/>
					<div
						style={{
							height: 8,
							width: 100,
							backgroundColor: t.blurredPlaceholder,
							borderRadius: 4,
							marginBottom: 12,
						}}
					/>
					<div
						style={{
							height: 8,
							width: 140,
							backgroundColor: t.blurredPlaceholder,
							borderRadius: 4,
							marginBottom: 12,
						}}
					/>
					<div
						style={{
							height: 8,
							width: 80,
							backgroundColor: t.blurredPlaceholder,
							borderRadius: 4,
						}}
					/>
				</div>
				<div style={{ flex: 1, padding: 24 }}>
					<div
						style={{
							height: 200,
							backgroundColor: t.blurredBg,
							borderRadius: 8,
							marginBottom: 16,
						}}
					/>
					<div style={{ display: "flex", gap: 16 }}>
						<div
							style={{
								flex: 1,
								height: 120,
								backgroundColor: t.blurredBg,
								borderRadius: 8,
							}}
						/>
						<div
							style={{
								flex: 1,
								height: 120,
								backgroundColor: t.blurredBg,
								borderRadius: 8,
							}}
						/>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default Scene5Deploy;
