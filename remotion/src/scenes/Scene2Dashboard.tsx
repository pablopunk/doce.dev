import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

const TYPEWRITER_TEXT =
  "Develop a SaaS tool to manage my team's finances. Integrate Google authentication, enable expense uploads, and create monthly overview dashboards.";

const MODELS = [
  { name: "GPT-5.2 Codex" },
  { name: "Claude Sonnet 4.5" },
  { name: "Claude Opus 4.6" },
  { name: "Gemini 3 Flash" },
];

const TYPING_END = 55;
const ZOOM_MODEL_START = 58;
const ZOOM_MODEL_END = 68;
const DROPDOWN_OPEN = 72;
const MODEL_SWITCH = 90;
const DROPDOWN_CLOSE = 100;
const ZOOM_BUTTON_START = 105;
const ZOOM_BUTTON_END = 115;
const BUTTON_PRESS = 120;

export const Scene2Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entranceProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 10,
  });

  const dashboardOpacity = entranceProgress;
  const dashboardScale = interpolate(entranceProgress, [0, 1], [0.95, 1]);

  const visibleChars = Math.floor(
    interpolate(frame, [12, TYPING_END], [0, TYPEWRITER_TEXT.length], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    })
  );
  const displayedText = TYPEWRITER_TEXT.slice(0, visibleChars);
  const isTyping = frame >= 12 && frame <= TYPING_END;
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

  const panX = interpolate(zoomToModelProgress, [0, 1], [0, 12])
    + interpolate(panToButtonProgress, [0, 1], [0, -24]);

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
  const currentModelLabel = opusSelected ? "Claude Opus 4.6" : "Claude Sonnet 4.5";

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
  const buttonBg = buttonPressed
    ? "linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)"
    : "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a12",
        fontFamily,
      }}
    >
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
        <nav className="w-full h-14 bg-[#0d0d18] border-b border-white/[0.06] flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold text-lg">doce.dev</span>
          </div>

          <div className="flex items-center gap-8">
            <span className="text-[#6b7280] text-sm">Projects</span>
            <span className="text-[#6b7280] text-sm">Queue</span>
            <span className="text-[#6b7280] text-sm">Settings</span>
          </div>

          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6b7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Theme</title>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <h1
            className="text-white text-[40px] font-bold mb-10"
            style={{ fontFamily }}
          >
            What are you building today?
          </h1>

          <div
            className="w-full max-w-3xl rounded-2xl border p-6 flex flex-col gap-4"
            style={{
              backgroundColor: "#161b2e",
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <div className="min-h-[120px] text-white text-base leading-relaxed whitespace-pre-wrap">
              {displayedText}
              {isTyping && (
                <span style={{ opacity: cursorBlink }}>|</span>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
              <div className="relative">
                <div className="flex items-center gap-2 text-[#6b7280] text-sm">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <title>Model</title>
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span>{currentModelLabel}</span>
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
                    <title>Chevron</title>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {dropdownVisible && (
                  <div
                    className="absolute top-full left-0 mt-2 w-56 rounded-xl border py-1 overflow-hidden"
                    style={{
                      backgroundColor: "#161b2e",
                      borderColor: "rgba(255, 255, 255, 0.08)",
                      opacity: dropdownOpacity,
                      transform: `translateY(${dropdownTranslateY}px)`,
                    }}
                  >
                    {MODELS.map((model) => {
                      const isCurrentlySelected =
                        (model.name === "Claude Sonnet 4.5" && !opusSelected) ||
                        (model.name === "Claude Opus 4.6" && opusSelected);
                      const isOpusHighlighting =
                        model.name === "Claude Opus 4.6" && frame >= MODEL_SWITCH - 4;
                      const bgHighlight = isOpusHighlighting
                        ? `rgba(124, 58, 237, ${highlightOpusProgress * 0.15})`
                        : "transparent";

                      return (
                        <div
                          key={model.name}
                          className="flex items-center justify-between px-4 py-2.5 text-sm"
                          style={{ backgroundColor: bgHighlight }}
                        >
                          <span style={{ color: isCurrentlySelected ? "#ffffff" : "#6b7280" }}>
                            {model.name}
                          </span>
                          {isCurrentlySelected && (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#8b5cf6"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <title>Check</title>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium text-sm"
                style={{
                  background: buttonBg,
                  transform: `scale(${buttonScale})`,
                }}
              >
                <span>Create</span>
                <span>✨</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default Scene2Dashboard;
