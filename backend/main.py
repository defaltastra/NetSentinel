"""NetSentinel : API FastAPI + WebSocket.

Lancement (capture réelle, droits root nécessaires) :
    sudo venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
Lancement sans root, avec trafic simulé :
    NETSENTINEL_MODE=simulate venv/bin/python -m uvicorn main:app --port 8000
Documentation interactive : http://IP:8000/docs

Les réponses suivent les types TypeScript du frontend (src/types/index.ts).
"""
import asyncio
import os
import re
import time
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from pydantic import BaseModel

from core import adapters
from core import database as db
from core import devices as dev
from core import reports
from core.capture import Simulator, TrafficMonitor
from core.detection import Detector
from core.ml_model import MLDetector

MODE = os.environ.get("NETSENTINEL_MODE", "live")          # live | simulate
IFACE = os.environ.get("NETSENTINEL_IFACE") or None
SCAN_INTERVAL = int(os.environ.get("NETSENTINEL_SCAN_INTERVAL", "60"))

app = FastAPI(title="NetSentinel API", version="1.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])


class Hub:
    """Diffuse les événements temps réel à tous les navigateurs connectés."""

    def __init__(self):
        self.clients = set()
        self.loop = None  # type: Optional[asyncio.AbstractEventLoop]

    async def _send_all(self, msg: Dict[str, Any]) -> None:
        for ws in list(self.clients):
            try:
                await ws.send_json(msg)
            except Exception:
                self.clients.discard(ws)

    def publish(self, kind: str, data: Any) -> None:
        """Appelable depuis n'importe quel thread."""
        if self.loop and self.clients:
            asyncio.run_coroutine_threadsafe(
                self._send_all({"type": kind, "data": data}), self.loop)


hub = Hub()
state = {}  # type: Dict[str, Any]


def _on_alert(alert: Dict[str, Any]) -> None:
    try:
        hub.publish("alert", adapters.alert_payload(alert))
    except Exception:
        pass


@app.on_event("startup")
def startup() -> None:
    hub.loop = asyncio.get_event_loop()
    db.init_db()

    detector = Detector(on_alert=_on_alert)
    ml = MLDetector()
    detector.ml = ml
    iface, cidr, own_ip = (IFACE, os.environ.get("NETSENTINEL_NETWORK"), None)
    if MODE == "live":
        det_iface, det_cidr, own_ip = dev.local_network(IFACE)
        iface = iface or det_iface
        cidr = cidr or det_cidr

    monitor = TrafficMonitor(detector, on_event=hub.publish, iface=iface)
    monitor.own_ip = own_ip
    sim = None  # type: Optional[Simulator]

    if MODE == "simulate":
        sim = Simulator(monitor)
        scan_fn = sim.devices
    else:
        def scan_fn():
            if not cidr:
                raise RuntimeError("réseau local introuvable (définis NETSENTINEL_NETWORK)")
            return dev.arp_scan(cidr, iface, own_ip)

    def on_new_device(d: Dict[str, Any]) -> None:
        detector.raise_alert(
            "new_device", "medium", d["ip"],
            "Nouvel appareil sur le réseau : %s (MAC %s, fabricant %s)"
            % (d["ip"], d["mac"], d["vendor"] or "inconnu"), key=d["mac"],
            evidence={"transferVolume": "n/a (device discovery)",
                      "baselineVariance": "MAC address absent from the baseline",
                      "destinationReputation": "Vendor: %s" % (d["vendor"] or "unknown")})
        try:
            hub.publish("device", adapters.device_payload(d["mac"]))
        except Exception:
            pass

    dmon = dev.DeviceMonitor(scan_fn, on_new_device, on_event=hub.publish,
                             interval=SCAN_INTERVAL, resolve_names=(MODE == "live"))
    monitor.start("simulate" if MODE == "simulate" else "live")
    if sim:
        sim.start()
    dmon.start()
    state.update(detector=detector, monitor=monitor, sim=sim, dmon=dmon, ml=ml,
                 iface=iface, cidr=cidr, started=time.time())


@app.on_event("shutdown")
def shutdown() -> None:
    for k in ("monitor", "dmon", "sim"):
        if state.get(k):
            state[k].stop()


# ------------------------------------------------------------- santé / stats
@app.get("/api/health")
def health():
    mon, dmon = state["monitor"], state["dmon"]
    return {"status": "ok", "mode": MODE, "interface": state["iface"],
            "network": state["cidr"], "uptime_s": int(time.time() - state["started"]),
            "capture_error": mon.error, "scan_error": dmon.error,
            "ml_ready": state["ml"].is_ready()}


@app.get("/api/overview")
def overview():
    """OverviewStats (src/types/index.ts)."""
    return adapters.overview_payload()


@app.get("/api/stats")
def stats():
    """Chiffres en direct (paquets/s) pour le débogage."""
    mon = state["monitor"]
    return {"packets_per_sec": mon.last_sec["packets"],
            "bytes_per_sec": mon.last_sec["bytes"], "mode": MODE,
            "capture_error": mon.error, "alerts_open": db.count_open_alerts()}


# ---------------------------------------------------------------- appareils
class DeviceIn(BaseModel):
    name: Optional[str] = None
    ip: str
    mac: str
    type: Optional[str] = None


@app.get("/api/devices")
def devices():
    return adapters.devices_payload()


@app.post("/api/devices")
def register_device(body: DeviceIn):
    """Enregistre un appareil à la main (il est alors considéré de confiance)."""
    mac = body.mac.lower()
    if not re.match(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$", mac):
        raise HTTPException(400, "adresse MAC invalide (format aa:bb:cc:dd:ee:ff)")
    now = int(time.time())
    db.upsert_device(mac, body.ip, "", body.name or "", now, baseline=True)
    return adapters.device_payload(mac)


@app.get("/api/devices/{device_id}")
def device_detail(device_id: str):
    d = adapters.device_payload(device_id)
    if d is None:
        raise HTTPException(404, "appareil inconnu")
    return d


@app.post("/api/devices/{device_id}/trust")
def trust_device(device_id: str):
    if not db.trust_device(device_id.lower()):
        raise HTTPException(404, "appareil inconnu")
    return adapters.device_payload(device_id)


@app.post("/api/scan")
def scan_now():
    """Force un scan ARP immédiat."""
    try:
        return {"found": state["dmon"].scan_once()}
    except PermissionError:
        raise HTTPException(403, "Droits insuffisants : lance avec sudo")
    except Exception as exc:
        raise HTTPException(500, str(exc))


# ------------------------------------------------------------------- alertes
class StatusIn(BaseModel):
    status: str


def _normalize_status(value: str) -> str:
    v = value.strip().lower()
    if v not in ("open", "investigating", "resolved"):
        raise HTTPException(400, "statut : Open, Investigating ou Resolved")
    return v


@app.get("/api/events")
def events(limit: int = Query(20, ge=1, le=200)):
    return adapters.events_payload(limit)


@app.get("/api/alerts")
def alerts(severity: Optional[str] = None, status: Optional[str] = None,
           hours: int = Query(24 * 7, ge=1), limit: int = Query(200, ge=1, le=2000)):
    return adapters.alerts_payload(severity, status, hours, limit)


@app.get("/api/alerts/raw")
def alerts_raw(limit: int = Query(50, ge=1, le=2000)):
    """Alertes brutes de la base (débogage)."""
    return db.get_alerts(limit=limit)


@app.patch("/api/alerts/{alert_id}/status")
@app.post("/api/alerts/{alert_id}/status")
def alert_status(alert_id: str, body: Optional[StatusIn] = None,
                 status: Optional[str] = None):
    """Met à jour le statut : corps JSON {"status": "Resolved"} ou ?status=..."""
    value = (body.status if body else None) or status
    if not value:
        raise HTTPException(400, "statut manquant")
    m = re.search(r"(\d+)", alert_id)
    if not m or not db.set_alert_status(int(m.group(1)), _normalize_status(value)):
        raise HTTPException(404, "alerte inconnue")
    return adapters.alert_payload(db.get_alert(int(m.group(1))))


# ------------------------------------------------------------------- trafic
@app.get("/api/traffic/overview")
def traffic_overview(range: str = "24H"):
    """TrafficData ; range = 1H | 24H | 7D | 30D."""
    return adapters.traffic_overview_payload(range)


@app.get("/api/traffic/records")
def traffic_records(limit: int = Query(100, ge=1, le=500)):
    return adapters.records_payload(limit)


@app.get("/api/traffic/live")
def traffic_live():
    return list(state["monitor"].live)


@app.get("/api/traffic")
def traffic(minutes: int = Query(60, ge=1, le=7 * 1440)):
    bucket = 10 if minutes <= 60 else 60 if minutes <= 360 else 300
    rows = db.get_traffic(int(time.time()) - minutes * 60, bucket)
    return {"bucket_s": bucket, "points": rows}


# ------------------------------------------------------- rapports, paramètres
@app.get("/api/reports")
def report_list():
    return reports.report_items()


@app.get("/api/reports/summary")
def report_summary(hours: int = Query(24, ge=1, le=24 * 30)):
    return reports.build_summary(hours)


@app.get("/api/reports/html", response_class=HTMLResponse)
def report_html(hours: int = Query(24, ge=1, le=24 * 30)):
    return reports.render_html(hours)


@app.get("/api/reports/alerts.csv", response_class=PlainTextResponse)
def report_csv(hours: int = Query(24 * 7, ge=1)):
    return PlainTextResponse(
        reports.alerts_csv(hours), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=alertes.csv"})


@app.get("/api/reports/{report_id}/download")
def report_download(report_id: str):
    built = reports.build_report(report_id)
    if built is None:
        raise HTTPException(404, "rapport inconnu")
    content, mime, filename = built
    return Response(content=content, media_type=mime,
                    headers={"Content-Disposition": 'attachment; filename="%s"' % filename})


@app.get("/api/settings")
def get_settings():
    return adapters.settings_payload()


@app.put("/api/settings")
def put_settings(values: Dict[str, Any]):
    return adapters.save_settings(values)


# ------------------------------------------------------------------ IA / démo
@app.post("/api/ml/train")
def ml_train(min_rows: int = Query(100, ge=10)):
    try:
        return state["ml"].train(min_rows=min_rows)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except ImportError:
        raise HTTPException(500, "scikit-learn n'est pas installé")


@app.post("/api/simulate/{kind}")
def simulate(kind: str):
    """Déclenche une fausse attaque (mode simulate uniquement)."""
    sim = state.get("sim")
    if sim is None:
        raise HTTPException(400, "Disponible seulement avec NETSENTINEL_MODE=simulate")
    if not sim.inject(kind):
        raise HTTPException(404, "attaques : portscan, synflood, dnsflood, arpspoof, "
                                 "spike, newdevice, telnet")
    return {"injected": kind}


# ---------------------------------------------------------------- WebSocket
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    hub.clients.add(ws)
    try:
        while True:
            await ws.receive_text()   # on ignore les messages du client
    except WebSocketDisconnect:
        hub.clients.discard(ws)
    except Exception:
        hub.clients.discard(ws)
