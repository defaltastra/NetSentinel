<div align="center">

# 🛡️ NetSentinel
### Enterprise Cybersecurity & Network Intelligence Dashboard

[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Ready-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)

<p align="center">
  <b>A modern, high-performance security operations center (SOC) dashboard.</b><br>
  Monitor connected endpoints, inspect live network traffic, triage security incidents, and export compliance reports with real-time FastAPI backend integration and resilient offline mock data fallback.
</p>

[Quick Start](#-quick-start) • [Features](#-key-features) • [Architecture & API](#-collaboration--api-architecture) • [Backend Setup](#-python--fastapi-backend) • [Special Thanks](#-special-acknowledgments)

---

</div>

## 🌐 Overview

**NetSentinel** provides network administrators and cybersecurity teams with a streamlined mission control surface. Designed for high situational awareness, it balances dense data presentation with an ultra-clean, tactical aesthetic.

The application is built for seamless teamwork: the **React frontend** can run entirely self-contained with rich, built-in dummy data, while automatically detecting and synchronizing with a **Python (FastAPI)** backend whenever it comes online.

---

## ✨ Key Features

- **📊 Network Telemetry & KPIs**: High-level overview of protected devices, bandwidth volume, availability percentage, and active alerts.
- **💻 Device Inventory & Inspection**: Filter by device status (`Online` / `Offline`) and risk levels (`Critical`, `High`, `Medium`, `Low`). Click any device to slide open the **Device Inspection Drawer** with observed connections and MAC/IP telemetry.
- **⚡ Network Traffic & Protocol Distribution**: Visual bandwidth timelines (1H, 24H, 7D, 30D), protocol distribution donut chart (HTTPS, TCP, UDP, DNS, HTTP), top source IPs, and detailed packet inspection records.
- **🚨 Security Alert Triage**: Real-time threat detection feed with severity badges. Inspect incident evidence, examine baseline deviations, review recommended remediation steps, and update investigation statuses.
- **📑 Reports & Analytics**: Security event breakdown by severity, network score ring, device inventory distribution, and ready-to-export PDF/CSV audits.
- **⚙️ Configurable Workspace**: Customizable workspace preferences, timezone offsets, report ranges, table density, and protocol labeling.
- **🔄 Hybrid Live/Mock Engine**: Interactive status indicator in the topbar that dynamically signals **🟢 FastAPI Live** or **🟡 Demo Data**, allowing instant toggling for development and presentation.

---

## 🏗️ Architecture & Collaboration

```
┌─────────────────────────────────────────────────────────────┐
│                      NetSentinel UI                         │
│             (React 19 + TypeScript + Tailwind v4)           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                Fetch / Proxy via /api/*
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│   FastAPI Server (8000) │           │    Built-in Mock Store  │
│   (Python backend live) │           │   (Auto-fallback data)  │
└─────────────────────────┘           └─────────────────────────┘
```

The frontend includes an intelligent service layer (`src/services/api.ts`) that:
1. Connects to `/api` (proxied by Vite to `http://localhost:8000`).
2. Checks backend health at `/api/health`.
3. If the backend is running, live data is used.
4. If the backend is offline or undergoing modifications, it automatically and gracefully falls back to the typed dummy store in `src/data/mockData.ts` without interrupting the user experience.

---

## 🚀 Quick Start

### 1. Frontend Setup (React + Vite)

Ensure you have [Node.js](https://nodejs.org/) (v18+) installed:

```bash
# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

#### Available Scripts
- `npm run dev` — Starts the Vite development server with hot module replacement (HMR).
- `npm run build` — Compiles TypeScript and creates an optimized production bundle in `dist/`.
- `npm run preview` — Locally previews the production build.

---

### 2. Python / FastAPI Backend Setup

A ready-to-run FastAPI starter backend is pre-configured in the `backend/` directory:

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server with reload
uvicorn main:app --reload --port 8000
```

- **Interactive API Docs (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative Docs (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

Once running, the frontend will automatically detect the server and switch the topbar badge to **🟢 FastAPI Live**!

---

## 📡 API Endpoints Reference

All endpoints return JSON matching the TypeScript interfaces in `src/types/index.ts`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend healthcheck and status check |
| `GET` | `/api/overview` | KPI telemetry (connected devices, online count, bandwidth) |
| `GET` | `/api/devices` | Monitored network devices list |
| `GET` | `/api/devices/{id}` | Detailed telemetry for a single device |
| `POST` | `/api/devices` | Register a new device |
| `GET` | `/api/events` | Recent security events feed |
| `GET` | `/api/alerts` | Security alerts with evidence summary & triage steps |
| `PATCH` | `/api/alerts/{id}/status` | Update alert status (`Open`, `Investigating`, `Resolved`) |
| `GET` | `/api/traffic/overview` | Bandwidth totals, protocols, and top source IPs |
| `GET` | `/api/traffic/records` | Real-time packet connection logs |
| `GET` | `/api/reports` | Available compliance and analytical reports |
| `GET` | `/api/settings` | Current workspace settings |
| `PUT` | `/api/settings` | Update workspace settings |

---

## 📂 Project Structure

```
├── backend/                       # Python FastAPI Backend
│   ├── main.py                    # FastAPI server & route handlers
│   ├── requirements.txt           # Python dependencies (FastAPI, Uvicorn, Pydantic)
│   └── README.md                  # Backend guide & documentation
├── public/                        # Static assets & brand favicon
│   └── favicon.svg                # NetSentinel shield icon
├── src/                           # Frontend React Application
│   ├── components/                # Modular UI components
│   │   ├── alerts/                # AlertDrawer and incident triage
│   │   ├── charts/                # TrafficChart & DonutChart
│   │   ├── common/                # Icon, Badge, Button, Card, StatCard, UIControls
│   │   ├── devices/               # DeviceDrawer and endpoint inspection
│   │   └── layout/                # Sidebar, Topbar, PageHeader
│   ├── data/
│   │   └── mockData.ts            # Typed fallback dummy data
│   ├── pages/                     # Core application views
│   │   ├── Overview.tsx           # SOC overview dashboard
│   │   ├── ConnectedDevices.tsx   # Device inventory & management
│   │   ├── NetworkTraffic.tsx     # Traffic analytics & connection log
│   │   ├── SecurityAlerts.tsx     # Threat detection & investigation
│   │   ├── Reports.tsx            # Compliance reports & posture score
│   │   └── Settings.tsx           # Workspace configuration
│   ├── services/
│   │   └── api.ts                 # API client with FastAPI proxy & fallback logic
│   ├── types/
│   │   └── index.ts               # Shared TypeScript domain models
│   ├── App.tsx                    # Root application container & page router
│   ├── index.css                  # Tailwind CSS v4 entrypoint & theme variables
│   └── main.tsx                   # React DOM root entrypoint
├── .gitignore                     # Git ignore rules (Node, Vite, Python, OS)
├── package.json                   # Project scripts and dependencies
├── tsconfig.json                  # TypeScript compiler configuration
├── vite.config.ts                 # Clean Vite config with Tailwind & FastAPI proxy
└── README.md                      # Project documentation
```

---

## 🌟 Special Acknowledgments

<div align="center">

Special thanks and appreciation to:

### 👩‍💻 **[wissal01-tech](https://github.com/wissal01-tech)**

for her outstanding contribution to NetSentinel's backend development, implementing FastAPI, Scapy, SQLite, real-time traffic monitoring, threat detection, and AI-powered anomaly detection. 🛡️🚀
</div>

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
