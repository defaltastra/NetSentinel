import { useState, useEffect, useMemo } from "react";
import type { Device, BackendHealth } from "../types";
import PageHeader from "../components/layout/PageHeader";
import StatCard from "../components/common/StatCard";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Icon from "../components/common/Icon";
import { Search, Select } from "../components/common/UIControls";
import DeviceDrawer from "../components/devices/DeviceDrawer";
import api from "../services/api";

export default function ConnectedDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [riskFilter, setRiskFilter] = useState("All risk levels");
  const [isScanning, setIsScanning] = useState(false);

  const loadDevices = () => {
    api.getDevices().then((data) => {
      setDevices(data);
    });
    api.checkHealth().then(() => {
      setHealth(api.getHealthData());
    });
  };

  useEffect(() => {
    loadDevices();

    // In-place tick update
    const unsubTick = api.onTick(loadDevices);

    // Subscribe to live device discovery events via WebSocket
    const unsubWs = api.subscribeWebSocket((event) => {
      if (event.type === "device") {
        loadDevices();
      }
    });

    return () => {
      unsubTick();
      unsubWs();
    };
  }, []);

  const handleScanSubnet = async () => {
    setIsScanning(true);
    try {
      await api.scanNow();
      await loadDevices();
    } catch (err) {
      console.error("Scan subnet error:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.mac.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "All statuses" || d.status === statusFilter;

      const matchesRisk =
        riskFilter === "All risk levels" ||
        d.riskLevel.toLowerCase() === riskFilter.replace(" risk", "").toLowerCase();

      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [devices, searchQuery, statusFilter, riskFilter]);

  const onlineCount = devices.filter((d) => d.status === "Online").length;
  const offlineCount = devices.filter((d) => d.status === "Offline").length;

  const networkLabel = health?.network
    ? `Subnet: ${health.network}${health.interface ? ` (${health.interface})` : ""}`
    : "Subnet Auto-Discovery Active";

  return (
    <>
      <PageHeader
        title="Connected Devices"
        subtitle="Automatic network discovery identifies all active host endpoints across monitored subnets."
      >
        <span
          className="demo-badge"
          style={{
            background: "rgba(15, 164, 175, 0.12)",
            borderColor: "rgba(15, 164, 175, 0.3)",
          }}
        >
          <span /> {networkLabel}
        </span>
        <Button
          variant="secondary"
          icon="refresh"
          onClick={handleScanSubnet}
          disabled={isScanning}
        >
          {isScanning ? "Scanning Subnet..." : "Scan Subnet"}
        </Button>
      </PageHeader>

      <div className="stats-grid three compact-stats">
        <StatCard
          label="Total Devices"
          value={devices.length}
          detail="Active network endpoints recorded"
          icon="devices"
        />
        <StatCard
          label="Online"
          value={onlineCount}
          detail="Responding to ICMP/ARP heartbeats"
          icon="wifi"
        />
        <StatCard
          label="Offline"
          value={offlineCount}
          detail="Inactive or unreachable"
          icon="x"
        />
      </div>

      <Card className="table-card">
        <div className="toolbar">
          <Search
            placeholder="Search devices, IP or MAC..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <div>
            <Select
              label="Device status"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <option value="All statuses">All statuses</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </Select>
            <Select
              label="Risk level"
              value={riskFilter}
              onChange={setRiskFilter}
            >
              <option value="All risk levels">All risk levels</option>
              <option value="High risk">High risk</option>
              <option value="Medium risk">Medium risk</option>
              <option value="Low risk">Low risk</option>
            </Select>
          </div>
        </div>

        <div className="table-wrap devices-table">
          <table>
            <thead>
              <tr>
                <th>Device Name</th>
                <th>IP Address</th>
                <th>MAC Address</th>
                <th>Device Type</th>
                <th>First Discovered</th>
                <th>Status</th>
                <th>Risk Level</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "36px", color: "var(--muted)" }}>
                    {searchQuery || statusFilter !== "All statuses" || riskFilter !== "All risk levels"
                      ? "No devices match your search or filter criteria."
                      : "No devices discovered yet. Click 'Scan Subnet' to discover local devices."}
                  </td>
                </tr>
              ) : (
                filteredDevices.map((row) => (
                  <tr key={row.id || row.mac} onClick={() => setSelectedDevice(row)} style={{ cursor: "pointer" }}>
                    <td>
                      <span className="device-name">
                        <span className="device-icon">
                          <Icon name={row.icon} />
                        </span>
                        <strong>{row.name}</strong>
                      </span>
                    </td>
                    <td className="mono">{row.ip}</td>
                    <td className="mono muted">{row.mac}</td>
                    <td>{row.type}</td>
                    <td>{row.firstSeen}</td>
                    <td>
                      <Badge tone={row.status === "Online" ? "success" : "neutral"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={row.riskLevel.toLowerCase() as "high" | "medium" | "low"}>
                        {row.riskLevel}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label="Actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDevice(row);
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

        <div className="pagination">
          <span>
            Showing 1–{filteredDevices.length} of {devices.length} discovered devices
          </span>
        </div>
      </Card>

      {selectedDevice && (
        <DeviceDrawer
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onDeviceUpdated={(updated) => {
            setSelectedDevice(updated);
            loadDevices();
          }}
        />
      )}
    </>
  );
}
