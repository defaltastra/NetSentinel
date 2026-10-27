import { useState } from "react";
import type { Device } from "../../types";
import Icon from "../common/Icon";
import Badge from "../common/Badge";
import Button from "../common/Button";
import Card, { SectionHead } from "../common/Card";
import TrafficChart from "../charts/TrafficChart";
import api from "../../services/api";

interface DeviceDrawerProps {
  device: Device;
  onClose: () => void;
  onDeviceUpdated?: (updated: Device) => void;
}

export default function DeviceDrawer({ device, onClose, onDeviceUpdated }: DeviceDrawerProps) {
  const [isTrusting, setIsTrusting] = useState(false);
  const connections = device.observedConnections || [];

  const handleTrust = async () => {
    setIsTrusting(true);
    try {
      const updated = await api.trustDevice(device.id || device.mac);
      if (updated && onDeviceUpdated) {
        onDeviceUpdated(updated);
      }
    } catch (err) {
      console.error("Trust failed:", err);
    } finally {
      setIsTrusting(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-title">
            <span className="device-icon large">
              <Icon name={device.icon || "laptop"} />
            </span>
            <div>
              <h2>{device.name}</h2>
              <Badge tone={device.status === "Online" ? "success" : "neutral"}>
                {device.status}
              </Badge>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close drawer">
            <Icon name="x" />
          </button>
        </div>
        <div className="drawer-body">
          <div className="info-grid">
            <div>
              <span>IP Address</span>
              <strong>{device.ip}</strong>
            </div>
            <div>
              <span>Risk level</span>
              <Badge tone={device.riskLevel.toLowerCase() as "low" | "medium" | "high" | "critical"}>
                {device.riskLevel}
              </Badge>
            </div>
            <div>
              <span>MAC Address</span>
              <strong>{device.mac}</strong>
            </div>
            <div>
              <span>First seen</span>
              <strong>{device.firstSeen}</strong>
            </div>
          </div>

          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <Button
              variant="secondary"
              icon="check"
              onClick={handleTrust}
              disabled={isTrusting}
            >
              {isTrusting ? "Marking Trusted..." : "Mark as Trusted Baseline"}
            </Button>
          </div>

          <div style={{ marginTop: "16px" }}>
            <Card>
              <SectionHead title="Traffic statistics" subtitle="Last 24 hours" />
              <div className="mini-stats">
                <div>
                  <span>Incoming</span>
                  <strong>{device.incomingTraffic || "0 B"}</strong>
                </div>
                <div>
                  <span>Outgoing</span>
                  <strong>{device.outgoingTraffic || "0 B"}</strong>
                </div>
              </div>
              <TrafficChart compact />
            </Card>
          </div>

          <div className="detail-section">
            <h3>Observed connections</h3>
            {connections.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: "12px", padding: "8px 0" }}>
                No active connections recorded for this device.
              </div>
            ) : (
              connections.map((x, idx) => (
                <div className="connection-row" key={`${x.host}-${idx}`}>
                  <span className="connection-dot" />
                  <strong>{x.host}</strong>
                  <small>{x.protocol}</small>
                </div>
              ))
            )}
          </div>

          <div className="detail-section">
            <h3>Associated security alerts</h3>
            <div className="alert-note">
              <Icon name="shield" />
              <div>
                <strong>
                  {device.riskLevel === "High" || device.riskLevel === "Critical"
                    ? "Active Alert Flagged"
                    : "No active alerts"}
                </strong>
                <span>
                  {device.riskLevel === "High" || device.riskLevel === "Critical"
                    ? "Investigation in progress. Check the Security Alerts tab for details."
                    : "This device has no unresolved security alerts."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
