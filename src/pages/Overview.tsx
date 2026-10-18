import { useState, useEffect } from "react";
import type { OverviewStats, SecurityEvent, IconName } from "../types";
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

const totalsByTimeframe: Record<"1H" | "24H" | "7D", string> = {
  "1H": "482 MB total",
  "24H": "2.94 GB total",
  "7D": "19.4 GB total",
};

export default function Overview({
  onNavigateToAlerts,
  onNavigateToDevices,
}: {
  onNavigateToAlerts?: () => void;
  onNavigateToDevices?: () => void;
}) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [timeRange, setTimeRange] = useState<"1H" | "24H" | "7D">("24H");
  const [dateRange, setDateRange] = useState("May 18 – May 24, 2025");
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.getOverviewStats(), api.getSecurityEvents()]).then(
      ([statsData, eventsData]) => {
        if (mounted) {
          setStats(statsData);
          setEvents(eventsData);
        }
      }
    );
    return () => {
      mounted = false;
    };
  }, []);

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
          value={stats ? stats.connectedDevices : "24"}
          detail="+3 this week"
          icon="devices"
        />
        <StatCard
          label="Online Devices"
          value={stats ? stats.onlineDevices : "21"}
          detail={`${stats ? stats.availabilityRate : "87.5"}% availability`}
          icon="wifi"
        />
        <StatCard
          label="Network Traffic"
          value={stats ? `${stats.networkTrafficGB} GB` : "1.8 GB"}
          detail={`+${stats ? stats.trafficDeltaPercent : "12.4"}% vs yesterday`}
          icon="traffic"
        />
        <StatCard
          label="Active Alerts"
          value={stats ? stats.activeAlerts : "6"}
          detail="2 require attention"
          icon="bell"
          tone="warning"
        />
        <StatCard
          label="Suspicious Events"
          value={stats ? stats.suspiciousEvents24h : "12"}
          detail="Last 24 hours"
          icon="shield"
          tone="warning"
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
              Incoming
            </span>
            <span>
              <i className="legend-dot ice" />
              Outgoing
            </span>
            <strong style={{ transition: "all 0.2s ease" }}>
              {totalsByTimeframe[timeRange]}
            </strong>
          </div>
          <TrafficChart timeframe={timeRange as Timeframe} />
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
          <DonutChart />
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
                {events.map((row) => (
                  <tr key={row.id || row.title} onClick={onNavigateToAlerts}>
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
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <SectionHead
              title="Recently Connected"
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
              {[
                { name: "MacBook Pro", ip: "192.168.1.47", icon: "laptop" as IconName },
                { name: "Pixel 8", ip: "192.168.1.82", icon: "phone" as IconName },
                { name: "Office Printer", ip: "192.168.1.16", icon: "printer" as IconName },
              ].map((d) => (
                <div className="device-row" key={d.name}>
                  <span className="device-icon">
                    <Icon name={d.icon} />
                  </span>
                  <div>
                    <strong>{d.name}</strong>
                    <span>{d.ip}</span>
                  </div>
                  <small>Just now</small>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHead title="Top Network Devices" subtitle="By traffic volume" />
            <div className="bar-list">
              {[
                { name: "Design-Workstation", value: "842 MB", width: 92 },
                { name: "Media-Server", value: "621 MB", width: 70 },
                { name: "MacBook-Pro", value: "388 MB", width: 45 },
              ].map((d) => (
                <div key={d.name}>
                  <span>
                    <strong>{d.name}</strong>
                    <small>{d.value}</small>
                  </span>
                  <div className="bar-track">
                    <i style={{ width: `${d.width}%` }} />
                  </div>
                </div>
              ))}
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
