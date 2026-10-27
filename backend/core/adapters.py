"""Convertit les données internes vers le format exact du frontend.

Les noms de champs viennent de `src/types/index.ts` (Device, SecurityAlert,
SecurityEvent, TrafficRecord, OverviewStats, TrafficData, ReportItem,
WorkspaceSettings).
"""
import ipaddress
import json
import time
from typing import Any, Dict, List, Optional, Tuple

from . import database as db
from . import reports

DAY = 86400
RISK = {1: "Low", 2: "Medium", 3: "High", 4: "Critical"}
SEV_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}
RANGES = {"1H": 60, "24H": 1440, "7D": 10080, "30D": 43200}
PROTO_COLORS = {"HTTPS": "cyan", "TCP": "ice", "UDP": "teal", "DNS": "rust",
                "HTTP": "muted", "Other": "muted"}
DEFAULT_SETTINGS = {
    "workspaceName": "NetSentinel SOC", "timezone": "UTC",
    "defaultReportRange": "Last 24 hours", "refreshInterval": "10s",
    "compactTableDensity": False, "showProtocolLabels": True,
    "demoModeIndicator": True, "dateFormat": "YYYY-MM-DD", "trafficUnits": "Auto",
}


# ------------------------------------------------------------------ formats
def fmt_bytes(n: float) -> str:
    n = float(n or 0)
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return "%d B" % n if unit == "B" else "%.1f %s" % (n, unit)
        n /= 1024.0
    return "0 B"


def fmt_rate(bytes_per_s: float) -> str:
    bits = float(bytes_per_s or 0) * 8
    for div, unit in ((1e9, "Gbps"), (1e6, "Mbps"), (1e3, "Kbps")):
        if bits >= div:
            return "%.1f %s" % (bits / div, unit)
    return "%d bps" % bits


def label_proto(proto: str, dport: int) -> str:
    if proto == "TCP" and dport == 443:
        return "HTTPS"
    if proto == "TCP" and dport == 80:
        return "HTTP"
    return proto


def _since(minutes: int) -> int:
    return int(time.time()) - minutes * 60


def _flows(minutes: int = 1440) -> List[Dict[str, Any]]:
    # Les connexions ne sont gardées que 24 h.
    return db.get_connections(_since(min(minutes, 1440)), 5000)


# ---------------------------------------------------------------- appareils
def guess_type(d: Dict[str, Any]) -> Tuple[str, str]:
    v = (d.get("vendor") or "").lower()
    if d["ip"].endswith(".1"):
        return "Gateway", "wifi"
    if any(k in v for k in ("vmware", "microsoft", "virtualbox", "oracle", "qemu",
                            "xen", "docker", "parallels")):
        return "Virtual machine", "server"
    if "raspberry" in v:
        return "Single-board computer", "server"
    if any(k in v for k in ("hewlett", "canon", "epson", "brother", "xerox", "ricoh")):
        return "Printer", "printer"
    if "aléatoire" in v or any(k in v for k in ("apple", "samsung", "xiaomi", "huawei",
                                                 "oneplus", "oppo", "google")):
        return "Mobile device", "phone"
    return "Computer", "laptop"


def display_name(d: Dict[str, Any], typ: str) -> str:
    if d.get("hostname"):
        return d["hostname"]
    vendor = (d.get("vendor") or "").split(",")[0].split(" ")[0]
    if vendor and vendor.lower() not in ("inconnu", "mac"):
        return "%s %s (%s)" % (vendor, typ.lower(), d["ip"])
    return "%s (%s)" % (typ, d["ip"])


def _risk_map() -> Dict[str, int]:
    out = {}  # type: Dict[str, int]
    for a in db.get_alerts(status="open", since=int(time.time()) - DAY, limit=2000):
        for ip in (a["source_ip"], a.get("dest_ip")):
            if ip:
                out[ip] = max(out.get(ip, 1), SEV_RANK.get(a["severity"], 1))
    return out


