import { useState, useEffect } from "react";
import type { TrafficData, TrafficRecord } from "../types";
import PageHeader from "../components/layout/PageHeader";
import StatCard from "../components/common/StatCard";
import Card, { SectionHead } from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import { Search, Select } from "../components/common/UIControls";
import TrafficChart, { type Timeframe } from "../components/charts/TrafficChart";
import DonutChart from "../components/charts/DonutChart";
import { exportToCsv } from "../utils/export";
import api from "../services/api";

function RankList({ items }: { items: { name: string; value: string; width: number }[] }) {
  return (
    <div className="rank-list">
      {items.map((item, i) => (
        <div key={item.name}>
          <span className="rank">{i + 1}</span>
          <div>
            <span>
              <strong>{item.name}</strong>
              <small>{item.value}</small>
            </span>
            <div className="bar-track">
              <i style={{ width: `${item.width}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const metricsByTimeframe: Record<
  Timeframe,
  { incoming: string; outgoing: string; peak: string }
> = {
  "1H": { incoming: "310 MB", outgoing: "172 MB", peak: "38.2 Mbps" },
  "24H": { incoming: "1.82 GB", outgoing: "1.12 GB", peak: "86.4 Mbps" },
  "7D": { incoming: "12.8 GB", outgoing: "6.6 GB", peak: "124.0 Mbps" },
  "30D": { incoming: "48.6 GB", outgoing: "29.6 GB", peak: "148.5 Mbps" },
};

export default function NetworkTraffic() {
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [records, setRecords] = useState<TrafficRecord[]>([]);
  const [timeRange, setTimeRange] = useState<Timeframe>("24H");
  const [search, setSearch] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("All protocols");
  const [directionFilter, setDirectionFilter] = useState("Any direction");

  useEffect(() => {
    let mounted = true;
    Promise.all([api.getTrafficData(), api.getTrafficRecords()]).then(
      ([traffic, recs]) => {
        if (mounted) {
          setTrafficData(traffic);
          setRecords(recs);
        }
      }
    );
    return () => {
      mounted = false;
    };
  }, []);

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.sourceIp.includes(search) ||
      r.destinationIp.includes(search) ||
      r.protocol.toLowerCase().includes(search.toLowerCase());
    const matchesProtocol =
      protocolFilter === "All protocols" || r.protocol === protocolFilter;
    const matchesDirection =
      directionFilter === "Any direction" || r.direction === directionFilter;
    return matchesSearch && matchesProtocol && matchesDirection;
  });

  const handleExportTraffic = () => {
    const headers = ["Timestamp", "Source IP", "Destination IP", "Protocol", "Port", "Packet Size", "Direction"];
    const rows = filteredRecords.map((r) => [
      r.timestamp,
      r.sourceIp,
      r.destinationIp,
      r.protocol,
      r.port,
      r.packetSize,
      r.direction,
    ]);
    exportToCsv("netsentinel_network_traffic.csv", rows, headers);
  };

  const currentMetrics = metricsByTimeframe[timeRange];

  return (
    <>
      <PageHeader
        title="Network Traffic"
        subtitle="Analyze traffic patterns, protocols, and active connections in real time."
      >
        <Button variant="secondary" icon="download" onClick={handleExportTraffic}>
          Export traffic
        </Button>
        <Button icon="calendar">Range: {timeRange}</Button>
      </PageHeader>

      <div className="stats-grid three compact-stats">
        <StatCard
          label="Incoming Traffic"
          value={currentMetrics.incoming}
          detail={`Total in selected ${timeRange}`}
          icon="download"
        />
        <StatCard
          label="Outgoing Traffic"
          value={currentMetrics.outgoing}
          detail={`Total in selected ${timeRange}`}
          icon="traffic"
        />
        <StatCard
          label="Peak Throughput"
          value={currentMetrics.peak}
          detail={`Peak recorded during ${timeRange}`}
          icon="wifi"
        />
      </div>

      <Card className="traffic-card full">
        <SectionHead
          title="Traffic Over Time"
          subtitle="Bandwidth utilization across all monitored interfaces — hover over the curve to inspect"
          action={
            <div className="segmented">
              {(["1H", "24H", "7D", "30D"] as const).map((tf) => (
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
            Incoming: <strong>{currentMetrics.incoming}</strong>
          </span>
          <span>
            <i className="legend-dot ice" />
            Outgoing: <strong>{currentMetrics.outgoing}</strong>
          </span>
        </div>
        <TrafficChart timeframe={timeRange} />
      </Card>

      <div className="analytics-grid">
        <Card>
          <SectionHead title="Protocol Distribution" subtitle="Hover to view percentage" />
          <DonutChart segments={trafficData?.protocols} />
        </Card>
        <Card>
          <SectionHead title="Top Source IPs" subtitle="By total transfer" />
          <RankList
            items={
              trafficData?.topSources || [
                { name: "192.168.1.47", value: "842 MB", width: 92 },
                { name: "10.0.0.18", value: "621 MB", width: 73 },
                { name: "192.168.1.22", value: "388 MB", width: 52 },
                { name: "172.16.0.14", value: "244 MB", width: 35 },
              ]
            }
          />
        </Card>
        <Card>
          <SectionHead title="Most Active Devices" subtitle="Connections in last 24h" />
          <RankList
            items={
              trafficData?.activeDevices || [
                { name: "Design Workstation", value: "4,218", width: 96 },
                { name: "Media Server", value: "3,082", width: 71 },
                { name: "Alex’s MacBook", value: "2,441", width: 58 },
                { name: "Jordan’s Pixel", value: "1,208", width: 31 },
              ]
            }
          />
        </Card>
      </div>

      <Card className="table-card">
        <SectionHead title="Traffic Records" subtitle="Detailed network connection log" />
        <div className="toolbar">
          <Search
            placeholder="Search by device or IP..."
            value={search}
            onChange={setSearch}
          />
          <div>
            <Select
              label="Protocol"
              value={protocolFilter}
              onChange={setProtocolFilter}
            >
              <option value="All protocols">All protocols</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="HTTPS">HTTPS</option>
              <option value="HTTP">HTTP</option>
              <option value="DNS">DNS</option>
            </Select>
            <Select
              label="Direction"
              value={directionFilter}
              onChange={setDirectionFilter}
            >
              <option value="Any direction">Any direction</option>
              <option value="Incoming">Incoming</option>
              <option value="Outgoing">Outgoing</option>
            </Select>
            <Button variant="secondary" icon="filter">
              More filters
            </Button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Timestamp",
                  "Source IP",
                  "Destination IP",
                  "Protocol",
                  "Port",
                  "Packet Size",
                  "Direction",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r.id}>
                  <td>{r.timestamp}</td>
                  <td className="mono">{r.sourceIp}</td>
                  <td className="mono">{r.destinationIp}</td>
                  <td>
                    <Badge tone="cyan">{r.protocol}</Badge>
                  </td>
                  <td>{r.port}</td>
                  <td>{r.packetSize}</td>
                  <td>
                    <span className={`direction ${r.direction.toLowerCase()}`}>
                      {r.direction}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
