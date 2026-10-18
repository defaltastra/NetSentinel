import type {
  OverviewStats,
  Device,
  SecurityEvent,
  SecurityAlert,
  TrafficData,
  TrafficRecord,
  ReportItem,
  WorkspaceSettings,
  AlertStatus,
} from "../types";

import {
  mockOverviewStats,
  mockDevices,
  mockSecurityEvents,
  mockAlerts,
  mockTrafficData,
  mockTrafficRecords,
  mockReports,
  mockSettings,
} from "../data/mockData";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

class ApiService {
  private useMock: boolean = false;
  private isBackendOnline: boolean = false;
  private listeners: Array<(online: boolean, useMock: boolean) => void> = [];

  constructor() {
    // Check local storage preference for demo mode if present
    const savedMockPref = localStorage.getItem("netsentinel_force_mock");
    if (savedMockPref !== null) {
      this.useMock = savedMockPref === "true";
    }
  }

  public subscribe(listener: (online: boolean, useMock: boolean) => void) {
    this.listeners.push(listener);
    listener(this.isBackendOnline, this.useMock);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.isBackendOnline, this.useMock));
  }

  public setForceMock(value: boolean) {
    this.useMock = value;
    localStorage.setItem("netsentinel_force_mock", String(value));
    this.notify();
  }

  public getIsBackendOnline(): boolean {
    return this.isBackendOnline;
  }

  public getIsUsingMock(): boolean {
    return this.useMock || !this.isBackendOnline;
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      this.isBackendOnline = res.ok;
    } catch {
      this.isBackendOnline = false;
    }
    this.notify();
    return this.isBackendOnline;
  }

  private async request<T>(endpoint: string, fallbackData: T, options?: RequestInit): Promise<T> {
    if (this.useMock) {
      return fallbackData;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

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
        this.isBackendOnline = true;
        this.notify();
        return (await res.json()) as T;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.info(`[NetSentinel API] Backend unavailable for ${endpoint}, using dummy data.`);
      this.isBackendOnline = false;
      this.notify();
      return fallbackData;
    }
  }

  // --- Endpoints ---

  public async getOverviewStats(): Promise<OverviewStats> {
    return this.request<OverviewStats>("/overview", mockOverviewStats);
  }

  public async getDevices(): Promise<Device[]> {
    return this.request<Device[]>("/devices", mockDevices);
  }

  public async getDeviceById(id: string): Promise<Device | undefined> {
    const devices = await this.getDevices();
    return devices.find((d) => d.id === id || d.name === id);
  }

  public async getSecurityEvents(): Promise<SecurityEvent[]> {
    return this.request<SecurityEvent[]>("/events", mockSecurityEvents);
  }

  public async getAlerts(): Promise<SecurityAlert[]> {
    return this.request<SecurityAlert[]>("/alerts", mockAlerts);
  }

  public async updateAlertStatus(id: string, status: AlertStatus): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/alerts/${id}/status`, { success: true }, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  public async getTrafficData(): Promise<TrafficData> {
    return this.request<TrafficData>("/traffic/overview", mockTrafficData);
  }

  public async getTrafficRecords(): Promise<TrafficRecord[]> {
    return this.request<TrafficRecord[]>("/traffic/records", mockTrafficRecords);
  }

  public async getReports(): Promise<ReportItem[]> {
    return this.request<ReportItem[]>("/reports", mockReports);
  }

  public async getSettings(): Promise<WorkspaceSettings> {
    return this.request<WorkspaceSettings>("/settings", mockSettings);
  }

  public async updateSettings(settings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
    return this.request<WorkspaceSettings>("/settings", { ...mockSettings, ...settings }, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }
}

export const api = new ApiService();
export default api;
