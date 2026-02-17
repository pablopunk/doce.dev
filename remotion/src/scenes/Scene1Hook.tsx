import { loadFont } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const subtitleProgress = spring({
    frame: frame - 12,
    fps,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center gap-4 bg-[#0a0a12]">
      <div
        className="text-white text-center"
        style={{
          fontFamily,
          fontSize: 64,
          fontWeight: 700,
          opacity: titleProgress,
          transform: `scale(${0.8 + titleProgress * 0.2})`,
        }}
      >
        Self-hosted AI builder.
      </div>
      <div
        className="text-center"
        style={{
          fontFamily,
          fontSize: 28,
          fontWeight: 400,
          color: "#9ca3af",
          opacity: subtitleProgress,
          transform: `translateY(${(1 - subtitleProgress) * 15}px)`,
        }}
      >
        From idea to production, on your terms.
      </div>
    </AbsoluteFill>
  );
};
