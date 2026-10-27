import { useState, useEffect } from "react";
import type { ReportItem, ReportSummary, Device, TrafficData } from "../types";
import PageHeader from "../components/layout/PageHeader";
import StatCard from "../components/common/StatCard";
import Card, { SectionHead } from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Icon from "../components/common/Icon";
import TrafficChart from "../components/charts/TrafficChart";
import DonutChart from "../components/charts/DonutChart";
import DateRangeModal from "../components/common/DateRangeModal";
import api from "../services/api";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function Reports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [reportingPeriod, setReportingPeriod] = useState("Last 24 hours");
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [showPostureDetails, setShowPostureDetails] = useState(false);

  const loadReports = () => {
    Promise.all([
      api.getReports(),
      api.getReportSummary(24),
      api.getDevices(),
      api.getTrafficData("24H"),
    ]).then(([repList, sumData, devList, trafData]) => {
      setReports(repList);
      setSummary(sumData);
      setDevices(devList);
      setTrafficData(trafData);
    });
  };

  useEffect(() => {
    loadReports();
    const unsubTick = api.onTick(loadReports);
    return () => {
      unsubTick();
    };
  }, []);

  const handleExportCsv = () => {
    window.open("/api/reports/alerts.csv", "_blank");
  };

  const handleExportPdf = () => {
    window.open("/api/reports/security-24h/download", "_blank");
  };

  const handleDownloadRow = (item: ReportItem) => {
    window.open(`/api/reports/${encodeURIComponent(item.id)}/download`, "_blank");
  };

  const onlineCount = devices.filter((d) => d.status === "Online").length;
  const offlineCount = devices.filter((d) => d.status === "Offline").length;
  const highRiskCount = devices.filter(
    (d) => d.riskLevel === "High" || d.riskLevel === "Critical"
  ).length;

  const sevCounts = summary?.alerts_by_severity || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const totalEvents = summary?.alerts_total ?? 0;
  const maxSev = Math.max(sevCounts.critical, sevCounts.high, sevCounts.medium, sevCounts.low, 1);

  const severityData = [
    {
      name: "Critical",
      value: sevCounts.critical,
      width: totalEvents ? Math.round((sevCounts.critical / maxSev) * 100) : 0,
      desc: "Immediate remote code execution or data exfiltration risks",
    },
    {
      name: "High",
      value: sevCounts.high,
      width: totalEvents ? Math.round((sevCounts.high / maxSev) * 100) : 0,
      desc: "Unauthorized port scans and repeated login failures",
    },
    {
      name: "Medium",
      value: sevCounts.medium,
      width: totalEvents ? Math.round((sevCounts.medium / maxSev) * 100) : 0,
      desc: "Unmanaged IoT hardware or unexpected DNS spikes",
    },
    {
      name: "Low",
      value: sevCounts.low,
      width: totalEvents ? Math.round((sevCounts.low / maxSev) * 100) : 0,
      desc: "Policy variances and routine certificate renewals",
    },
  ];

  const postureScore = summary?.score ?? 100;
  const postureRating =
    postureScore >= 80 ? "Good" : postureScore >= 60 ? "Moderate" : "Elevated Risk";

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Generate, review, and export comprehensive network telemetry and compliance audits."
      >
        <Button variant="secondary" icon="download" onClick={handleExportCsv}>
          Export CSV
        </Button>
        <Button variant="primary" icon="download" onClick={handleExportPdf}>
          Export PDF
        </Button>
      </PageHeader>

      <div className="report-filter">
        <div>
          <span>Reporting period</span>
          <strong>{reportingPeriod}</strong>
        </div>
        <Button
          variant="secondary"
          icon="calendar"
          onClick={() => setIsDateModalOpen(true)}
        >
          Change date range
        </Button>
      </div>

      <div className="stats-grid four compact-stats">
        <StatCard
          label="Total Security Events"
          value={totalEvents}
          detail="Detected in selected period"
          icon="shield"
        />
        <StatCard
          label="Analyzed Traffic"
          value={summary ? formatBytes(summary.bytes) : "0 B"}
          detail={`${summary?.packets ?? 0} packets inspected`}
          icon="traffic"
        />
        <StatCard
          label="Active Devices"
          value={devices.length}
          detail={`${onlineCount} devices currently online`}
          icon="devices"
        />
        <StatCard
          label="Security Posture Score"
          value={`${postureScore}/100`}
          detail={`Rating: ${postureRating}`}
          icon="check"
        />
      </div>

      <div className="report-grid">
        <Card className="traffic-card">
          <SectionHead
            title="Traffic Trend"
            subtitle="Network traffic volume across monitored interfaces"
          />
          <TrafficChart compact timeline={trafficData?.timeline} timeframe="24H" />
        </Card>

        <Card>
          <SectionHead
            title="Security Event Distribution"
            subtitle="Click any severity tier to inspect threat classification"
          />
          <div className="severity-bars">
            <div className="severity-total">
              <strong>{totalEvents}</strong>
              <span>Total events</span>
            </div>
            {severityData.map((item) => (
              <div
                key={item.name}
                style={{
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: "6px",
                  background:
                    selectedSeverity === item.name
                      ? "rgba(175, 221, 229, 0.08)"
                      : "transparent",
                  transition: "background 0.15s ease",
                }}
                onClick={() =>
                  setSelectedSeverity(selectedSeverity === item.name ? null : item.name)
                }
              >
                <span>
                  <strong>
                    {item.name} {selectedSeverity === item.name && "• (Selected)"}
                  </strong>
                  <small>{item.value} events</small>
                </span>
                <div className="bar-track">
                  <i
                    className={item.name.toLowerCase()}
                    style={{
                      width: `${item.width}%`,
                      boxShadow:
                        selectedSeverity === item.name ? "0 0 8px currentColor" : undefined,
                    }}
                  />
                </div>
                {selectedSeverity === item.name && (
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "10px" }}>
                    {item.desc}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="analytics-grid inventory">
        <Card>
          <SectionHead title="Device Inventory" />
          <div className="inventory-main">
            <strong>{devices.length}</strong>
            <span>Known devices</span>
          </div>
          <div className="inventory-pills">
            <span style={{ cursor: "pointer", background: "rgba(118, 212, 194, 0.12)", color: "#76d4c2" }}>
              ● {onlineCount} online
            </span>
            <span style={{ cursor: "pointer", background: "rgba(175, 221, 229, 0.08)", color: "var(--ice)" }}>
              ○ {offlineCount} offline
            </span>
            <span style={{ cursor: "pointer", background: "rgba(150, 71, 52, 0.15)", color: "#e3a191" }}>
              ▲ {highRiskCount} high risk
            </span>
          </div>
        </Card>

        <Card>
          <SectionHead title="Protocol Summary" subtitle="Inspected network protocols" />
          <DonutChart
            segments={trafficData?.protocols || []}
            total={trafficData?.totalVolume}
            totalUnit="total"
          />
        </Card>

        <Card>
          <SectionHead
            title="Security Posture"
            subtitle="Click score ring for score breakdown"
          />
          <div
            className="score-ring"
            style={{ cursor: "pointer", transition: "transform 0.2s ease" }}
            onClick={() => setShowPostureDetails(!showPostureDetails)}
            title="Click to view breakdown"
          >
            <strong>{postureScore}</strong>
            <span>{postureRating}</span>
          </div>
          <p
            className="center-copy"
            style={{ cursor: "pointer" }}
            onClick={() => setShowPostureDetails(!showPostureDetails)}
          >
            {showPostureDetails ? "▲ Click to hide breakdown" : "▼ Click for posture calculation breakdown"}
          </p>

          {showPostureDetails && (
            <div
              style={{
                marginTop: "12px",
                paddingTop: "10px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                <span>Critical Alerts (-15 pts):</span>{" "}
                <strong style={{ color: "#e3a191" }}>{sevCounts.critical}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                <span>High Alerts (-8 pts):</span>{" "}
                <strong style={{ color: "var(--ice)" }}>{sevCounts.high}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                <span>Medium Alerts (-3 pts):</span>{" "}
                <strong style={{ color: "var(--ice)" }}>{sevCounts.medium}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                <span>Low Alerts (-1 pt):</span>{" "}
                <strong style={{ color: "var(--muted)" }}>{sevCounts.low}</strong>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="table-card">
        <SectionHead
          title="Generated Reports"
          subtitle="Real-time compliance, inventory, and audit documents from backend"
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Reporting Period</th>
                <th>Generated</th>
                <th>Format</th>
                <th>Status</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                    No reports generated yet.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="event-name">
                        <span className="event-icon">
                          <Icon name="report" size={15} />
                        </span>
                        <strong>{r.name}</strong>
                      </span>
                    </td>
                    <td>{r.period}</td>
                    <td>{r.generatedAt}</td>
                    <td>
                      <Badge tone="neutral">{r.format}</Badge>
                    </td>
                    <td>
                      <Badge tone="success">{r.status}</Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Download ${r.name}`}
                        onClick={() => handleDownloadRow(r)}
                        title={`Download ${r.format} from backend`}
                      >
                        <Icon name="download" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <DateRangeModal
        currentRange={reportingPeriod}
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onApply={(newRange) => setReportingPeriod(newRange)}
      />
    </>
  );
}
