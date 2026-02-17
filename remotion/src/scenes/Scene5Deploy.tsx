import { loadFont } from "@remotion/google-fonts/Inter";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

export const Scene5Deploy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entranceOpacity = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const zoomScale = interpolate(frame, [0, 20], [1, 2.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const isButtonPressed = frame >= 25 && frame < 50;
  const isDeployed = frame >= 50;

  const buttonScale = isButtonPressed ? 0.95 : 1;
  const buttonBg = isButtonPressed ? "#6d28d9" : "#7c3aed";

  const spinnerRotation = (frame * 12) % 360;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a12",
        fontFamily,
        opacity: entranceOpacity,
        transform: `scale(${zoomScale})`,
        transformOrigin: "top right",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "white", fontSize: 14, fontWeight: 700 }}>
                d
              </span>
            </div>
            <span
              style={{ color: "white", fontSize: 18, fontWeight: 600 }}
            >
              doce.dev
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              fontWeight: 400,
              cursor: "pointer",
            }}
          >
            Projects
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              fontWeight: 400,
              cursor: "pointer",
            }}
          >
            Queue
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              fontWeight: 400,
              cursor: "pointer",
            }}
          >
            Settings
          </span>
        </div>

        <button
          style={{
            backgroundColor: buttonBg,
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transform: `scale(${buttonScale})`,
            transition: "none",
          }}
        >
          {isDeployed ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M3 8L6.5 11.5L13 5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Deployed!</span>
            </>
          ) : isButtonPressed ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  transform: `rotate(${spinnerRotation}deg)`,
                }}
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />
                <path
                  d="M8 2A6 6 0 0 1 14 8"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>Deploying...</span>
            </>
          ) : (
            <span>Deploy</span>
          )}
        </button>
      </div>

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
            backgroundColor: "rgba(255,255,255,0.03)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            padding: 16,
          }}
        >
          <div
            style={{
              height: 8,
              width: 120,
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 4,
              marginBottom: 12,
            }}
          />
          <div
            style={{
              height: 8,
              width: 100,
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 4,
              marginBottom: 12,
            }}
          />
          <div
            style={{
              height: 8,
              width: 140,
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 4,
              marginBottom: 12,
            }}
          />
          <div
            style={{
              height: 8,
              width: 80,
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 4,
            }}
          />
        </div>

        <div style={{ flex: 1, padding: 24 }}>
          <div
            style={{
              height: 200,
              backgroundColor: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              marginBottom: 16,
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 16,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 120,
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: 8,
              }}
            />
            <div
              style={{
                flex: 1,
                height: 120,
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: 8,
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
