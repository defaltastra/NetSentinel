import { useState } from "react";
import type { SecurityAlert, AlertStatus } from "../../types";
import Icon from "../common/Icon";
import Badge from "../common/Badge";
import Button from "../common/Button";
import Card, { SectionHead } from "../common/Card";
import { Select } from "../common/UIControls";

interface AlertDrawerProps {
  alert: SecurityAlert;
  onClose: () => void;
  onStatusChange?: (alertId: string, newStatus: AlertStatus) => void;
}

export default function AlertDrawer({
  alert,
  onClose,
  onStatusChange,
}: AlertDrawerProps) {
  const [status, setStatus] = useState<AlertStatus>(alert.status);
  const [notes, setNotes] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const handleStatusSelect = (val: string) => {
    const newStatus = val as AlertStatus;
    setStatus(newStatus);
    onStatusChange?.(alert.id, newStatus);
  };

  const handleMarkResolved = () => {
    setStatus("Resolved");
    onStatusChange?.(alert.id, "Resolved");
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer alert-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <Badge tone={alert.severity.toLowerCase() as "high" | "medium" | "low" | "critical"}>
              {alert.severity} severity
            </Badge>
            <h2>{alert.title}</h2>
            <p>Alert ID {alert.alertId}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close drawer">
            <Icon name="x" />
          </button>
        </div>

        <div className="drawer-body">
          <div className="info-grid">
            <div>
              <span>Detected</span>
              <strong>{alert.timeDetected}</strong>
            </div>
            <div>
              <span>Status</span>
              <Select
                label="Alert status"
                value={status}
                onChange={handleStatusSelect}
              >
                <option value="Investigating">Investigating</option>
                <option value="Open">Open</option>
                <option value="Resolved">Resolved</option>
              </Select>
            </div>
            <div>
              <span>Affected device</span>
              <strong>{alert.affectedDevice}</strong>
            </div>
            <div>
              <span>Source → Destination</span>
              <strong>
                {alert.sourceIp} → {alert.destinationIp}
              </strong>
            </div>
          </div>

          <div className="detail-section">
            <h3>What was detected</h3>
            <p>{alert.description}</p>
          </div>

          <Card className="evidence">
            <SectionHead title="Evidence summary" />
            <div>
              <span>Transfer volume</span>
              <strong>{alert.evidence.transferVolume}</strong>
            </div>
            <div>
              <span>Baseline variance</span>
              <strong>{alert.evidence.baselineVariance}</strong>
            </div>
            <div>
              <span>Destination reputation</span>
              <Badge tone="neutral">{alert.evidence.destinationReputation}</Badge>
            </div>
          </Card>

          <div className="detail-section">
            <h3>Recommended investigation</h3>
            <ol>
              {alert.recommendations.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>

          <label className="notes">
            <span>Investigation notes</span>
            <textarea
              placeholder="Add context for your team..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="drawer-actions">
            <Button variant="secondary" onClick={handleMarkResolved}>
              Mark resolved
            </Button>
            <Button onClick={handleSave}>
              {isSaved ? "Saved!" : "Save investigation"}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
