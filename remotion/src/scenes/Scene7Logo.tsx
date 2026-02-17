import { loadFont } from "@remotion/google-fonts/Inter";
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin"] });

export const Scene7Logo: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const t = useTheme();

	const logoProgress = spring({ frame, fps, config: { damping: 200 } });
	const titleProgress = spring({ frame: frame - 10, fps, config: { damping: 200 } });
	const subtitleProgress = spring({ frame: frame - 20, fps, config: { damping: 200 } });
	const linkProgress = spring({ frame: frame - 30, fps, config: { damping: 200 } });

	return (
		<AbsoluteFill className="flex flex-col items-center justify-center" style={{ backgroundColor: t.sceneBg }}>
			<Img src={staticFile("doce-logo.png")} alt="doce.dev logo" className="h-[120px] w-auto object-contain"
				style={{ opacity: logoProgress, transform: `translateY(${(1 - logoProgress) * -20}px)` }} />
			<div className="mt-6" style={{ fontFamily, fontSize: 48, fontWeight: 700, color: t.textPrimary, opacity: titleProgress, transform: `translateY(${(1 - titleProgress) * 40}px)` }}>
				doce.dev
			</div>
			<div className="mt-2" style={{ fontFamily, fontSize: 24, fontWeight: 400, color: t.textMuted, opacity: subtitleProgress, transform: `translateY(${(1 - subtitleProgress) * 40}px)` }}>
				Self-hosted AI website builder
			</div>
			<div className="mt-4" style={{ fontFamily, fontSize: 20, fontWeight: 400, color: "#8b5cf6", opacity: linkProgress, transform: `translateY(${(1 - linkProgress) * 40}px)` }}>
				github.com/pablopunk/doce.dev
			</div>
		</AbsoluteFill>
	);
};
