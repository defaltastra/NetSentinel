import { useState, useRef } from "react";
import type { TrafficTimelinePoint } from "../../types";

export type Timeframe = "1H" | "24H" | "7D" | "30D";

export interface ChartDataPoint {
  time: string;
  incoming: number; // scaled 0 - 100 for SVG plotting
  outgoing: number; // scaled 0 - 100 for SVG plotting
  incomingLabel: string;
  outgoingLabel: string;
}

interface TrafficChartProps {
  compact?: boolean;
  timeframe?: Timeframe;
  timeline?: TrafficTimelinePoint[];
  onHoverPoint?: (point: ChartDataPoint | null) => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function TrafficChart({
  compact = false,
  timeframe = "24H",
  timeline,
}: TrafficChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const hasTimeline = timeline && timeline.length > 0;
  let points: ChartDataPoint[] = [];
  let yLabels: string[] = ["100 KB", "75 KB", "50 KB", "25 KB", "0 B"];

  if (hasTimeline) {
    const maxBytes = Math.max(...timeline.map((p) => p.bytes), 1024);
    yLabels = [
      formatBytes(maxBytes),
      formatBytes(Math.round(maxBytes * 0.75)),
      formatBytes(Math.round(maxBytes * 0.5)),
      formatBytes(Math.round(maxBytes * 0.25)),
      "0 B",
    ];

    points = timeline.map((p) => {
      let timeStr = p.time;
      if (timeStr.includes(" ")) {
        timeStr = timeStr.split(" ")[1]?.slice(0, 5) || timeStr;
      }
      const inc = Math.min(100, Math.max(0, Math.round((p.bytes / maxBytes) * 85)));
      const out = Math.min(100, Math.max(0, Math.round(inc * 0.45)));
      return {
        time: timeStr,
        incoming: inc,
        outgoing: out,
        incomingLabel: formatBytes(p.bytes),
        outgoingLabel: formatBytes(Math.round(p.bytes * 0.45)),
      };
    });

    // Ensure at least 2 points for SVG curve
    if (points.length === 1) {
      points.unshift({
        time: "Start",
        incoming: 0,
        outgoing: 0,
        incomingLabel: "0 B",
        outgoingLabel: "0 B",
      });
    }
  } else {
    // Empty state flat baseline
    points = [
      { time: "--:--", incoming: 0, outgoing: 0, incomingLabel: "0 B", outgoingLabel: "0 B" },
      { time: "--:--", incoming: 0, outgoing: 0, incomingLabel: "0 B", outgoingLabel: "0 B" },
    ];
  }

  // Pick at most 6 evenly distributed labels across the chart width to prevent overflow of hours
  const labelIndices: number[] = [];
  if (points.length > 0) {
    const targetCount = Math.min(6, points.length);
    if (targetCount === 1) {
      labelIndices.push(0);
    } else {
      for (let i = 0; i < targetCount; i++) {
        const idx = Math.round((i / (targetCount - 1)) * (points.length - 1));
        if (!labelIndices.includes(idx)) {
          labelIndices.push(idx);
        }
      }
    }
  }

  const svgWidth = 750;
  const svgHeight = compact ? 110 : 140;
  const paddingBottom = 15;
  const paddingTop = 15;
  const usableHeight = svgHeight - paddingTop - paddingBottom;

  // Convert points to SVG coordinates
  const coords = points.map((p, index) => {
    const divisor = Math.max(1, points.length - 1);
    const x = (index / divisor) * svgWidth;
    const yIncoming = svgHeight - paddingBottom - (p.incoming / 100) * usableHeight;
    const yOutgoing = svgHeight - paddingBottom - (p.outgoing / 100) * usableHeight;
    return { x, yIncoming, yOutgoing, data: p };
  });

  // Build SVG path strings with smooth curves
  const makePath = (key: "yIncoming" | "yOutgoing") => {
    if (coords.length === 0) return "";
    let d = `M ${coords[0].x} ${coords[0][key]}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const mx = (p0.x + p1.x) / 2;
      d += ` C ${mx} ${p0[key]}, ${mx} ${p1[key]}, ${p1.x} ${p1[key]}`;
    }
    return d;
  };

  const incomingPath = makePath("yIncoming");
  const outgoingPath = makePath("yOutgoing");

  // Area path for subtle gradient fill
  const incomingArea = `${incomingPath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;
  const outgoingArea = `${outgoingPath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !hasTimeline) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
    const closestIdx = Math.round(ratio * (points.length - 1));
    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Active point for tooltip
  const activeCoord = hoverIndex !== null && coords[hoverIndex] ? coords[hoverIndex] : null;
  const isHovering = hoverIndex !== null;

  return (
    <div className={`chart ${compact ? "compact" : ""}`}>
      {/* Y-Axis Labels */}
      <div className="chart-y">
        {yLabels.map((lbl, idx) => (
          <span key={idx}>{lbl}</span>
        ))}
      </div>

      {/* Chart Plot Area */}
      <div className="chart-plot" style={{ position: "relative" }}>
        <div className="grid-lines">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>

        {!hasTimeline && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
              fontSize: "12px",
              pointerEvents: "none",
            }}
          >
            No traffic data recorded in this period ({timeframe})
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Network traffic telemetry graph for ${timeframe}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: hasTimeline ? "crosshair" : "default" }}
        >
          <defs>
            <linearGradient id="cyanAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0fa4af" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0fa4af" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="iceAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#afdDE5" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#afdDE5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Gradients */}
          {hasTimeline && <path d={incomingArea} fill="url(#cyanAreaGrad)" />}
          {hasTimeline && <path d={outgoingArea} fill="url(#iceAreaGrad)" />}

          {/* Animated/Smooth Line Strokes */}
          <path
            d={outgoingPath}
            fill="none"
            stroke="#afdDE5"
            strokeWidth="1.8"
            strokeOpacity="0.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={incomingPath}
            fill="none"
            stroke="#0fa4af"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Vertical Hover Crosshair Line */}
          {activeCoord && (
            <line
              x1={activeCoord.x}
              y1={0}
              x2={activeCoord.x}
              y2={svgHeight}
              stroke="rgba(175, 221, 229, 0.4)"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
          )}

          {/* Outgoing Point */}
          {activeCoord && (
            <circle
              cx={activeCoord.x}
              cy={activeCoord.yOutgoing}
              r="4"
              fill="#afdDE5"
              stroke="#024950"
              strokeWidth="2"
            />
          )}

          {/* Incoming Point */}
          {activeCoord && (
            <circle
              cx={activeCoord.x}
              cy={activeCoord.yIncoming}
              r="5"
              fill="#0fa4af"
              stroke="#003135"
              strokeWidth="2.5"
            />
          )}
        </svg>

        {/* Dynamic Tooltip */}
        {!compact && activeCoord && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(activeCoord.x / svgWidth) * 100}%`,
              right: "auto",
              transform:
                activeCoord.x > svgWidth * 0.65
                  ? "translateX(calc(-100% - 12px))"
                  : activeCoord.x < svgWidth * 0.35
                  ? "translateX(12px)"
                  : "translateX(-50%)",
              top: `${Math.max(5, Math.min(activeCoord.yIncoming - 45, svgHeight - 60))}px`,
              transition: isHovering ? "left 0.08s ease, top 0.08s ease" : "all 0.25s ease",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              width: "max-content",
              zIndex: 30,
            }}
          >
            <strong>{activeCoord.data.time}</strong>
            <span>
              <i className="legend-dot cyan" />
              Incoming <b>{activeCoord.data.incomingLabel}</b>
            </span>
            <span>
              <i className="legend-dot ice" />
              Outgoing <b>{activeCoord.data.outgoingLabel}</b>
            </span>
          </div>
        )}

        {/* X-Axis Time Labels - sampled to prevent overflow */}
        <div
          className="chart-x"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "16px",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {labelIndices.map((idx) => {
            const p = points[idx];
            if (!p) return null;
            const leftPct = (idx / Math.max(1, points.length - 1)) * 100;
            const transform =
              idx === 0
                ? "none"
                : idx === points.length - 1
                ? "translateX(-100%)"
                : "translateX(-50%)";

            return (
              <span
                key={idx}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  transform,
                  whiteSpace: "nowrap",
                  fontSize: "9px",
                  color: activeCoord?.data.time === p.time ? "var(--cyan)" : "#6f9ca1",
                  fontWeight: activeCoord?.data.time === p.time ? 600 : 400,
                }}
              >
                {p.time}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
