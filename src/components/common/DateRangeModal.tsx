import { useState } from "react";
import Icon from "./Icon";
import Button from "./Button";

export interface DateRangeModalProps {
  currentRange: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (newRange: string) => void;
}

export default function DateRangeModal({
  currentRange,
  isOpen,
  onClose,
  onApply,
}: DateRangeModalProps) {
  const [selectedPreset, setSelectedPreset] = useState(currentRange);
  const [customStart, setCustomStart] = useState("2025-05-18");
  const [customEnd, setCustomEnd] = useState("2025-05-24");
  const [isCustom, setIsCustom] = useState(false);

  if (!isOpen) return null;

  const presets = [
    { label: "Today (Last 24 Hours)", val: "Last 24 Hours" },
    { label: "Current Audit Period (May 18 – May 24)", val: "May 18 – May 24, 2025" },
    { label: "Last 7 Days", val: "Past 7 Days" },
    { label: "Last 14 Days", val: "Past 14 Days" },
    { label: "Last 30 Days", val: "Past 30 Days" },
  ];

  const handleApply = () => {
    if (isCustom) {
      onApply(`${customStart} to ${customEnd}`);
    } else {
      onApply(selectedPreset);
    }
    onClose();
  };

  return (
    <div className="drawer-backdrop" onClick={onClose} style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(460px, 92vw)",
          padding: "24px",
          background: "var(--panel-deep)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 20px 50px rgba(0, 15, 18, 0.7)",
          animation: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "var(--cyan)" }}>
              <Icon name="calendar" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)" }}>Select Reporting Period</h3>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close modal">
            <Icon name="x" />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
          {presets.map((p) => (
            <button
              key={p.val}
              type="button"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: !isCustom && selectedPreset === p.val ? "var(--cyan)" : "var(--border)",
                background: !isCustom && selectedPreset === p.val ? "var(--cyan-soft)" : "var(--panel)",
                color: !isCustom && selectedPreset === p.val ? "var(--ice)" : "var(--muted)",
                cursor: "pointer",
                fontSize: "12px",
                transition: "all 0.15s ease",
              }}
              onClick={() => {
                setSelectedPreset(p.val);
                setIsCustom(false);
              }}
            >
              <span>{p.label}</span>
              {!isCustom && selectedPreset === p.val && <Icon name="check" size={14} />}
            </button>
          ))}

          {/* Custom Date Range Option */}
          <button
            type="button"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid",
              borderColor: isCustom ? "var(--cyan)" : "var(--border)",
              background: isCustom ? "var(--cyan-soft)" : "var(--panel)",
              color: isCustom ? "var(--ice)" : "var(--muted)",
              cursor: "pointer",
              fontSize: "12px",
              transition: "all 0.15s ease",
            }}
            onClick={() => setIsCustom(true)}
          >
            <span>Custom Date Range</span>
            {isCustom && <Icon name="check" size={14} />}
          </button>
        </div>

        {isCustom && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "11px", color: "var(--muted)" }}>
              <span>Start Date</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{
                  background: "var(--panel)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "8px",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "11px", color: "var(--muted)" }}>
              <span>End Date</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{
                  background: "var(--panel)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "8px",
                }}
              />
            </label>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply Period
          </Button>
        </div>
      </div>
    </div>
  );
}
