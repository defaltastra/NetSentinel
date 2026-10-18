import { useState } from "react";
import type { Page } from "../../types";
import Icon from "../common/Icon";
import { Search } from "../common/UIControls";
import api from "../../services/api";

export interface TopbarProps {
  page: Page;
  isBackendOnline: boolean;
  isUsingMock: boolean;
  onRefreshHealth: () => void;
}

export default function Topbar({
  page,
  isBackendOnline,
  isUsingMock,
  onRefreshHealth,
}: TopbarProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const title = page === "Reports" ? "Reports & Analytics" : page;

  const toggleMock = (forceMock: boolean) => {
    api.setForceMock(forceMock);
    setShowStatusMenu(false);
  };

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
        {/* Backend API Connection Status Indicator */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="demo-badge"
            style={{
              cursor: "pointer",
              background: isBackendOnline && !isUsingMock ? "rgba(118, 212, 194, 0.15)" : "rgba(15, 164, 175, 0.14)",
              borderColor: isBackendOnline && !isUsingMock ? "rgba(118, 212, 194, 0.4)" : "rgba(15, 164, 175, 0.3)",
              color: isBackendOnline && !isUsingMock ? "#76d4c2" : "var(--cyan)",
            }}
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            title="Click to toggle FastAPI / Mock Data mode"
          >
            <span
              style={{
                background: isBackendOnline && !isUsingMock ? "#76d4c2" : "var(--cyan)",
              }}
            />
            {isBackendOnline && !isUsingMock ? "FastAPI Live" : "Demo Data"}
          </button>

          {showStatusMenu && (
            <div
              style={{
                position: "absolute",
                top: "36px",
                right: "0",
                zIndex: 60,
                width: "250px",
                background: "var(--panel-deep)",
                border: "1px solid var(--border-strong)",
                borderRadius: "10px",
                padding: "12px",
                boxShadow: "0 10px 25px rgba(0, 20, 22, 0.5)",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--ice)", marginBottom: "8px" }}>
                Backend Integration Status
              </div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "12px", lineHeight: "1.4" }}>
                {isBackendOnline
                  ? "✓ FastAPI server detected on localhost:8000"
                  : "⚠ FastAPI server not detected. Using dummy mock data."}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <button
                  type="button"
                  style={{
                    padding: "6px 10px",
                    background: !isUsingMock ? "var(--cyan-soft)" : "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--ice)",
                    cursor: "pointer",
                    fontSize: "10px",
                    textAlign: "left",
                  }}
                  onClick={() => {
                    toggleMock(false);
                    onRefreshHealth();
                  }}
                >
                  🟢 <strong>Use FastAPI Live API</strong>
                </button>
                <button
                  type="button"
                  style={{
                    padding: "6px 10px",
                    background: isUsingMock ? "var(--cyan-soft)" : "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--ice)",
                    cursor: "pointer",
                    fontSize: "10px",
                    textAlign: "left",
                  }}
                  onClick={() => toggleMock(true)}
                >
                  🟡 <strong>Force Mock Dummy Data</strong>
                </button>
              </div>

              <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--cyan)",
                    cursor: "pointer",
                    fontSize: "9px",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onClick={() => {
                    onRefreshHealth();
                  }}
                >
                  <Icon name="refresh" size={11} /> Check backend connection now
                </button>
              </div>
            </div>
          )}
        </div>

        <Search placeholder="Search network..." />

        <button className="icon-button notification" aria-label="Notifications" type="button">
          <Icon name="bell" />
          <span />
        </button>

      </div>
    </header>
  );
}
