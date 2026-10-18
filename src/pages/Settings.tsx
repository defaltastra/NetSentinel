import { useState, useEffect } from "react";
import type { WorkspaceSettings, IconName } from "../types";
import PageHeader from "../components/layout/PageHeader";
import Card, { SectionHead } from "../components/common/Card";
import Button from "../components/common/Button";
import Icon from "../components/common/Icon";
import Badge from "../components/common/Badge";
import { Select, Toggle } from "../components/common/UIControls";
import api from "../services/api";

function SettingRow({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <span>{copy}</span>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("General Preferences");
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Minimal Tab States
  const [subnet, setSubnet] = useState("192.168.1.0/24");
  const [scanInterval, setScanInterval] = useState("Every 30 seconds");
  const [inspectionMode, setInspectionMode] = useState("Passive Sniffing");
  const [autoQuarantine, setAutoQuarantine] = useState(false);

  const [spikeThreshold, setSpikeThreshold] = useState("4.0x baseline");
  const [portScanSens, setPortScanSens] = useState("High (3+ ports/sec)");
  const [dpiEnabled, setDpiEnabled] = useState(true);
  const [ignoreBroadcast, setIgnoreBroadcast] = useState(true);

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [minSeverity, setMinSeverity] = useState("High & Critical only");
  const [soundAlerts, setSoundAlerts] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getSettings().then((data) => {
      if (mounted) setSettings(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (settings) {
      await api.updateSettings(settings);
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2200);
  };

  const tabs: { name: string; icon: IconName }[] = [
    { name: "General Preferences", icon: "settings" },
    { name: "Network Monitoring", icon: "wifi" },
    { name: "Detection Rules", icon: "shield" },
    { name: "Alert Preferences", icon: "bell" },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure monitoring behavior, detection policies, and workspace preferences."
      />

      <div className="settings-layout">
        <Card className="settings-nav">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              type="button"
              className={activeTab === tab.name ? "active" : ""}
              onClick={() => setActiveTab(tab.name)}
            >
              <Icon name={tab.icon} />
              {tab.name}
              <Icon name="arrow" size={14} />
            </button>
          ))}
        </Card>

        <Card className="settings-panel">
          {/* TAB 1: General Preferences */}
          {activeTab === "General Preferences" && (
            <>
              <SectionHead
                title="General Preferences"
                subtitle="Manage display formats, table density, and workspace identity."
              />
              <div className="settings-section">
                <h3>Workspace Profile</h3>
                <div className="form-grid">
                  <label>
                    <span>Workspace Name</span>
                    <input
                      value={settings?.workspaceName || "NetSentinel Operations"}
                      onChange={(e) =>
                        setSettings((prev) =>
                          prev ? { ...prev, workspaceName: e.target.value } : null
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Timezone</span>
                    <Select
                      label="Timezone"
                      value={settings?.timezone}
                      onChange={(val) =>
                        setSettings((prev) => (prev ? { ...prev, timezone: val } : null))
                      }
                    >
                      <option value="UTC−05:00 · Eastern Time">UTC−05:00 · Eastern Time</option>
                      <option value="UTC · Coordinated Universal Time">UTC · Universal Time</option>
                      <option value="UTC+01:00 · Central European Time">UTC+01:00 · Central European</option>
                    </Select>
                  </label>
                </div>
              </div>

              <div className="settings-section">
                <h3>Display Defaults</h3>
                <SettingRow
                  title="Compact table density"
                  copy="Display tighter row spacing in device and packet tables."
                >
                  <Toggle
                    on={settings?.compactTableDensity ?? true}
                    onChange={(val) =>
                      setSettings((prev) =>
                        prev ? { ...prev, compactTableDensity: val } : null
                      )
                    }
                  />
                </SettingRow>
                <SettingRow
                  title="Protocol color badges"
                  copy="Highlight protocols with distinctive cyber color tags."
                >
                  <Toggle
                    on={settings?.showProtocolLabels ?? true}
                    onChange={(val) =>
                      setSettings((prev) =>
                        prev ? { ...prev, showProtocolLabels: val } : null
                      )
                    }
                  />
                </SettingRow>
              </div>
            </>
          )}

          {/* TAB 2: Network Monitoring */}
          {activeTab === "Network Monitoring" && (
            <>
              <SectionHead
                title="Network Monitoring"
                subtitle="Configure subnets for automatic discovery and packet capture."
              />
              <div className="settings-section">
                <h3>Subnet Discovery</h3>
                <div className="form-grid">
                  <label>
                    <span>Monitored CIDR Subnet</span>
                    <input
                      value={subnet}
                      onChange={(e) => setSubnet(e.target.value)}
                      placeholder="192.168.1.0/24"
                    />
                  </label>
                  <label>
                    <span>Scan Heartbeat Interval</span>
                    <Select
                      label="Scan Interval"
                      value={scanInterval}
                      onChange={setScanInterval}
                    >
                      <option value="Every 30 seconds">Every 30 seconds (Live)</option>
                      <option value="Every minute">Every minute</option>
                      <option value="Every 5 minutes">Every 5 minutes</option>
                    </Select>
                  </label>
                </div>
              </div>

              <div className="settings-section">
                <h3>Inspection Strategy</h3>
                <div className="form-grid">
                  <label>
                    <span>Packet Sniffing Mode</span>
                    <Select
                      label="Inspection Mode"
                      value={inspectionMode}
                      onChange={setInspectionMode}
                    >
                      <option value="Passive Sniffing">Passive Promiscuous Sniffing</option>
                      <option value="Active Probing">Active ARP/ICMP Probing</option>
                      <option value="Hybrid">Hybrid (Recommended)</option>
                    </Select>
                  </label>
                </div>
                <div style={{ marginTop: "14px" }}>
                  <SettingRow
                    title="Auto-quarantine unknown devices"
                    copy="Automatically flag any new unauthenticated MAC address as high risk."
                  >
                    <Toggle on={autoQuarantine} onChange={setAutoQuarantine} />
                  </SettingRow>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: Detection Rules */}
          {activeTab === "Detection Rules" && (
            <>
              <SectionHead
                title="Detection Rules & Heuristics"
                subtitle="Fine-tune anomaly triggers and threshold sensitivity."
              />
              <div className="settings-section">
                <h3>Anomaly Thresholds</h3>
                <div className="form-grid">
                  <label>
                    <span>Traffic Outlier Spike Threshold</span>
                    <Select
                      label="Spike Threshold"
                      value={spikeThreshold}
                      onChange={setSpikeThreshold}
                    >
                      <option value="2.5x baseline">2.5× baseline (Sensitive)</option>
                      <option value="4.0x baseline">4.0× baseline (Balanced)</option>
                      <option value="6.0x baseline">6.0× baseline (Conservative)</option>
                    </Select>
                  </label>
                  <label>
                    <span>Port Scan Sensitivity</span>
                    <Select
                      label="Port Scan Sensitivity"
                      value={portScanSens}
                      onChange={setPortScanSens}
                    >
                      <option value="High (3+ ports/sec)">High (3+ ports/sec)</option>
                      <option value="Medium (10+ ports/sec)">Medium (10+ ports/sec)</option>
                      <option value="Low (30+ ports/sec)">Low (30+ ports/sec)</option>
                    </Select>
                  </label>
                </div>
              </div>

              <div className="settings-section">
                <h3>Filter Rules</h3>
                <SettingRow
                  title="TLS Certificate SNI Inspection"
                  copy="Extract host domains from encrypted TLS handshakes."
                >
                  <Toggle on={dpiEnabled} onChange={setDpiEnabled} />
                </SettingRow>
                <SettingRow
                  title="Ignore local ARP/mDNS broadcast storms"
                  copy="Suppress low-priority alerts from standard printer & TV broadcasts."
                >
                  <Toggle on={ignoreBroadcast} onChange={setIgnoreBroadcast} />
                </SettingRow>
              </div>
            </>
          )}

          {/* TAB 4: Alert Preferences */}
          {activeTab === "Alert Preferences" && (
            <>
              <SectionHead
                title="Alert Preferences"
                subtitle="Configure notification dispatch and severity escalation."
              />
              <div className="settings-section">
                <h3>Delivery Rules</h3>
                <div className="form-grid">
                  <label>
                    <span>Minimum Escalation Severity</span>
                    <Select
                      label="Severity"
                      value={minSeverity}
                      onChange={setMinSeverity}
                    >
                      <option value="Critical only">Critical Only</option>
                      <option value="High & Critical only">High & Critical Only</option>
                      <option value="All severities">All Severities (Verbose)</option>
                    </Select>
                  </label>
                </div>
              </div>

              <div className="settings-section">
                <h3>Notification Channels</h3>
                <SettingRow
                  title="Email summary digests"
                  copy="Send hourly incident digests to SOC administrators."
                >
                  <Toggle on={emailAlerts} onChange={setEmailAlerts} />
                </SettingRow>
                <SettingRow
                  title="Audible alert on Critical threat"
                  copy="Play sound warning when a high-priority threat is detected."
                >
                  <Toggle on={soundAlerts} onChange={setSoundAlerts} />
                </SettingRow>
              </div>
            </>
          )}



          {/* Save Action Bar */}
          <div className="settings-save">
            <span>All changes are automatically synced</span>
            <Button onClick={handleSave}>
              {isSaved ? "Saved Successfully!" : "Save changes"}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
