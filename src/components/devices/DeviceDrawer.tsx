import type { Device } from "../../types";
import Icon from "../common/Icon";
import Badge from "../common/Badge";
import Card, { SectionHead } from "../common/Card";
import TrafficChart from "../charts/TrafficChart";

interface DeviceDrawerProps {
  device: Device;
  onClose: () => void;
}

export default function DeviceDrawer({ device, onClose }: DeviceDrawerProps) {
  const connections = device.observedConnections || [
    { host: "api.github.com", protocol: "HTTPS · 443" },
    { host: "cloudflare.com", protocol: "HTTPS · 443" },
    { host: "10.0.0.18", protocol: "SMB · 445" },
  ];

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

          <Card>
            <SectionHead title="Traffic statistics" subtitle="Last 24 hours" />
            <div className="mini-stats">
              <div>
                <span>Incoming</span>
                <strong>{device.incomingTraffic || "286 MB"}</strong>
              </div>
              <div>
                <span>Outgoing</span>
                <strong>{device.outgoingTraffic || "102 MB"}</strong>
              </div>
            </div>
            <TrafficChart compact />
          </Card>

          <div className="detail-section">
            <h3>Observed connections</h3>
            {connections.map((x) => (
              <div className="connection-row" key={x.host}>
                <span className="connection-dot" />
                <strong>{x.host}</strong>
                <small>{x.protocol}</small>
              </div>
            ))}
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
                    ? "Investigation in progress. Check Security Alerts tab."
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
