import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

export const Scene6iPhone: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneEntryProgress = spring({
    frame,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
      mass: 0.8,
    },
  });

  const phoneY = interpolate(phoneEntryProgress, [0, 1], [400, 0]);
  const phoneOpacity = interpolate(phoneEntryProgress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });

  const contentFadeProgress = spring({
    frame: frame - 15,
    fps,
    config: {
      damping: 20,
      stiffness: 80,
    },
  });

  const contentOpacity = interpolate(contentFadeProgress, [0, 1], [0, 1]);

  const titleDelay = 0;
  const cardsDelay = 5;
  const chartDelay = 10;

  const titleProgress = spring({
    frame: frame - 15 - titleDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const cardsProgress = spring({
    frame: frame - 15 - cardsDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const chartProgress = spring({
    frame: frame - 15 - chartDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [10, 0]);

  const cardsOpacity = interpolate(cardsProgress, [0, 1], [0, 1]);
  const cardsY = interpolate(cardsProgress, [0, 1], [10, 0]);

  const chartOpacity = interpolate(chartProgress, [0, 1], [0, 1]);
  const chartY = interpolate(chartProgress, [0, 1], [10, 0]);

  const floatY = Math.sin(frame * 0.15) * 3;

  const liveBadgeOpacity = interpolate(frame, [40, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a12",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
      }}
    >
      <div
        style={{
          width: 320,
          height: 640,
          backgroundColor: "#1c1c1e",
          borderRadius: 44,
          border: "2px solid rgba(255,255,255,0.15)",
          position: "relative",
          transform: `translateY(${phoneY + floatY}px)`,
          opacity: phoneOpacity,
          boxShadow: "0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 28,
            backgroundColor: "#000",
            borderRadius: 14,
            zIndex: 10,
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            bottom: 16,
            backgroundColor: "#0f1115",
            borderRadius: 36,
            overflow: "hidden",
            opacity: contentOpacity,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 50,
              right: 16,
              display: "flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "rgba(0,0,0,0.6)",
              padding: "4px 10px",
              borderRadius: 12,
              opacity: liveBadgeOpacity,
              zIndex: 10,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                backgroundColor: "#22c55e",
                borderRadius: "50%",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#fff",
                letterSpacing: "0.5px",
              }}
            >
              LIVE
            </span>
          </div>

          <div
            style={{
              padding: "20px 16px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
              }}
            >
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fff",
                  margin: 0,
                  marginBottom: 2,
                }}
              >
                Finance Dashboard
              </h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                Overview · Feb 2026
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                opacity: cardsOpacity,
                transform: `translateY(${cardsY}px)`,
              }}
            >
              {[
                { label: "Expenses", value: "$12,450", color: "rgba(124,58,237,0.15)", border: "rgba(124,58,237,0.3)" },
                { label: "Budget", value: "$15,000", color: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" },
                { label: "Members", value: "8", color: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)" },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    flex: 1,
                    backgroundColor: card.color,
                    borderRadius: 10,
                    padding: "8px 10px",
                    border: `1px solid ${card.border}`,
                  }}
                >
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", margin: 0, marginBottom: 2 }}>
                    {card.label}
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: 10,
                padding: "10px 12px",
                opacity: chartOpacity,
                transform: `translateY(${chartY}px)`,
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: 0, marginBottom: 8 }}>
                Monthly Spending
              </p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 50 }}>
                {[40, 65, 45, 80, 55, 70, 35].map((h, i) => (
                  <div
                    key={`bar-${i}`}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      background: "linear-gradient(180deg, #7c3aed 0%, #4c1d95 100%)",
                      borderRadius: "3px 3px 0 0",
                      opacity: 0.9,
                    }}
                  />
                ))}
              </div>
            </div>

            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: 10,
                padding: "10px 12px",
                opacity: chartOpacity,
                transform: `translateY(${chartY}px)`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: 0 }}>
                  Expense Trend
                </p>
                <p style={{ fontSize: 9, color: "#22c55e", margin: 0 }}>+12.5%</p>
              </div>
              <svg width="100%" height="40" viewBox="0 0 240 40" fill="none">
                <path
                  d="M0 35 Q30 30 48 25 T96 18 T144 22 T192 10 T240 5"
                  stroke="#7c3aed"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M0 35 Q30 30 48 25 T96 18 T144 22 T192 10 T240 5 V40 H0 Z"
                  fill="url(#lineGrad)"
                  opacity="0.15"
                />
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: 10,
                padding: "10px 12px",
                opacity: chartOpacity,
                transform: `translateY(${chartY}px)`,
                overflow: "hidden",
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: 0, marginBottom: 8 }}>
                Recent Transactions
              </p>
              {[
                { name: "AWS Hosting", amount: "-$340", color: "#ef4444" },
                { name: "Figma License", amount: "-$15", color: "#ef4444" },
                { name: "Client Payment", amount: "+$4,200", color: "#22c55e" },
                { name: "Google Workspace", amount: "-$72", color: "#ef4444" },
              ].map((tx) => (
                <div
                  key={tx.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "5px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{tx.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: tx.color }}>{tx.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
