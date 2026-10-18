# Backend Guidance for Python / FastAPI Developer

Welcome! This document outlines what the frontend expects from the backend and how the system is architected.

---

## 🚀 Quick Setup & Expectations

- **Framework**: Python + FastAPI (or Flask if you prefer, with Uvicorn).
- **Default Port**: `http://localhost:8000`
- **CORS**: Allow origin `http://localhost:5173` (Vite dev server) or let Vite proxy `/api` calls.
- **Auto-Discovery Concept**: 
  - Devices are **NOT** manually registered by users.
  - The backend is expected to discover devices automatically via network scanning (ARP tables, DHCP leases, packet sniffing with `scapy` / `pcap`, or router SNMP/API).
  - Newly discovered devices should populate into `GET /api/devices`.

---

## 📡 Required Endpoints

| Endpoint | Method | Expected Output / Purpose |
|:---|:---|:---|
| `/api/health` | `GET` | `{"status": "ok"}` — Frontend polls this to toggle "FastAPI Live" vs "Demo Data" badge. |
| `/api/overview` | `GET` | Summary metrics: connected devices count, online count, bandwidth totals, active alerts count. |
| `/api/devices` | `GET` | Array of auto-scanned devices on the subnet (IP, MAC, hostname/name, status, risk level). |
| `/api/devices/scan` | `POST` | (Optional) Trigger a subnet re-scan. |
| `/api/traffic/overview` | `GET` | Timeframe traffic data (1H, 24H, 7D, 30D), protocol distribution percentages, top source IPs. |
| `/api/traffic/records` | `GET` | Array of packet flow logs (timestamp, source IP, dest IP, protocol, port, size, direction). |
| `/api/alerts` | `GET` | Flagged security alerts & anomalies (severity, affected device, anomaly description, evidence). |
| `/api/alerts/{id}/status` | `PATCH` | Update alert triage status (`Open`, `Investigating`, `Resolved`). Body: `{"status": "Resolved"}`. |
| `/api/settings` | `GET` / `PUT` | Workspace preferences, scan intervals, and detection thresholds. |

---

## 💡 Frontend Fallback Notice
The frontend has a built-in mock fallback in `src/data/mockData.ts`. If your server is offline or an endpoint returns an error, the frontend will automatically use dummy data so you can test features incrementally without breaking the UI.
