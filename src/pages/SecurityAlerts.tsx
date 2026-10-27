import { useState, useEffect } from "react";
import type { SecurityAlert, AlertStatus } from "../types";
import PageHeader from "../components/layout/PageHeader";
import StatCard from "../components/common/StatCard";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Icon from "../components/common/Icon";
import { Search, Select } from "../components/common/UIControls";
import AlertDrawer from "../components/alerts/AlertDrawer";
import { exportToCsv } from "../utils/export";
import api from "../services/api";

export default function SecurityAlerts() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All severities");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [showNotice, setShowNotice] = useState(true);

  const loadAlerts = () => {
    api.getAlerts(severityFilter, statusFilter).then((data) => {
      setAlerts(data);
    });
  };

  useEffect(() => {
    loadAlerts();

    // In-place tick update
    const unsubTick = api.onTick(loadAlerts);

    const unsubWs = api.subscribeWebSocket((event) => {
      if (event.type === "alert") {
        loadAlerts();
      }
    });

    return () => {
      unsubTick();
      unsubWs();
    };
  }, [severityFilter, statusFilter]);

  const handleStatusChange = async (alertId: string, newStatus: AlertStatus) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
    );
    try {
      await api.updateAlertStatus(alertId, newStatus);
      loadAlerts();
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.affectedDevice.toLowerCase().includes(search.toLowerCase()) ||
      a.sourceIp.includes(search);
    return matchesSearch;
  });

  const handleExportAlerts = () => {
    const headers = ["Alert ID", "Title", "Severity", "Affected Device", "Source IP", "Destination IP", "Detected Time", "Status"];
    const rows = filteredAlerts.map((a) => [
      a.alertId,
      a.title,
      a.severity,
      a.affectedDevice,
      a.sourceIp,
      a.destinationIp,
      a.timeDetected,
      a.status,
    ]);
    exportToCsv("netsentinel_security_alerts.csv", rows, headers);
  };

  const criticalCount = alerts.filter((a) => a.severity === "Critical").length;
  const highCount = alerts.filter((a) => a.severity === "High").length;
  const mediumCount = alerts.filter((a) => a.severity === "Medium").length;
  const resolvedCount = alerts.filter((a) => a.status === "Resolved").length;

  return (
    <>
      <PageHeader
        title="Security Alerts"
        subtitle="Review suspicious network behavior and prioritize investigation."
      >
        <Button variant="secondary" icon="download" onClick={handleExportAlerts}>
          Export alerts
        </Button>
      </PageHeader>

      <div className="stats-grid four compact-stats">
        <StatCard
          label="Critical Alerts"
          value={criticalCount}
          detail={criticalCount > 0 ? "Immediate review required" : "No critical alerts"}
          icon="shield"
          tone={criticalCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="High Severity"
          value={highCount}
          detail={highCount > 0 ? "Active investigation" : "No high severity alerts"}
          icon="bell"
          tone={highCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Medium Severity"
          value={mediumCount}
          detail={`${mediumCount} medium alerts logged`}
          icon="traffic"
        />
        <StatCard
          label="Resolved Alerts"
          value={resolvedCount}
          detail="Closed or mitigated"
          icon="check"
        />
      </div>

      {showNotice && (
        <div className="notice">
          <Icon name="shield" />
          <div>
            <strong>Alerts indicate suspicious behavior, not confirmed attacks.</strong>
            <span>
              Review supporting evidence and device context before taking action.
            </span>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowNotice(false)}
            aria-label="Dismiss notice"
          >
            <Icon name="x" />
          </button>
        </div>
      )}

      <Card className="table-card">
        <div className="toolbar">
          <Search
            placeholder="Search alerts, devices or IPs..."
            value={search}
            onChange={setSearch}
          />
          <div>
            <Select
              label="Severity"
              value={severityFilter}
              onChange={setSeverityFilter}
            >
              <option value="All severities">All severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </Select>
            <Select
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <option value="All statuses">All statuses</option>
              <option value="Open">Open</option>
              <option value="Investigating">Investigating</option>
              <option value="Resolved">Resolved</option>
            </Select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alert</th>
                <th>Severity</th>
                <th>Affected Device</th>
                <th>Source IP</th>
                <th>Time Detected</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "var(--muted)" }}>
                    {search || severityFilter !== "All severities" || statusFilter !== "All statuses"
                      ? "No alerts match the current filter."
                      : "No security alerts recorded. Your network is clear."}
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedAlert(r)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span className="event-name">
                        <span className="event-icon">
                          <Icon name="shield" size={15} />
                        </span>
                        <strong>{r.title}</strong>
                      </span>
                    </td>
                    <td>
                      <Badge tone={r.severity.toLowerCase() as "high" | "medium" | "low" | "critical"}>
                        {r.severity}
                      </Badge>
                    </td>
                    <td>{r.affectedDevice}</td>
                    <td className="mono">{r.sourceIp}</td>
                    <td>{r.timeDetected}</td>
                    <td>
                      <span className="status-text">{r.status}</span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label="More details"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAlert(r);
                        }}
                      >
                        <Icon name="more" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedAlert && (
        <AlertDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  );
}
