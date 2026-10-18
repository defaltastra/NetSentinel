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

export interface TrafficData {
  incomingTotal: string;
  outgoingTotal: string;
  peakThroughput: string;
  totalVolume: string;
  protocols: ProtocolStat[];
  topSources: { name: string; value: string; width: number }[];
  activeDevices: { name: string; value: string; width: number }[];
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
  usingMock: boolean;
  error?: string;
  backendUrl: string;
};
