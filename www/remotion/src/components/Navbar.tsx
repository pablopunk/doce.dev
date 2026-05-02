import { useTheme } from "../theme";
import { Logo } from "./Logo";

interface NavbarProps {
	projectName?: string;
	projectIcon?: string;
}

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

/**
 * Mirrors src/components/navbar/Navbar.tsx:
 * - left: logo + "doce.dev" + alpha (secondary) + version (outline) badges
 * - center (when projectName): emoji icon in muted square + project name
 * - right: theme toggle (moon)
 */
export const Navbar: React.FC<NavbarProps> = ({ projectName, projectIcon }) => {
	const t = useTheme();

	return (
		<header
			className="w-full h-14 border-b sticky top-0 z-40"
			style={{ backgroundColor: t.navbarBg, borderColor: t.borderSubtle }}
		>
			<div className="relative flex h-14 items-center justify-between px-6">
				{/* Logo / Brand */}
				<div className="flex items-center gap-2">
					<Logo size={20} />
					<span
						className="font-semibold text-sm tracking-tight"
						style={{ color: t.textPrimary }}
					>
						doce<span style={{ color: t.textMuted }}>.dev</span>
					</span>
					{/* alpha pill — Badge variant="secondary" */}
					<span
						className="inline-flex items-center rounded-md text-xs font-medium px-2 py-0.5"
						style={{
							backgroundColor: t.pillBg,
							color: t.pillText,
							border: `1px solid ${t.borderSubtle}`,
						}}
					>
						alpha
					</span>
					{/* version pill — Badge variant="outline" */}
					<span
						className="inline-flex items-center rounded-md text-xs font-medium px-2 py-0.5"
						style={{
							color: t.textMuted,
							border: `1px solid ${t.borderSubtle}`,
							backgroundColor: "transparent",
						}}
					>
						v0.1.0
					</span>
				</div>

				{/* Centered project name (absolute) */}
				{projectName && (
					<div
						className="absolute left-1/2 top-1/2 flex items-center gap-2"
						style={{ transform: "translate(-50%, -50%)" }}
					>
						<span
							className="inline-flex items-center justify-center rounded-lg text-sm"
							style={{
								width: 28,
								height: 28,
								backgroundColor: t.pillBg,
							}}
						>
							{projectIcon ?? "✨"}
						</span>
						<span
							className="text-sm font-medium"
							style={{ color: t.textPrimary }}
						>
							{projectName}
						</span>
					</div>
				)}

				{/* Right side: theme toggle (moon icon stub) */}
				<div className="flex items-center gap-2">
					<MoonIcon color={t.textMuted} />
				</div>
			</div>
		</header>
	);
};
