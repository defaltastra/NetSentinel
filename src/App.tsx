import { useState, useEffect, type ReactNode } from "react";
import type { Page } from "./types";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
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
  const [isUsingMock, setIsUsingMock] = useState(true);

  useEffect(() => {
    // Initial health check against FastAPI
    api.checkHealth();

    // Subscribe to connection state changes
    const unsubscribe = api.subscribe((online, usingMock) => {
      setIsBackendOnline(online);
      setIsUsingMock(usingMock);
    });

    return () => {
      unsubscribe();
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
      <Sidebar page={page} setPage={setPage} />
      <div className="app-main">
        <Topbar
          page={page}
          isBackendOnline={isBackendOnline}
          isUsingMock={isUsingMock}
          onRefreshHealth={() => api.checkHealth()}
        />
        <main>{screens[page]}</main>
      </div>
    </div>
  );
}
