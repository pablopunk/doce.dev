import { loadFont } from "@remotion/google-fonts/Inter";
import {
	AbsoluteFill,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { Navbar } from "../components/Navbar";
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
			<Navbar projectName="finance-saas" projectIcon="💸" />

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

				<div className="flex items-center gap-2">
				<button
					type="button"
					className="h-8 px-3 rounded-md text-sm font-medium inline-flex items-center gap-1.5"
					style={{
						backgroundColor: t.sceneBg,
						color: t.textPrimary,
						border: `1px solid ${t.borderSubtle}`,
					}}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" x2="12" y1="15" y2="3" />
					</svg>
					<span>Export</span>
				</button>
				{/* Deploy button with state transitions */}
				<button
					type="button"
					className="h-8 px-3 rounded-md text-sm font-medium inline-flex items-center gap-1.5"
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
