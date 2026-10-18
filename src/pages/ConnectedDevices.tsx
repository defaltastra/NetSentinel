import { useState, useEffect, useMemo } from "react";
import type { Device } from "../types";
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
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [riskFilter, setRiskFilter] = useState("All risk levels");
  const [isScanning, setIsScanning] = useState(false);

  const loadDevices = () => {
    api.getDevices().then((data) => {
      setDevices(data);
    });
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleScanSubnet = () => {
    setIsScanning(true);
    setTimeout(() => {
      loadDevices();
      setIsScanning(false);
    }, 1200);
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
          <span /> Auto-Discovery: 192.168.1.0/24
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
          value={devices.length || 24}
          detail="Auto-discovered across 3 network segments"
          icon="devices"
        />
        <StatCard
          label="Online"
          value={onlineCount || 21}
          detail="Responding to ICMP/ARP heartbeats"
          icon="wifi"
        />
        <StatCard
          label="Offline"
          value={offlineCount || 3}
          detail="No packet traffic in past 15 min"
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
            <Button variant="secondary" icon="filter">
              Filters
            </Button>
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
              {filteredDevices.map((row) => (
                <tr key={row.id} onClick={() => setSelectedDevice(row)}>
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
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>
            Showing 1–{filteredDevices.length} of {devices.length} discovered devices
          </span>
          <div>
            <Button variant="secondary">Previous</Button>
            <Button variant="secondary">Next</Button>
          </div>
        </div>
      </Card>

      {selectedDevice && (
        <DeviceDrawer
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      )}
    </>
  );
}
