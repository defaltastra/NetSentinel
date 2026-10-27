import type { ReactNode } from "react";

export type Page =
  | "Overview"
  | "Connected Devices"
  | "Network Traffic"
  | "Security Alerts"
  | "Reports"
  | "Settings";

export type IconName =
  | "grid"
  | "devices"
  | "traffic"
  | "shield"
  | "report"
  | "settings"
  | "search"
  | "bell"
  | "calendar"
  | "download"
  | "plus"
  | "arrow"
  | "wifi"
  | "laptop"
  | "phone"
  | "printer"
  | "server"
  | "more"
  | "filter"
  | "check"
  | "x"
  | "refresh";

export type RiskLevel = "Critical" | "High" | "Medium" | "Low";
export type DeviceStatus = "Online" | "Offline";
export type AlertSeverity = "Critical" | "High" | "Medium" | "Low";
export type AlertStatus = "Open" | "Investigating" | "Resolved";

export interface Device {
  id: string;
  name: string;
  ip: string;
  mac: string;
  type: string;
  firstSeen: string;
  status: DeviceStatus;
  riskLevel: RiskLevel;
  icon: IconName;
  incomingTraffic?: string;
  outgoingTraffic?: string;
  observedConnections?: { host: string; protocol: string }[];
}

export interface SecurityEvent {
  id: string;
  title: string;
  sourceIp: string;
  timestamp: string;
  severity: AlertSeverity;
  status: AlertStatus;
}

export interface SecurityAlert {
  id: string;
  alertId: string;
  title: string;
  severity: AlertSeverity;
  affectedDevice: string;
  sourceIp: string;
  destinationIp: string;
  timeDetected: string;
  status: AlertStatus;
  description: string;
  evidence: {
    transferVolume: string;
    baselineVariance: string;
    destinationReputation: string;
  };
  recommendations: string[];
}

export interface TrafficRecord {
  id: string;
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  port: string;
  packetSize: string;
  direction: "Incoming" | "Outgoing";
}

export interface OverviewStats {
  connectedDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  networkTrafficGB: number;
  activeAlerts: number;
  suspiciousEvents24h: number;
  availabilityRate: number;
  trafficDeltaPercent: number;
}

export interface ProtocolStat {
  name: string;
  value: number;
  color: "cyan" | "ice" | "teal" | "rust" | "muted";
}

export interface TrafficTimelinePoint {
  ts: number;
  time: string;
  bytes: number;
  packets: number;
}

export interface TrafficData {
  incomingTotal: string;
  outgoingTotal: string;
  peakThroughput: string;
  totalVolume: string;
  protocols: ProtocolStat[];
  topSources: { name: string; value: string; width: number }[];
  activeDevices: { name: string; value: string; width: number }[];
  timeline?: TrafficTimelinePoint[];
}

export interface ReportSummary {
  generated_at: string;
  hours: number;
  score: number;
  alerts_total: number;
  alerts_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  alerts_by_type: { type: string; label: string; count: number }[];
  devices_total: number;
  devices_new: any[];
  protocols: {
    tcp: number;
    udp: number;
    dns: number;
    icmp: number;
    arp: number;
    other: number;
  };
  packets: number;
  bytes: number;
  top_sources: { ip: string; packets: number; bytes: number }[];
  recent_alerts: any[];
  recommendations: { type: string; label: string; count: number; advice: string }[];
}

export interface BackendHealth {
  status: string;
  mode: string;
  interface: string | null;
  network: string | null;
  uptime_s: number;
  refresh_interval?: number;
  capture_error: string | null;
  scan_error: string | null;
  ml_ready: boolean;
}

export interface ReportItem {
  id: string;
  name: string;
  period: string;
  generatedAt: string;
  format: "PDF" | "CSV";
  status: "Ready" | "Generating" | "Failed";
}

export interface WorkspaceSettings {
  workspaceName: string;
  timezone: string;
  defaultReportRange: string;
  refreshInterval: string;
  compactTableDensity: boolean;
  showProtocolLabels: boolean;
  demoModeIndicator: boolean;
  dateFormat: string;
  trafficUnits: string;
}

export type BackendConnectionState = {
  isLive: boolean;
  isChecking: boolean;
  error?: string;
  backendUrl: string;
};
