import { useState } from "react";
import type { ProtocolStat } from "../../types";

const colorMap: Record<string, string> = {
  cyan: "#0fa4af",
  ice: "#afdDE5",
  teal: "#3d7a7f",
  rust: "#964734",
  muted: "#577f84",
};

export default function DonutChart({
  segments = [],
  total,
  totalUnit = "",
}: {
  segments?: ProtocolStat[];
  total?: string;
  totalUnit?: string;
}) {
  const [activeSegment, setActiveSegment] = useState<ProtocolStat | null>(null);

  // SVG parameters
  const size = 150;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const hasData = segments && segments.length > 0;

  return (
    <div className="donut-layout" style={{ position: "relative" }}>
      {/* Interactive SVG Donut */}
      <div style={{ position: "relative", width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        <svg
          width={size}
          height={size}
          viewBox="-10 -10 170 170"
          style={{ transform: "rotate(-90deg)", overflow: "visible" }}
        >
          {/* Base background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(175, 221, 229, 0.08)"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {hasData &&
            segments.map((seg) => {
              const strokeDasharray = `${(seg.value / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += seg.value;

              const isHovered = activeSegment?.name === seg.name;
              const segColor = colorMap[seg.color] || "#0fa4af";

              return (
                <circle
                  key={seg.name}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segColor}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="butt"
                  style={{
                    cursor: "pointer",
                    transition: "stroke-width 0.2s ease, filter 0.2s ease, opacity 0.2s ease",
                    filter: isHovered ? `drop-shadow(0 0 8px ${segColor})` : undefined,
                    opacity: activeSegment && !isHovered ? 0.35 : 1,
                  }}
                  onMouseEnter={() => setActiveSegment(seg)}
                  onMouseLeave={() => setActiveSegment(null)}
                />
              );
            })}
        </svg>

        {/* Center Disc Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "92px",
              height: "92px",
              borderRadius: "50%",
              background: "var(--panel-deep)",
              border: "1px solid var(--border)",
              boxShadow: "0 6px 16px rgba(0, 15, 18, 0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "4px",
              transition: "all 0.2s ease",
            }}
          >
            {activeSegment ? (
              <>
                <strong style={{ fontSize: "18px", color: colorMap[activeSegment.color] || "var(--cyan)", lineHeight: 1 }}>
                  {activeSegment.value}%
                </strong>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "var(--ice)",
                    marginTop: "4px",
                    maxWidth: "80px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeSegment.name}
                </span>
              </>
            ) : (
              <>
                <strong style={{ fontSize: "14px", color: "var(--ice)", lineHeight: 1 }}>
                  {total || (hasData ? "100%" : "0 B")}
                </strong>
                <span style={{ fontSize: "9px", color: "var(--muted)", marginTop: "3px" }}>
                  {totalUnit || (hasData ? "Volume" : "No traffic")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Legend Column */}
      <div className="donut-legend" style={{ minWidth: "120px" }}>
        {hasData ? (
          segments.map((seg) => {
            const isHovered = activeSegment?.name === seg.name;
            const segColor = colorMap[seg.color] || "var(--cyan)";
            return (
              <div
                key={seg.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: isHovered ? "rgba(15, 164, 175, 0.16)" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={() => setActiveSegment(seg)}
                onMouseLeave={() => setActiveSegment(null)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: segColor,
                      boxShadow: isHovered ? `0 0 6px ${segColor}` : undefined,
                    }}
                  />
                  <span style={{ fontSize: "11px", color: isHovered ? "var(--ice)" : "var(--text)", fontWeight: isHovered ? 600 : 400 }}>
                    {seg.name}
                  </span>
                </div>
                <strong style={{ fontSize: "11px", color: isHovered ? "var(--ice)" : "var(--muted)" }}>
                  {seg.value}%
                </strong>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: "11px", color: "var(--muted)", padding: "8px 0" }}>
            No protocol distribution data available.
          </div>
        )}
      </div>
    </div>
  );
}