def _device_payload(d: Dict[str, Any], risks: Dict[str, int],
                    flows: List[Dict[str, Any]]) -> Dict[str, Any]:
    typ, icon = guess_type(d)
    ip = d["ip"]
    incoming = sum(f["bytes"] for f in flows if f["dst"] == ip)
    outgoing = sum(f["bytes"] for f in flows if f["src"] == ip)
    mine = sorted((f for f in flows if f["src"] == ip), key=lambda f: -f["bytes"])[:8]
    risk = risks.get(ip, 1)
    if d["is_new"] and not d["trusted"]:
        risk = max(risk, 2)
    return {
        "id": d["mac"], "name": display_name(d, typ), "ip": ip, "mac": d["mac"],
        "type": typ, "firstSeen": reports.iso(d["first_seen"]),
        "status": "Online" if d["online"] else "Offline",
        "riskLevel": RISK[risk], "icon": icon,
        "incomingTraffic": fmt_bytes(incoming), "outgoingTraffic": fmt_bytes(outgoing),
        "observedConnections": [
            {"host": "%s:%d" % (f["dst"], f["dport"]) if f["dport"] else f["dst"],
             "protocol": label_proto(f["proto"], f["dport"])} for f in mine],
    }


def devices_payload() -> List[Dict[str, Any]]:
    risks, flows = _risk_map(), _flows()
    return [_device_payload(d, risks, flows) for d in db.get_devices()]


def device_payload(mac: str) -> Optional[Dict[str, Any]]:
    d = db.get_device(mac.lower())
    return _device_payload(d, _risk_map(), _flows()) if d else None


def _names() -> Dict[str, str]:
    return {x["ip"]: x["name"] for x in devices_payload()}


# ------------------------------------------------------------------ alertes
def _alert_payload(a: Dict[str, Any], names: Dict[str, str]) -> Dict[str, Any]:
    try:
        ev = json.loads(a.get("evidence") or "{}")
    except ValueError:
        ev = {}
    ev.setdefault("transferVolume", "n/a")
    ev.setdefault("baselineVariance", "n/a")
    ev.setdefault("destinationReputation", "n/a")
    target = a.get("dest_ip") or a["source_ip"]
    steps = reports.RECOMMENDATION_STEPS.get(a["type"]) or [
        reports.RECOMMENDATIONS.get(a["type"], "Monitor and investigate.")]
    return {
        "id": str(a["id"]), "alertId": "ALT-%04d" % a["id"],
        "title": reports.TYPE_LABELS.get(a["type"], a["type"]),
        "severity": a["severity"].capitalize(),
        "affectedDevice": "Whole network" if target == "réseau" else names.get(target, target),
        "sourceIp": a["source_ip"], "destinationIp": a.get("dest_ip") or "-",
        "timeDetected": reports.iso(a["ts"]),
        "status": a["status"].capitalize(), "description": a["description"],
        "evidence": ev, "recommendations": steps,
    }


def alert_payload(a: Dict[str, Any]) -> Dict[str, Any]:
    return _alert_payload(a, _names())


def alerts_payload(severity: Optional[str] = None, status: Optional[str] = None,
                   hours: int = 168, limit: int = 200) -> List[Dict[str, Any]]:
    rows = db.get_alerts(severity.lower() if severity else None,
                         status.lower() if status else None,
                         int(time.time()) - hours * 3600, limit)
    names = _names()
    return [_alert_payload(a, names) for a in rows]


def events_payload(limit: int = 20) -> List[Dict[str, Any]]:
    return [{"id": str(a["id"]),
             "title": reports.TYPE_LABELS.get(a["type"], a["type"]),
             "sourceIp": a["source_ip"], "timestamp": reports.iso(a["ts"]),
             "severity": a["severity"].capitalize(), "status": a["status"].capitalize()}
            for a in db.get_alerts(limit=limit)]


# ------------------------------------------------------------------ trafic
def overview_payload() -> Dict[str, Any]:
    now = int(time.time())
    devs = db.get_devices()
    online = sum(1 for d in devs if d["online"])
    cur = db.get_bytes_between(now - DAY, now + 1)
    prev = db.get_bytes_between(now - 2 * DAY, now - DAY)
    delta = (cur - prev) / float(prev) * 100 if prev else 0.0
    return {
        "connectedDevices": len(devs), "onlineDevices": online,
        "offlineDevices": len(devs) - online,
        "networkTrafficGB": round(cur / 1e9, 3),
        "activeAlerts": db.count_open_alerts()["total"],
        "suspiciousEvents24h": len(db.get_alerts(since=now - DAY, limit=5000)),
        "availabilityRate": round(online * 100.0 / len(devs), 1) if devs else 100.0,
        "trafficDeltaPercent": round(delta, 1),
    }


