import { useState } from "react";
import type { ProtocolStat } from "../../types";

const defaultSegments: ProtocolStat[] = [
  { name: "HTTPS", value: 42, color: "cyan" },
  { name: "TCP", value: 26, color: "ice" },
  { name: "UDP", value: 14, color: "teal" },
  { name: "DNS", value: 11, color: "rust" },
  { name: "HTTP", value: 7, color: "muted" },
];

const colorMap: Record<string, string> = {
  cyan: "#0fa4af",
  ice: "#afdDE5",
  teal: "#3d7a7f",
  rust: "#964734",
  muted: "#577f84",
};

export default function DonutChart({
  segments = defaultSegments,
  total = "1.8",
  totalUnit = "GB total",
}: {
  segments?: ProtocolStat[];
  total?: string;
  totalUnit?: string;
}) {
  const [activeSegment, setActiveSegment] = useState<ProtocolStat | null>(null);

  // SVG parameters
  const size = 150;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  const totalNumeric = parseFloat(total) || 1.8;

  return (
    <div className="donut-layout">
      {/* Interactive SVG Donut */}
      <div style={{ position: "relative", width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)", overflow: "visible" }}
        >
          {/* Base background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(175, 221, 229, 0.06)"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {segments.map((seg) => {
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
                  filter: isHovered ? `drop-shadow(0 0 6px ${segColor})` : undefined,
                  opacity: activeSegment && !isHovered ? 0.45 : 1,
                }}
                onMouseEnter={() => setActiveSegment(seg)}
                onMouseLeave={() => setActiveSegment(null)}
              />
            );
          })}
        </svg>

        {/* Center Text Indicator */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <strong
            style={{
              fontSize: activeSegment ? "18px" : "20px",
              color: activeSegment ? colorMap[activeSegment.color] : "var(--text)",
              transition: "all 0.15s ease",
              lineHeight: 1.1,
            }}
          >
            {activeSegment ? activeSegment.name : total}
          </strong>
          <span
            style={{
              fontSize: "10px",
              color: "var(--muted)",
              marginTop: "3px",
              transition: "all 0.15s ease",
            }}
          >
            {activeSegment
              ? `${activeSegment.value}% (${((activeSegment.value / 100) * totalNumeric).toFixed(2)} GB)`
              : totalUnit}
          </span>
        </div>
      </div>

      {/* Interactive Legend */}
      <div className="donut-legend">
        {segments.map((item) => {
          const isHovered = activeSegment?.name === item.name;
          const segColor = colorMap[item.color] || "#0fa4af";

          return (
            <div
              key={item.name}
              style={{
                cursor: "pointer",
                padding: "8px 10px",
                borderRadius: "6px",
                background: isHovered ? "rgba(15, 164, 175, 0.14)" : "transparent",
                border: isHovered ? "1px solid rgba(15, 164, 175, 0.3)" : "1px solid transparent",
                transition: "all 0.15s ease",
                opacity: activeSegment && !isHovered ? 0.4 : 1,
              }}
              onMouseEnter={() => setActiveSegment(item)}
              onMouseLeave={() => setActiveSegment(null)}
            >
              <span>
                <i
                  className={`legend-dot ${item.color}`}
                  style={{
                    boxShadow: isHovered ? `0 0 8px ${segColor}` : undefined,
                    transform: isHovered ? "scale(1.3)" : "scale(1)",
                    transition: "transform 0.15s ease",
                  }}
                />
                <strong style={{ color: isHovered ? "var(--ice)" : undefined }}>
                  {item.name}
                </strong>
              </span>
              <strong style={{ color: isHovered ? segColor : undefined }}>
                {item.value}%
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
