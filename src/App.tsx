import { useState, useEffect, useCallback, type ReactNode } from "react";
import type { Page, SecurityAlert } from "./types";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import Toast from "./components/common/Toast";
import Overview from "./pages/Overview";
import ConnectedDevices from "./pages/ConnectedDevices";
import NetworkTraffic from "./pages/NetworkTraffic";
import SecurityAlerts from "./pages/SecurityAlerts";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import api from "./services/api";

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [toastAlert, setToastAlert] = useState<SecurityAlert | null>(null);

  const handleTickRefresh = useCallback(async () => {
    // Gentle in-place tick: updates data without remounting or flashing the whole screen
    api.triggerTick();
    try {
      const stats = await api.getOverviewStats();
      setOnlineCount(stats.onlineDevices);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Initial health check against FastAPI
    api.checkHealth();
    // Preload settings to initialize refresh interval from backend
    api.getSettings();

    // Fetch stats to update online devices count in sidebar
    api.getOverviewStats().then((stats) => {
      setOnlineCount(stats.onlineDevices);
    });

    // Subscribe to connection state changes
    const unsubscribe = api.subscribe((online) => {
      setIsBackendOnline(online);
      if (online) {
        api.getOverviewStats().then((stats) => {
          setOnlineCount(stats.onlineDevices);
        });
      }
    });

    // Subscribe to real-time events via WebSocket
    const unsubWs = api.subscribeWebSocket((event) => {
      if (event.type === "alert" && event.data) {
        setToastAlert(event.data);
      }
      if (event.type === "device" || event.type === "traffic" || event.type === "alert") {
        api.getOverviewStats().then((stats) => {
          setOnlineCount(stats.onlineDevices);
        });
      }
    });

    return () => {
      unsubscribe();
      unsubWs();
    };
  }, []);

  const screens: Record<Page, ReactNode> = {
    Overview: (
      <Overview
        onNavigateToAlerts={() => setPage("Security Alerts")}
        onNavigateToDevices={() => setPage("Connected Devices")}
      />
    ),
    "Connected Devices": <ConnectedDevices />,
    "Network Traffic": <NetworkTraffic />,
    "Security Alerts": <SecurityAlerts />,
    Reports: <Reports />,
    Settings: <Settings />,
  };

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} onlineCount={onlineCount} />
      <div className="app-main">
        <Topbar
          page={page}
          isBackendOnline={isBackendOnline}
          onRefreshHealth={() => api.checkHealth()}
          onRefreshAll={handleTickRefresh}
        />
        <main>{screens[page]}</main>
      </div>

      <Toast
        alert={toastAlert}
        onClose={() => setToastAlert(null)}
        onInspect={() => {
          setToastAlert(null);
          setPage("Security Alerts");
        }}
      />
    </div>
  );
}
