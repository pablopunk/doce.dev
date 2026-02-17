import { loadFont } from "@remotion/google-fonts/Inter";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../../theme";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

type FileTreeProps = { width: number; startFrame?: number };
type FileItem = { name: string; type: "folder" | "file" | "folder-collapsed"; level: number; highlighted?: boolean };

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

const getIcon = (type: FileItem["type"]) => {
	switch (type) {
		case "folder": return "▼";
		case "folder-collapsed": return "▸";
		case "file": return "";
	}
};

export const FileTree: React.FC<FileTreeProps> = ({ width, startFrame = 0 }) => {
	const globalFrame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const frame = Math.max(0, globalFrame - startFrame);
	const t = useTheme();

	const highlightProgress = spring({ frame: frame - 15, fps, config: { damping: 100 } });
	const highlightOpacity = interpolate(highlightProgress, [0, 0.5, 1], [0.3, 0.6, 0.3]);
	const highlightRgb = t.mode === "dark" ? "30, 58, 95" : "219, 234, 254";

	return (
		<div className="flex flex-col h-full" style={{ width, backgroundColor: t.rightPanelBg, fontFamily }}>
			<div className="flex-1 py-2">
				{fileItems.map((item, index) => {
					const itemProgress = spring({ frame: frame - index * 3, fps, config: { damping: 200 } });
					const itemX = interpolate(itemProgress, [0, 1], [-20, 0]);
					const isHighlighted = item.highlighted && frame >= 15;
					const bgColor = isHighlighted ? `rgba(${highlightRgb}, ${highlightOpacity})` : "transparent";

					return (
						<div key={`${item.name}-${index}`} className="flex items-center gap-1 px-3 py-1 text-sm"
							style={{ paddingLeft: `${12 + item.level * 16}px`, color: item.highlighted ? t.fileHighlightText : t.fileText, backgroundColor: bgColor, transform: `translateX(${itemX}px)`, opacity: itemProgress }}>
							{item.type !== "file" && <span style={{ color: t.fileIcon, fontSize: 10 }}>{getIcon(item.type)}</span>}
							<span>{item.name}</span>
						</div>
					);
				})}
			</div>
		</div>
	);
};
