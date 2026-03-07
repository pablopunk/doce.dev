import { loadFont } from "@remotion/google-fonts/Inter";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../../theme";

const { fontFamily } = loadFont("normal", {
	weights: ["400", "500", "600"],
	subsets: ["latin"],
});

type FileTreeProps = { width: number; startFrame?: number };
type FileItem = {
	name: string;
	type: "folder" | "file" | "folder-collapsed";
	level: number;
	highlighted?: boolean;
};

const fileItems: FileItem[] = [
	{ name: "components", type: "folder", level: 0 },
	{ name: "ui", type: "folder-collapsed", level: 1 },
	{ name: "layouts", type: "folder", level: 0 },
	{ name: "Layout.astro", type: "file", level: 1, highlighted: true },
	{ name: "lib", type: "folder", level: 0 },
	{ name: "utils.ts", type: "file", level: 1 },
	{ name: "pages", type: "folder-collapsed", level: 0 },
	{ name: "styles", type: "folder-collapsed", level: 0 },
];

const ChevronRightIcon: React.FC<{
	color: string;
	size?: number;
	rotated?: boolean;
}> = ({ color, size = 12, rotated }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		style={{
			transform: rotated ? "rotate(90deg)" : "none",
			transition: "transform 0.2s",
		}}
	>
		<path d="m9 18 6-6-6-6" />
	</svg>
);

const FileIcon: React.FC<{ color: string; size?: number }> = ({
	color,
	size = 12,
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
	</svg>
);

export const FileTree: React.FC<FileTreeProps> = ({
	width,
	startFrame = 0,
}) => {
	const globalFrame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const frame = Math.max(0, globalFrame - startFrame);
	const t = useTheme();

	const highlightProgress = spring({
		frame: frame - 15,
		fps,
		config: { damping: 100 },
	});
	const highlightOpacity = interpolate(
		highlightProgress,
		[0, 0.5, 1],
		[0.3, 0.6, 0.3],
	);
	const highlightRgb = t.mode === "dark" ? "42, 46, 62" : "243, 244, 246";

	return (
		<div
			className="flex flex-col h-full overflow-y-auto p-2"
			style={{
				width,
				minWidth: width,
				maxWidth: width,
				flexShrink: 0,
				backgroundColor: t.mode === "dark" ? "#1a1d2e" : "#f9fafb",
				fontFamily,
				borderRight: `1px solid ${t.borderSubtle}`,
			}}
		>
			{fileItems.map((item, index) => {
				const itemProgress = spring({
					frame: frame - index * 3,
					fps,
					config: { damping: 200 },
				});
				const itemX = interpolate(itemProgress, [0, 1], [-20, 0]);
				const isHighlighted = item.highlighted && frame >= 15;
				const isDirectory = item.type !== "file";
				const isExpanded = item.type === "folder";

				return (
					<button
						key={`${item.name}-${index}`}
						type="button"
						className="flex items-center gap-1 rounded-md px-2 py-1 text-sm w-full text-left"
						style={{
							paddingLeft: `${item.level * 12 + 8}px`,
							color: item.highlighted ? t.textPrimary : t.textSecondary,
							backgroundColor: isHighlighted
								? `rgba(${highlightRgb}, ${highlightOpacity})`
								: "transparent",
							fontWeight: item.highlighted ? 500 : 400,
							transform: `translateX(${itemX}px)`,
							opacity: itemProgress,
						}}
					>
						{isDirectory ? (
							<ChevronRightIcon
								color={t.fileIcon}
								size={12}
								rotated={isExpanded}
							/>
						) : (
							<FileIcon color={t.fileIcon} size={12} />
						)}
						<span className="truncate">{item.name}</span>
					</button>
				);
			})}
		</div>
	);
};

export default FileTree;
