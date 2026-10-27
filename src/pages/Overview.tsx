import { useState, useEffect } from "react";
import type { OverviewStats, SecurityEvent, Device, TrafficData, IconName } from "../types";
import PageHeader from "../components/layout/PageHeader";
import StatCard from "../components/common/StatCard";
import Card, { SectionHead } from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Icon from "../components/common/Icon";
import TrafficChart, { type Timeframe } from "../components/charts/TrafficChart";
import DonutChart from "../components/charts/DonutChart";
import DateRangeModal from "../components/common/DateRangeModal";
import api from "../services/api";

export default function Overview({
  onNavigateToAlerts,
  onNavigateToDevices,
}: {
  onNavigateToAlerts?: () => void;
  onNavigateToDevices?: () => void;
}) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [timeRange, setTimeRange] = useState<"1H" | "24H" | "7D">("24H");
  const [dateRange, setDateRange] = useState("Last 24 hours");
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  const loadData = () => {
    Promise.all([
      api.getOverviewStats(),
      api.getSecurityEvents(10),
      api.getDevices(),
      api.getTrafficData(timeRange),
    ]).then(([statsData, eventsData, devicesData, traffic]) => {
      setStats(statsData);
      setEvents(eventsData);
      setDevices(devicesData);
      setTrafficData(traffic);
    });
  };

  useEffect(() => {
    loadData();

    // In-place tick refresh (does not remount or reset scroll/state)
    const unsubTick = api.onTick(loadData);

    // Subscribe to live WebSocket events to automatically update overview
    const unsubWs = api.subscribeWebSocket((event) => {
      if (event.type === "alert" || event.type === "device" || event.type === "traffic") {
        loadData();
      }
    });

    return () => {
      unsubTick();
      unsubWs();
    };
  }, [timeRange]);

  // Devices ordered with online ones first
  const recentDevices = [...devices]
    .sort((a, b) => (a.status === "Online" ? -1 : 1))
    .slice(0, 4);

  const topDevices = trafficData?.activeDevices || [];

  return (
    <>
      <PageHeader
        title="Network Overview"
        subtitle="Monitor your network activity and security status in real time."
      >
        <Button
          variant="secondary"
          icon="calendar"
          onClick={() => setIsDateModalOpen(true)}
        >
          {dateRange}
        </Button>
      </PageHeader>

      <div className="stats-grid five">
        <StatCard
          label="Connected Devices"
          value={stats ? stats.connectedDevices : 0}
          detail={stats ? `${stats.onlineDevices} online` : "No devices"}
          icon="devices"
        />
        <StatCard
          label="Online Devices"
          value={stats ? stats.onlineDevices : 0}
          detail={`${stats ? stats.availabilityRate : 0}% availability`}
          icon="wifi"
        />
        <StatCard
          label="Network Traffic"
          value={stats ? `${stats.networkTrafficGB} GB` : "0 GB"}
          detail={`${stats && stats.trafficDeltaPercent >= 0 ? "+" : ""}${stats ? stats.trafficDeltaPercent : 0}% vs previous`}
          icon="traffic"
        />
        <StatCard
          label="Active Alerts"
          value={stats ? stats.activeAlerts : 0}
          detail={stats && stats.activeAlerts > 0 ? "Requires review" : "All clear"}
          icon="bell"
          tone={stats && stats.activeAlerts > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Suspicious Events"
          value={stats ? stats.suspiciousEvents24h : 0}
          detail="Last 24 hours"
          icon="shield"
          tone={stats && stats.suspiciousEvents24h > 0 ? "warning" : "default"}
        />
      </div>

      <div className="overview-grid">
        <Card className="traffic-card">
          <SectionHead
            title="Network Traffic"
            subtitle="Total bandwidth utilization across monitored interfaces"
            action={
              <div className="segmented">
                {(["1H", "24H", "7D"] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={timeRange === tf ? "active" : ""}
                    onClick={() => setTimeRange(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            }
          />
          <div className="legend-row">
            <span>
              <i className="legend-dot cyan" />
              Incoming: <strong>{trafficData?.incomingTotal || "0 B"}</strong>
            </span>
            <span>
              <i className="legend-dot ice" />
              Outgoing: <strong>{trafficData?.outgoingTotal || "0 B"}</strong>
            </span>
            <strong style={{ transition: "all 0.2s ease" }}>
              {trafficData?.totalVolume ? `${trafficData.totalVolume} total` : "0 B total"}
            </strong>
          </div>
          <TrafficChart timeframe={timeRange as Timeframe} timeline={trafficData?.timeline} />
        </Card>

        <Card>
          <SectionHead
            title="Protocol Distribution"
            subtitle="Hover over segments to inspect traffic volume"
            action={
              <button className="icon-button" type="button" aria-label="More options">
                <Icon name="more" />
              </button>
            }
          />
          <DonutChart
            segments={trafficData?.protocols || []}
            total={trafficData?.totalVolume}
            totalUnit="total"
          />
        </Card>
      </div>

      <div className="lower-grid">
        <Card className="events-card">
          <SectionHead
            title="Recent Security Events"
            subtitle="Suspicious activity requiring review"
            action={
              <Button variant="ghost" onClick={onNavigateToAlerts}>
                View all <Icon name="arrow" size={14} />
              </Button>
            }
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Source IP</th>
                  <th>Timestamp</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                      No recent security events recorded.
                    </td>
                  </tr>
                ) : (
                  events.map((row) => (
                    <tr key={row.id || row.title} onClick={onNavigateToAlerts} style={{ cursor: "pointer" }}>
                      <td>
                        <span className="event-name">
                          <span className="event-icon">
                            <Icon name="shield" size={15} />
                          </span>
                          {row.title}
                        </span>
                      </td>
                      <td className="mono">{row.sourceIp}</td>
                      <td>{row.timestamp}</td>
                      <td>
                        <Badge tone={row.severity.toLowerCase() as "high" | "medium" | "low"}>
                          {row.severity}
                        </Badge>
                      </td>
                      <td>
                        <span className="status-text">{row.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <SectionHead
              title="Discovered Devices"
              action={
                <button
                  className="text-button"
                  type="button"
                  onClick={onNavigateToDevices}
                >
                  View all
                </button>
              }
            />
            <div className="device-list">
              {recentDevices.length === 0 ? (
                <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                  No devices detected on network yet.
                </div>
              ) : (
                recentDevices.map((d) => (
                  <div className="device-row" key={d.id || d.mac}>
                    <span className="device-icon">
                      <Icon name={(d.icon as IconName) || "laptop"} />
                    </span>
                    <div>
                      <strong>{d.name}</strong>
                      <span>{d.ip} · {d.status}</span>
                    </div>
                    <small>{d.riskLevel} risk</small>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <SectionHead title="Top Network Devices" subtitle="By traffic volume" />
            <div className="bar-list">
              {topDevices.length === 0 ? (
                <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                  No device traffic recorded yet.
                </div>
              ) : (
                topDevices.map((d) => (
                  <div key={d.name}>
                    <span>
                      <strong>{d.name}</strong>
                      <small>{d.value}</small>
                    </span>
                    <div className="bar-track">
                      <i style={{ width: `${d.width}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <DateRangeModal
        currentRange={dateRange}
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onApply={(newRange) => setDateRange(newRange)}
      />
    </>
  );
}
