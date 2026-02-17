import React from "react";

const TITLE_BAR_HEIGHT = 40;
const BORDER_RADIUS = 12;

const trafficLights = [
  { color: "#FF5F57", border: "#E0443E" },
  { color: "#FEBC2E", border: "#DEA123" },
  { color: "#28C840", border: "#1AAB29" },
];

export const MacOSWindow: React.FC<{
  children: React.ReactNode;
  width: number;
  height: number;
}> = ({ children, width, height }) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: BORDER_RADIUS,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow:
          "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          height: TITLE_BAR_HEIGHT,
          minHeight: TITLE_BAR_HEIGHT,
          background: "linear-gradient(180deg, #2a2a35 0%, #1e1e28 100%)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 16,
          gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {trafficLights.map((light) => (
          <div
            key={light.color}
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              backgroundColor: light.color,
              border: `1px solid ${light.border}`,
            }}
          />
        ))}
        <div
          style={{
            flex: 1,
            textAlign: "center",
            color: "rgba(255,255,255,0.35)",
            fontSize: 13,
            fontWeight: 500,
            paddingRight: 60,
            letterSpacing: 0.3,
          }}
        >
          doce.dev
        </div>
      </div>

      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};