def traffic_overview_payload(range_: str = "24H") -> Dict[str, Any]:
    minutes = RANGES.get(range_.upper(), 1440)
    since = _since(minutes)
    local = {d["ip"] for d in db.get_devices()}
    flows = _flows(minutes)

    incoming = sum(f["bytes"] for f in flows if f["src"] not in local and f["dst"] in local)
    outgoing = sum(f["bytes"] for f in flows if f["src"] in local)
    bucket = 10 if minutes <= 60 else 60 if minutes <= 360 else 300
    series = db.get_traffic(since, bucket)
    total = db.get_protocol_totals(since)
    peak = max((r["bytes"] / float(bucket) for r in series), default=0)

    # Répartition par protocole (HTTPS/HTTP/TCP/UDP/DNS) : détail des 24 h.
    counts = {}  # type: Dict[str, float]
    if minutes <= 1440 and flows:
        for f in flows:
            k = label_proto(f["proto"], f["dport"])
            k = k if k in PROTO_COLORS else "Other"
            counts[k] = counts.get(k, 0) + f["packets"]
    else:
        counts = {"TCP": total["tcp"], "UDP": total["udp"], "DNS": total["dns"],
                  "Other": total["icmp"] + total["arp"] + total["other"]}
    s = float(sum(counts.values())) or 1.0
    protocols = [{"name": k, "value": round(v * 100 / s, 1),
                  "color": PROTO_COLORS.get(k, "muted")}
                 for k, v in sorted(counts.items(), key=lambda kv: -kv[1]) if v]

    by_src = {}  # type: Dict[str, int]
    by_dev = {}  # type: Dict[str, int]
    for f in flows:
        by_src[f["src"]] = by_src.get(f["src"], 0) + f["bytes"]
        for ip in (f["src"], f["dst"]):
            if ip in local:
                by_dev[ip] = by_dev.get(ip, 0) + f["bytes"]

    def top(d: Dict[str, int], label=lambda k: k) -> List[Dict[str, Any]]:
        items = sorted(d.items(), key=lambda kv: -kv[1])[:5]
        mx = float(items[0][1]) if items else 1.0
        return [{"name": label(k), "value": fmt_bytes(v),
                 "width": max(3, int(v * 100 / mx))} for k, v in items]

    names = _names()
    return {
        "incomingTotal": fmt_bytes(incoming), "outgoingTotal": fmt_bytes(outgoing),
        "peakThroughput": fmt_rate(peak), "totalVolume": fmt_bytes(total["bytes"]),
        "protocols": protocols, "topSources": top(by_src),
        "activeDevices": top(by_dev, lambda ip: names.get(ip, ip)),
        # champ supplémentaire (courbe de volume), ignoré par l'ancien type
        "timeline": [{"ts": r["ts"], "time": reports.iso(r["ts"]),
                      "bytes": r["bytes"], "packets": r["packets"]} for r in series],
    }


def records_payload(limit: int = 100) -> List[Dict[str, Any]]:
    local = {d["ip"] for d in db.get_devices()}
    rows = db.get_recent_connections(_since(1440), limit)
    out = []
    for r in rows:
        pkts = r["packets"] or 1
        out.append({
            "id": str(r["id"]), "timestamp": reports.iso(r["ts"]),
            "sourceIp": r["src"], "destinationIp": r["dst"],
            "protocol": label_proto(r["proto"], r["dport"]),
            "port": str(r["dport"]) if r["dport"] else "-",
            "packetSize": fmt_bytes(r["bytes"] / float(pkts)),
            "direction": "Outgoing" if r["src"] in local else "Incoming",
        })
    return out


# ----------------------------------------------------- rapports / paramètres
def settings_payload() -> Dict[str, Any]:
    cfg = dict(DEFAULT_SETTINGS)
    cfg.update({k: v for k, v in db.get_settings().items() if k in DEFAULT_SETTINGS})
    return cfg


def save_settings(values: Dict[str, Any]) -> Dict[str, Any]:
    db.set_settings({k: v for k, v in values.items() if k in DEFAULT_SETTINGS})
    return settings_payload()
