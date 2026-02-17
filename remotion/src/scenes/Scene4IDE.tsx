import { loadFont } from "@remotion/google-fonts/Inter";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ChatPanel } from "./ide/ChatPanel";
import { FileTree } from "./ide/FileTree";
import { CodeEditor } from "./ide/CodeEditor";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

const Navbar: React.FC = () => (
  <div
    className="w-full h-14 flex items-center justify-between px-6 border-b"
    style={{
      backgroundColor: "#0d0d18",
      borderColor: "rgba(255,255,255,0.06)",
      fontFamily,
    }}
  >
    <div className="flex items-center gap-3">
      <span className="text-white font-semibold text-lg">doce.dev</span>
    </div>
    <div className="flex items-center gap-8">
      <span className="text-sm" style={{ color: "#6b7280" }}>Projects</span>
      <span className="text-sm" style={{ color: "#6b7280" }}>Queue</span>
      <span className="text-sm" style={{ color: "#6b7280" }}>Settings</span>
    </div>
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
        style={{ backgroundColor: "#1e2438", color: "#e6edf3" }}
      >
        <span>Deploy</span>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </div>
  </div>
);

export const Scene4IDE: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneEntrance = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a12",
        fontFamily,
        opacity: sceneEntrance,
        transform: `scale(${0.97 + sceneEntrance * 0.03})`,
      }}
    >
      <Navbar />
      <div className="flex flex-1" style={{ minHeight: 0 }}>
        <ChatPanel width={480} />
        <div style={{ width: 1, backgroundColor: "#21262d" }} />
        <FileTree width={288} />
        <div style={{ width: 1, backgroundColor: "#21262d" }} />
        <CodeEditor width={1150} />
      </div>
    </AbsoluteFill>
  );
};
