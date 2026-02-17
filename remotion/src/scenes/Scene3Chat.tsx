import { loadFont } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { FileTree } from "./ide/FileTree";
import { CodeEditor } from "./ide/CodeEditor";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const ACTION_PILLS = [
  "Create app",
  "Add auth",
  "Create dashboard.tsx",
  "Add expense upload",
  "Create monthly overview",
];

const STAT_CARDS = [
  { label: "Total Expenses", value: "$12,450" },
  { label: "Monthly Budget", value: "$15,000" },
  { label: "Team Members", value: "8" },
];

const BAR_HEIGHTS = [140, 95, 170, 120, 155];

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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </div>
);

type AvatarProps = { letter: string; bg: string };
const Avatar: React.FC<AvatarProps> = ({ letter, bg }) => (
  <div
    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
    style={{ backgroundColor: bg }}
  >
    {letter}
  </div>
);

type ChatMessageProps = {
  role: "user" | "assistant";
  text: string;
  progress: number;
};
const ChatMessage: React.FC<ChatMessageProps> = ({ role, text, progress }) => {
  const isUser = role === "user";
  return (
    <div
      className="flex gap-3 items-start"
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 20}px)`,
      }}
    >
      <Avatar letter={isUser ? "U" : "A"} bg={isUser ? "#7c3aed" : "#1e2438"} />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: isUser ? "#d1d5db" : "#9ca3af" }}>
          {isUser ? "You" : "Assistant"}
        </span>
        <span className="text-sm leading-relaxed" style={{ color: isUser ? "#ffffff" : "#d1d5db" }}>
          {text}
        </span>
      </div>
    </div>
  );
};

const TAB_SWITCH_FRAME = 105;

export const Scene3Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneEntrance = spring({ frame, fps, config: { damping: 200 } });
  const showFiles = frame >= TAB_SWITCH_FRAME;

  const userMsgProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const assistantMsgProgress = spring({ frame: frame - 20, fps, config: { damping: 200 } });
  const doneMsgProgress = spring({ frame: frame - 85, fps, config: { damping: 200 } });

  const previewLoadingOpacity = interpolate(frame, [0, 44, 45, 52], [1, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const previewDashboardOpacity = interpolate(frame, [44, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a12", fontFamily, opacity: sceneEntrance }}>
      <Navbar />
      <div className="flex flex-1" style={{ minHeight: 0 }}>
        <div
          className="flex flex-col p-5 gap-4 overflow-hidden"
          style={{ width: "35%", backgroundColor: "#0f1115" }}
        >
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

          <div className="flex flex-wrap gap-2 mt-1">
            {ACTION_PILLS.map((pill, i) => {
              const pillProgress = spring({
                frame: frame - (40 + i * 8),
                fps,
                config: { damping: 200 },
              });
              return (
                <div
                  key={pill}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                  style={{
                    backgroundColor: "#1e2438",
                    border: "1px solid rgba(255,255,255,0.08)",
                    opacity: pillProgress,
                    transform: `scale(${interpolate(pillProgress, [0, 1], [0.7, 1])})`,
                  }}
                >
                  <span style={{ color: "#22c55e" }}>✓</span>
                  <span style={{ color: "#d1d5db" }}>{pill}</span>
                </div>
              );
            })}
          </div>

          <ChatMessage
            role="assistant"
            text="Done! Your finance SaaS is ready with Google auth, expense uploads, and monthly dashboards."
            progress={doneMsgProgress}
          />

          <div className="mt-auto pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="text-xs" style={{ color: "#6b7280" }}>Claude Opus 4.6</span>
          </div>
        </div>

        <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />

        <div
          className="flex flex-col flex-1 overflow-hidden"
          style={{ backgroundColor: "#111318" }}
        >
          <div className="flex gap-6 px-5 pt-3 pb-2 text-xs border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="pb-2" style={{
              color: showFiles ? "#6b7280" : "#ffffff",
              borderBottom: showFiles ? "none" : "2px solid #7c3aed",
            }}>Preview</span>
            <span className="pb-2" style={{
              color: showFiles ? "#ffffff" : "#6b7280",
              borderBottom: showFiles ? "2px solid #7c3aed" : "none",
            }}>Files</span>
            <span style={{ color: "#6b7280" }}>Assets</span>
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
                    border: "3px solid rgba(124,58,237,0.2)",
                    borderTopColor: "#7c3aed",
                    borderRadius: "50%",
                    transform: `rotate(${(frame * 12) % 360}deg)`,
                  }}
                />
                <span className="text-sm" style={{ color: "#6b7280" }}>
                  Building your app...
                </span>
                <div
                  style={{
                    width: 200,
                    height: 4,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${interpolate(frame, [5, 44], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
                      height: "100%",
                      backgroundColor: "#7c3aed",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>

              <div
                className="absolute inset-0 flex flex-col p-6 gap-5"
                style={{ opacity: previewDashboardOpacity }}
              >
                <h2 className="text-white text-xl font-bold">Finance Dashboard</h2>

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
                          backgroundColor: "#1e2438",
                          border: "1px solid rgba(255,255,255,0.08)",
                          opacity: cardProgress,
                          transform: `translateY(${(1 - cardProgress) * 15}px)`,
                        }}
                      >
                        <div className="text-xs mb-1" style={{ color: "#6b7280" }}>{card.label}</div>
                        <div className="text-white text-2xl font-bold">{card.value}</div>
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
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                    );
                    return (
                      <div
                        key={`bar-${i}`}
                        className="flex-1 rounded-t-lg"
                        style={{
                          height: targetHeight * barProgress,
                          background: "linear-gradient(180deg, #7c3aed 0%, #6366f1 100%)",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1" style={{ minHeight: 0 }}>
              <FileTree width={240} startFrame={TAB_SWITCH_FRAME} />
              <div style={{ width: 1, backgroundColor: "#21262d" }} />
              <CodeEditor width={9999} startFrame={TAB_SWITCH_FRAME} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
