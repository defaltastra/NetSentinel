import { useEffect } from "react";
import type { SecurityAlert } from "../../types";
import Icon from "./Icon";
import Badge from "./Badge";

interface ToastProps {
  alert: SecurityAlert | null;
  onClose: () => void;
  onInspect: () => void;
}

export default function Toast({ alert, onClose, onInspect }: ToastProps) {
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => {
      onClose();
    }, 8000);
    return () => clearTimeout(timer);
  }, [alert, onClose]);

  if (!alert) return null;

  const severityTone = alert.severity?.toLowerCase() as "critical" | "high" | "medium" | "low";

  return (
    <div className="toast-container" role="alert" aria-live="assertive">
      <div className={`toast-card ${severityTone || "high"}`}>
        <div className="toast-head">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: severityTone === "critical" ? "#ef4444" : "var(--cyan)" }}>
              <Icon name="shield" size={16} />
            </span>
            <Badge tone={severityTone || "high"}>
              {alert.severity} Alert Flagged
            </Badge>
          </div>
          <button
            type="button"
            className="icon-button"
            style={{ width: "22px", height: "22px", border: 0 }}
            onClick={onClose}
            aria-label="Dismiss alert notification"
          >
            <Icon name="x" size={13} />
          </button>
        </div>

        <p className="toast-title">{alert.title}</p>
        <p className="toast-meta">
          <strong>Source:</strong> {alert.sourceIp}{" "}
          {alert.affectedDevice ? `• Target: ${alert.affectedDevice}` : ""}
        </p>

        <div className="toast-actions">
          <button
            type="button"
            className="button primary"
            style={{ height: "26px", padding: "0 10px", fontSize: "10px" }}
            onClick={onInspect}
          >
            Inspect Alert
          </button>
          <button
            type="button"
            className="button ghost"
            style={{ height: "26px", fontSize: "10px", color: "var(--muted)" }}
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
