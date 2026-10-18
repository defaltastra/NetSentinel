import { useState, useRef } from "react";

export type Timeframe = "1H" | "24H" | "7D" | "30D";

export interface ChartDataPoint {
  time: string;
  incoming: number; // scaled 0 - 100 for SVG plotting
  outgoing: number; // scaled 0 - 100 for SVG plotting
  incomingLabel: string;
  outgoingLabel: string;
}

const timeframeData: Record<
  Timeframe,
  {
    points: ChartDataPoint[];
    yLabels: string[];
    totalSummary: string;
  }
> = {
  "1H": {
    yLabels: ["800 MB", "600 MB", "400 MB", "200 MB", "0"],
    totalSummary: "482 MB in last hour",
    points: [
      { time: "14:00", incoming: 22, outgoing: 12, incomingLabel: "180 MB", outgoingLabel: "95 MB" },
      { time: "14:10", incoming: 48, outgoing: 24, incomingLabel: "385 MB", outgoingLabel: "190 MB" },
      { time: "14:20", incoming: 35, outgoing: 28, incomingLabel: "280 MB", outgoingLabel: "220 MB" },
      { time: "14:30", incoming: 82, outgoing: 42, incomingLabel: "660 MB", outgoingLabel: "335 MB" },
      { time: "14:40", incoming: 65, outgoing: 38, incomingLabel: "520 MB", outgoingLabel: "305 MB" },
      { time: "14:50", incoming: 92, outgoing: 54, incomingLabel: "735 MB", outgoingLabel: "430 MB" },
      { time: "15:00", incoming: 76, outgoing: 46, incomingLabel: "610 MB", outgoingLabel: "370 MB" },
    ],
  },
  "24H": {
    yLabels: ["2.0 GB", "1.5 GB", "1.0 GB", "500 MB", "0"],
    totalSummary: "2.94 GB in 24 hours",
    points: [
      { time: "00:00", incoming: 18, outgoing: 10, incomingLabel: "360 MB", outgoingLabel: "200 MB" },
      { time: "04:00", incoming: 12, outgoing: 8, incomingLabel: "240 MB", outgoingLabel: "160 MB" },
      { time: "08:00", incoming: 52, outgoing: 32, incomingLabel: "1.04 GB", outgoingLabel: "640 MB" },
      { time: "12:00", incoming: 78, outgoing: 48, incomingLabel: "1.56 GB", outgoingLabel: "960 MB" },
      { time: "14:00", incoming: 91, outgoing: 56, incomingLabel: "1.82 GB", outgoingLabel: "1.12 GB" },
      { time: "16:00", incoming: 80, outgoing: 50, incomingLabel: "1.60 GB", outgoingLabel: "1.00 GB" },
      { time: "18:00", incoming: 62, outgoing: 38, incomingLabel: "1.24 GB", outgoingLabel: "760 MB" },
      { time: "22:00", incoming: 34, outgoing: 18, incomingLabel: "680 MB", outgoingLabel: "360 MB" },
    ],
  },
  "7D": {
    yLabels: ["15 GB", "11 GB", "7.5 GB", "3.5 GB", "0"],
    totalSummary: "19.4 GB in 7 days",
    points: [
      { time: "Mon", incoming: 65, outgoing: 38, incomingLabel: "9.8 GB", outgoingLabel: "5.7 GB" },
      { time: "Tue", incoming: 74, outgoing: 44, incomingLabel: "11.1 GB", outgoingLabel: "6.6 GB" },
      { time: "Wed", incoming: 88, outgoing: 52, incomingLabel: "13.2 GB", outgoingLabel: "7.8 GB" },
      { time: "Thu", incoming: 82, outgoing: 48, incomingLabel: "12.3 GB", outgoingLabel: "7.2 GB" },
      { time: "Fri", incoming: 95, outgoing: 58, incomingLabel: "14.2 GB", outgoingLabel: "8.7 GB" },
      { time: "Sat", incoming: 38, outgoing: 20, incomingLabel: "5.7 GB", outgoingLabel: "3.0 GB" },
      { time: "Sun", incoming: 28, outgoing: 15, incomingLabel: "4.2 GB", outgoingLabel: "2.2 GB" },
    ],
  },
  "30D": {
    yLabels: ["80 GB", "60 GB", "40 GB", "20 GB", "0"],
    totalSummary: "78.2 GB in 30 days",
    points: [
      { time: "Week 1", incoming: 70, outgoing: 40, incomingLabel: "56 GB", outgoingLabel: "32 GB" },
      { time: "Week 2", incoming: 82, outgoing: 50, incomingLabel: "65 GB", outgoingLabel: "40 GB" },
      { time: "Week 3", incoming: 94, outgoing: 58, incomingLabel: "75 GB", outgoingLabel: "46 GB" },
      { time: "Week 4", incoming: 86, outgoing: 52, incomingLabel: "69 GB", outgoingLabel: "41 GB" },
    ],
  },
};

interface TrafficChartProps {
  compact?: boolean;
  timeframe?: Timeframe;
  onHoverPoint?: (point: ChartDataPoint | null) => void;
}

export default function TrafficChart({
  compact = false,
  timeframe = "24H",
}: TrafficChartProps) {
  const current = timeframeData[timeframe] || timeframeData["24H"];
  const points = current.points;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const svgWidth = 750;
  const svgHeight = compact ? 110 : 140;
  const paddingBottom = 15;
  const paddingTop = 15;
  const usableHeight = svgHeight - paddingTop - paddingBottom;

  // Convert points to SVG coordinates
  const coords = points.map((p, index) => {
    const x = (index / (points.length - 1)) * svgWidth;
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
    if (!svgRef.current) return;
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
  const activeCoord = hoverIndex !== null ? coords[hoverIndex] : coords[coords.length - 2];
  const isHovering = hoverIndex !== null;

  return (
    <div className={`chart ${compact ? "compact" : ""}`}>
      {/* Y-Axis Labels */}
      <div className="chart-y">
        {current.yLabels.map((lbl, idx) => (
          <span key={idx}>{lbl}</span>
        ))}
      </div>

      {/* Chart Plot Area */}
      <div className="chart-plot">
        <div className="grid-lines">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Network traffic telemetry graph for ${timeframe}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: "crosshair" }}
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
          <path d={incomingArea} fill="url(#cyanAreaGrad)" />
          <path d={outgoingArea} fill="url(#iceAreaGrad)" />

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
              transform:
                activeCoord.x > svgWidth * 0.7
                  ? "translateX(-105%)"
                  : activeCoord.x < svgWidth * 0.3
                  ? "translateX(5%)"
                  : "translateX(-50%)",
              top: `${Math.min(activeCoord.yIncoming - 25, 45)}px`,
              transition: isHovering ? "left 0.08s ease, top 0.08s ease" : "all 0.25s ease",
              pointerEvents: "none",
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

        {/* X-Axis Time Labels */}
        <div className="chart-x">
          {points.map((p, idx) => (
            <span
              key={idx}
              style={{
                color: activeCoord?.data.time === p.time ? "var(--cyan)" : undefined,
                fontWeight: activeCoord?.data.time === p.time ? 600 : 400,
              }}
            >
              {p.time}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
