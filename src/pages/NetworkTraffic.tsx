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

export default function NetworkTraffic() {
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [records, setRecords] = useState<TrafficRecord[]>([]);
  const [timeRange, setTimeRange] = useState<Timeframe>("24H");
  const [search, setSearch] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("All protocols");
  const [directionFilter, setDirectionFilter] = useState("Any direction");
  const [maxLimit, setMaxLimit] = useState<number>(25);

  const loadTraffic = (range: Timeframe) => {
    Promise.all([api.getTrafficData(range), api.getTrafficRecords(100)]).then(
      ([traffic, recs]) => {
        setTrafficData(traffic);
        setRecords(recs);
      }
    );
  };

  useEffect(() => {
    loadTraffic(timeRange);

    // In-place tick update
    const unsubTick = api.onTick(() => {
      loadTraffic(timeRange);
    });

    const unsubWs = api.subscribeWebSocket((event) => {
      if (event.type === "traffic") {
        loadTraffic(timeRange);
      }
    });

    return () => {
      unsubTick();
      unsubWs();
    };
  }, [timeRange]);

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
          value={trafficData?.incomingTotal || "0 B"}
          detail={`Total incoming in ${timeRange}`}
          icon="download"
        />
        <StatCard
          label="Outgoing Traffic"
          value={trafficData?.outgoingTotal || "0 B"}
          detail={`Total outgoing in ${timeRange}`}
          icon="traffic"
        />
        <StatCard
          label="Peak Throughput"
          value={trafficData?.peakThroughput || "0 bps"}
          detail={`Peak throughput in ${timeRange}`}
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
            Incoming: <strong>{trafficData?.incomingTotal || "0 B"}</strong>
          </span>
          <span>
            <i className="legend-dot ice" />
            Outgoing: <strong>{trafficData?.outgoingTotal || "0 B"}</strong>
          </span>
        </div>
        <TrafficChart timeframe={timeRange} timeline={trafficData?.timeline} />
      </Card>

      <div className="analytics-grid">
        <Card>
          <SectionHead title="Protocol Distribution" subtitle="Hover to view percentage" />
          <DonutChart
            segments={trafficData?.protocols || []}
            total={trafficData?.totalVolume}
            totalUnit="total"
          />
        </Card>
        <Card>
          <SectionHead title="Top Source IPs" subtitle="By total transfer" />
          {trafficData?.topSources && trafficData.topSources.length > 0 ? (
            <RankList items={trafficData.topSources} />
          ) : (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
              No traffic sources recorded yet.
            </div>
          )}
        </Card>
        <Card>
          <SectionHead title="Most Active Devices" subtitle="Connections in selected period" />
          {trafficData?.activeDevices && trafficData.activeDevices.length > 0 ? (
            <RankList items={trafficData.activeDevices} />
          ) : (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
              No active devices recorded yet.
            </div>
          )}
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
            <Select
              label="Max rows"
              value={String(maxLimit)}
              onChange={(val) => setMaxLimit(Number(val))}
            >
              <option value="15">Max: 15 rows</option>
              <option value="25">Max: 25 rows</option>
              <option value="50">Max: 50 rows</option>
              <option value="100">Max: 100 rows</option>
              <option value="500">All (500 max)</option>
            </Select>
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
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                    {search || protocolFilter !== "All protocols" || directionFilter !== "Any direction"
                      ? "No connection records match the filter."
                      : "No connection traffic recorded yet."}
                  </td>
                </tr>
              ) : (
                filteredRecords.slice(0, maxLimit).map((r) => (
                  <tr key={r.id}>
                    <td>{r.timestamp}</td>
                    <td className="mono">{r.sourceIp}</td>
                    <td className="mono">{r.destinationIp}</td>
                    <td>
                      <Badge tone="cyan">{r.protocol}</Badge>
                    </td>
                    <td className="mono">{r.port}</td>
                    <td>{r.packetSize}</td>
                    <td>
                      <Badge tone={r.direction === "Incoming" ? "cyan" : "neutral"}>
                        {r.direction}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--muted)", fontSize: "10px" }}>
          <span>
            Showing {Math.min(filteredRecords.length, maxLimit)} of {filteredRecords.length} records (Max limit: {maxLimit})
          </span>
        </div>
      </Card>
    </>
  );
}
