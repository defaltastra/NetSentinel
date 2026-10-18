import type { Page, IconName } from "../../types";
import Icon from "../common/Icon";

const nav: { name: Page; icon: IconName; label?: string }[] = [
  { name: "Overview", icon: "grid" },
  { name: "Connected Devices", icon: "devices" },
  { name: "Network Traffic", icon: "traffic" },
  { name: "Security Alerts", icon: "shield" },
  { name: "Reports", icon: "report", label: "Reports & Analytics" },
  { name: "Settings", icon: "settings" },
];

export interface SidebarProps {
  page: Page;
  setPage: (page: Page) => void;
  onlineCount?: number;
}

export default function Sidebar({ page, setPage, onlineCount = 21 }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Icon name="shield" size={22} />
        </div>
        <div>
          <strong>NetSentinel</strong>
          <span>Network intelligence</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="Main navigation">
        {nav.map((item) => (
          <button
            key={item.name}
            type="button"
            className={`nav-item ${page === item.name ? "active" : ""}`}
            onClick={() => setPage(item.name)}
          >
            <Icon name={item.icon} />
            <span>{item.label || item.name}</span>
          </button>
        ))}
      </nav>

      <div className="monitor-status">
        <span className="pulse-dot" />
        <div>
          <strong>Monitoring active</strong>
          <span>{onlineCount} devices protected</span>
        </div>
      </div>

      <div className="sidebar-version">NETSENTINEL OS · V2.4</div>
    </aside>
  );
}
