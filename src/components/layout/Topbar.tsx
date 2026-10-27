import { useState, useEffect, useCallback } from "react";
import type { Page } from "../../types";
import Icon from "../common/Icon";
import api from "../../services/api";

export interface TopbarProps {
  page: Page;
  isBackendOnline: boolean;
  onRefreshHealth: () => void;
  onRefreshAll?: () => Promise<void> | void;
}

export default function Topbar({
  page,
  isBackendOnline,
  onRefreshHealth,
  onRefreshAll,
}: TopbarProps) {
  // Backend aggregation window is 10 seconds (NETSENTINEL_WINDOW=10 in capture.py)
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const title = page === "Reports" ? "Reports & Analytics" : page;

  // Sync refresh interval with settings or dynamic backend changes
  useEffect(() => {
    const unsub = api.onRefreshIntervalChange((interval) => {
      setRefreshInterval(interval);
      setSecondsLeft((prev) => Math.min(prev, interval));
    });
    return () => {
      unsub();
    };
  }, []);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefreshAll) {
        await onRefreshAll();
      } else {
        await onRefreshHealth();
      }
    } finally {
      const interval = api.getRefreshInterval() || refreshInterval || 10;
      setSecondsLeft(interval);
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [isRefreshing, onRefreshAll, onRefreshHealth, refreshInterval]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleManualRefresh();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleManualRefresh, refreshInterval]);

  return (
    <header className="topbar">
      <div className="mobile-brand">
        <Icon name="shield" />
        <strong>NS</strong>
      </div>

      <div className="breadcrumb">
        <span>Workspace</span>
        <Icon name="arrow" size={14} />
        <strong>{title}</strong>
      </div>

      <div className="top-actions">
        {/* Auto-Refresh Countdown Badge */}
        <button
          type="button"
          className="countdown-badge"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          title={`Backend capture window: ${refreshInterval}s. Auto-refreshes in ${secondsLeft}s. Click to refresh now.`}
        >
          <span className={`badge-icon ${isRefreshing ? "spin" : ""}`}>
            <Icon name="refresh" size={12} />
          </span>
          <span className="badge-text">
            {isRefreshing ? "Syncing..." : `${secondsLeft}s`}
          </span>
        </button>

        {/* Backend API Connection Status Indicator */}
        <button
          type="button"
          className={`status-badge ${isBackendOnline ? "online" : "offline"}`}
          onClick={onRefreshHealth}
          title={isBackendOnline ? "Backend Live. Click to re-check." : "Backend Offline. Click to retry."}
        >
          <span className="status-dot" />
          <span>{isBackendOnline ? "Live" : "Offline"}</span>
        </button>
      </div>
    </header>
  );
}
