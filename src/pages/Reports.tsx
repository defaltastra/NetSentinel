import { useState, useEffect } from "react";
import type { ReportItem } from "../types";
import PageHeader from "../components/layout/PageHeader";
import StatCard from "../components/common/StatCard";
import Card, { SectionHead } from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Icon from "../components/common/Icon";
import TrafficChart from "../components/charts/TrafficChart";
import DonutChart from "../components/charts/DonutChart";
import DateRangeModal from "../components/common/DateRangeModal";
import { exportToCsv, exportToPdf } from "../utils/export";
import api from "../services/api";

export default function Reports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportingPeriod, setReportingPeriod] = useState("May 18 – May 24, 2025");
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [showPostureDetails, setShowPostureDetails] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getReports().then((data) => {
      if (mounted) setReports(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleExportCsv = () => {
    const headers = ["Report Name", "Reporting Period", "Generated Timestamp", "Format", "Status"];
    const rows = reports.map((r) => [r.name, r.period, r.generatedAt, r.format, r.status]);
    exportToCsv("netsentinel_audit_reports.csv", rows, headers);
  };

  const handleExportPdf = () => {
    exportToPdf("NetSentinel Security & Compliance Audit Report");
  };

  const handleDownloadRow = (item: ReportItem) => {
    if (item.format === "CSV") {
      const headers = ["Metric", "Value", "Benchmark"];
      const rows = [
        ["Total Analyzed Traffic", "18.6 GB", "+12.2%"],
        ["Total Security Events", "64", "-8.4%"],
        ["Active Devices", "24", "100% covered"],
        ["Alerts Resolved", "38", "92% rate"],
      ];
      exportToCsv(`${item.name.toLowerCase().replace(/\s+/g, "_")}.csv`, rows, headers);
    } else {
      exportToPdf(item.name);
    }
  };

  const severityData = [
    { name: "Critical", value: 2, width: 12, desc: "Immediate remote code execution or data exfiltration risks" },
    { name: "High", value: 9, width: 32, desc: "Unauthorized port scans and repeated login failures" },
    { name: "Medium", value: 21, width: 58, desc: "Unmanaged IoT hardware or unexpected DNS spikes" },
    { name: "Low", value: 32, width: 86, desc: "Policy variances and routine certificate renewals" },
  ];

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
          value="64"
          detail="-8.4% from last period"
          icon="shield"
        />
        <StatCard
          label="Analyzed Traffic"
          value="18.6 GB"
          detail="+12.2% from last period"
          icon="traffic"
        />
        <StatCard
          label="Devices Observed"
          value="24"
          detail="3 newly discovered"
          icon="devices"
        />
        <StatCard
          label="Alerts Resolved"
          value="38"
          detail="92% resolution rate"
          icon="check"
        />
      </div>

      <div className="report-grid">
        <Card className="traffic-card">
          <SectionHead
            title="Traffic Trend"
            subtitle="Daily network traffic volume (click to inspect points)"
            action={<Badge tone="cyan">+12.2%</Badge>}
          />
          <TrafficChart compact />
        </Card>

        <Card>
          <SectionHead
            title="Security Event Distribution"
            subtitle="Click any severity tier to inspect threat classification"
          />
          <div className="severity-bars">
            <div className="severity-total">
              <strong>64</strong>
              <span>Total events</span>
            </div>
            {severityData.map((item) => (
              <div
                key={item.name}
                style={{
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: "6px",
                  background: selectedSeverity === item.name ? "rgba(175, 221, 229, 0.08)" : "transparent",
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
                      boxShadow: selectedSeverity === item.name ? "0 0 8px currentColor" : undefined,
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
            <strong>24</strong>
            <span>Known devices</span>
          </div>
          <div className="inventory-pills">
            <span style={{ cursor: "pointer", background: "rgba(118, 212, 194, 0.12)", color: "#76d4c2" }}>
              ● 21 online
            </span>
            <span style={{ cursor: "pointer", background: "rgba(175, 221, 229, 0.08)", color: "var(--ice)" }}>
              ○ 3 offline
            </span>
            <span style={{ cursor: "pointer", background: "rgba(150, 71, 52, 0.15)", color: "#e3a191" }}>
              ▲ 2 high risk
            </span>
          </div>
        </Card>

        <Card>
          <SectionHead title="Protocol Summary" subtitle="Hover or click to isolate" />
          <DonutChart />
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
            <strong>84</strong>
            <span>Good</span>
          </div>
          <p className="center-copy" style={{ cursor: "pointer" }} onClick={() => setShowPostureDetails(!showPostureDetails)}>
            {showPostureDetails ? "▲ Click to hide breakdown" : "▼ Up 6 pts · Click for breakdown"}
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
                <span>Endpoint Defense:</span> <strong style={{ color: "var(--ice)" }}>92/100</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                <span>Firewall Rule Hygiene:</span> <strong style={{ color: "var(--ice)" }}>88/100</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                <span>Incident Response SLA:</span> <strong style={{ color: "var(--ice)" }}>80/100</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                <span>DNS Query Safety:</span> <strong style={{ color: "var(--ice)" }}>76/100</strong>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="table-card">
        <SectionHead
          title="Recent Reports"
          subtitle="Generated analytics and compliance summaries"
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
              {reports.map((r) => (
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
                      title={`Download ${r.format}`}
                    >
                      <Icon name="download" />
                    </button>
                  </td>
                </tr>
              ))}
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
