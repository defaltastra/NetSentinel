import type {
  OverviewStats,
  Device,
  SecurityEvent,
  SecurityAlert,
  TrafficData,
  TrafficRecord,
  ReportItem,
  ReportSummary,
  WorkspaceSettings,
  AlertStatus,
  BackendHealth,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export interface WebSocketEvent {
  type: "alert" | "device" | "traffic" | string;
  data: any;
}

class ApiService {
  private isBackendOnline: boolean = false;
  private healthData: BackendHealth | null = null;
  private listeners: Array<(online: boolean) => void> = [];
  private ws: WebSocket | null = null;
  private wsListeners: Set<(event: WebSocketEvent) => void> = new Set();
  private wsReconnectTimer: any = null;
  private refreshInterval: number = 10;
  private intervalListeners: Set<(interval: number) => void> = new Set();
  private tickListeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("netsentinel_refresh_interval");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 2) {
          this.refreshInterval = parsed;
        }
      }
    }
    this.initWebSocket();
  }

  public subscribe(listener: (online: boolean) => void) {
    this.listeners.push(listener);
    listener(this.isBackendOnline);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.isBackendOnline));
  }

  public getIsBackendOnline(): boolean {
    return this.isBackendOnline;
  }

  public getHealthData(): BackendHealth | null {
    return this.healthData;
  }

  public getRefreshInterval(): number {
    return this.refreshInterval;
  }

  public setRefreshInterval(val: string | number) {
    let num = typeof val === "number" ? val : parseInt(String(val).replace(/\D/g, ""), 10);
    if (isNaN(num) || num < 2) num = 10;
    this.refreshInterval = num;
    if (typeof window !== "undefined") {
      localStorage.setItem("netsentinel_refresh_interval", String(num));
    }
    this.intervalListeners.forEach((fn) => fn(num));
  }

  public onRefreshIntervalChange(listener: (interval: number) => void) {
    this.intervalListeners.add(listener);
    listener(this.refreshInterval);
    return () => {
      this.intervalListeners.delete(listener);
    };
  }

  public onTick(listener: () => void) {
    this.tickListeners.add(listener);
    return () => {
      this.tickListeners.delete(listener);
    };
  }

  public triggerTick() {
    this.checkHealth();
    this.tickListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error("[NetSentinel Tick Error]", e);
      }
    });
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        this.healthData = (await res.json()) as BackendHealth;
        this.isBackendOnline = true;
      } else {
        this.healthData = null;
        this.isBackendOnline = false;
      }
    } catch {
      this.healthData = null;
      this.isBackendOnline = false;
    }
    this.notify();
    return this.isBackendOnline;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        if (!this.isBackendOnline) {
          this.isBackendOnline = true;
          this.notify();
        }
        return (await res.json()) as T;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // --- WebSocket Connection ---

  private initWebSocket() {
    if (typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        if (this.wsReconnectTimer) {
          clearTimeout(this.wsReconnectTimer);
          this.wsReconnectTimer = null;
        }
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as WebSocketEvent;
          this.wsListeners.forEach((fn) => fn(payload));
        } catch (e) {
          console.debug("[NetSentinel WS] Message error:", e);
        }
      };

      socket.onclose = () => {
        this.ws = null;
        if (!this.wsReconnectTimer) {
          this.wsReconnectTimer = setTimeout(() => {
            this.wsReconnectTimer = null;
            this.initWebSocket();
          }, 3000);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch (e) {
      // Ignore initial connection failure and retry
      if (!this.wsReconnectTimer) {
        this.wsReconnectTimer = setTimeout(() => {
          this.wsReconnectTimer = null;
          this.initWebSocket();
        }, 5000);
      }
    }
  }

  public subscribeWebSocket(listener: (event: WebSocketEvent) => void) {
    this.wsListeners.add(listener);
    return () => {
      this.wsListeners.delete(listener);
    };
  }

  // --- Endpoints ---

  public async getOverviewStats(): Promise<OverviewStats> {
    try {
      return await this.request<OverviewStats>("/overview");
    } catch {
      return {
        connectedDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        networkTrafficGB: 0,
        activeAlerts: 0,
        suspiciousEvents24h: 0,
        availabilityRate: 100,
        trafficDeltaPercent: 0,
      };
    }
  }

  public async getDevices(): Promise<Device[]> {
    try {
      return await this.request<Device[]>("/devices");
    } catch {
      return [];
    }
  }

  public async getDeviceById(id: string): Promise<Device | undefined> {
    try {
      return await this.request<Device>(`/devices/${encodeURIComponent(id)}`);
    } catch {
      return undefined;
    }
  }

  public async trustDevice(id: string): Promise<Device | undefined> {
    try {
      return await this.request<Device>(`/devices/${encodeURIComponent(id)}/trust`, {
        method: "POST",
      });
    } catch {
      return undefined;
    }
  }

  public async scanNow(): Promise<{ found: number }> {
    return this.request<{ found: number }>("/scan", {
      method: "POST",
    });
  }

  public async getSecurityEvents(limit: number = 20): Promise<SecurityEvent[]> {
    try {
      return await this.request<SecurityEvent[]>(`/events?limit=${limit}`);
    } catch {
      return [];
    }
  }

  public async getAlerts(
    severity?: string,
    status?: string,
    hours: number = 168
  ): Promise<SecurityAlert[]> {
    const params = new URLSearchParams();
    if (severity && severity !== "All severities") params.set("severity", severity.toLowerCase());
    if (status && status !== "All statuses") params.set("status", status.toLowerCase());
    params.set("hours", String(hours));
    try {
      return await this.request<SecurityAlert[]>(`/alerts?${params.toString()}`);
    } catch {
      return [];
    }
  }

  public async updateAlertStatus(id: string, status: AlertStatus): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/alerts/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  public async getTrafficData(range: string = "24H"): Promise<TrafficData> {
    try {
      return await this.request<TrafficData>(`/traffic/overview?range=${range}`);
    } catch {
      return {
        incomingTotal: "0 B",
        outgoingTotal: "0 B",
        peakThroughput: "0 bps",
        totalVolume: "0 B",
        protocols: [],
        topSources: [],
        activeDevices: [],
        timeline: [],
      };
    }
  }

  public async getTrafficRecords(limit: number = 100): Promise<TrafficRecord[]> {
    try {
      return await this.request<TrafficRecord[]>(`/traffic/records?limit=${limit}`);
    } catch {
      return [];
    }
  }

  public async getReports(): Promise<ReportItem[]> {
    try {
      return await this.request<ReportItem[]>("/reports");
    } catch {
      return [];
    }
  }

  public async getReportSummary(hours: number = 24): Promise<ReportSummary | null> {
    try {
      return await this.request<ReportSummary>(`/reports/summary?hours=${hours}`);
    } catch {
      return null;
    }
  }

  public async getSettings(): Promise<WorkspaceSettings> {
    try {
      const s = await this.request<WorkspaceSettings>("/settings");
      if (s?.refreshInterval) {
        const num = parseInt(s.refreshInterval.replace(/\D/g, ""), 10);
        if (!isNaN(num) && num >= 2 && num !== this.refreshInterval) {
          this.refreshInterval = num;
          this.intervalListeners.forEach((fn) => fn(num));
        }
      }
      return s;
    } catch {
      return {
        workspaceName: "NetSentinel SOC",
        timezone: "UTC",
        defaultReportRange: "Last 24 hours",
        refreshInterval: `${this.refreshInterval}s`,
        compactTableDensity: false,
        showProtocolLabels: true,
        demoModeIndicator: false,
        dateFormat: "YYYY-MM-DD",
        trafficUnits: "Auto",
      };
    }
  }

  public async updateSettings(settings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
    if (settings.refreshInterval) {
      this.setRefreshInterval(settings.refreshInterval);
    }
    return this.request<WorkspaceSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }
}

export const api = new ApiService();
export default api;
