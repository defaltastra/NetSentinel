"""Détection d'anomalies par règles (+ modèle ML optionnel).

Chaque règle regarde une fenêtre glissante par adresse IP source.
Un « cooldown » évite d'envoyer 500 fois la même alerte.
Chaque alerte porte aussi ses « preuves » (evidence) affichées par le frontend.
"""
import ipaddress
import json
import statistics
import threading
import time
from collections import defaultdict, deque
from typing import Any, Callable, Dict, Optional

from . import database as db

SUSPICIOUS_PORTS = {
    23: "Telnet (non chiffré)",
    2323: "Telnet alternatif",
    4444: "port typique de Metasploit",
    5555: "ADB / porte dérobée",
    6667: "IRC (botnets)",
    31337: "port « elite » de portes dérobées",
    1337: "port de portes dérobées",
}

DEFAULT_CFG = {
    "scan_ports": 20,       # ports distincts contactés ...
    "scan_window": 10,      # ... en N secondes => scan de ports
    "syn_count": 100,       # SYN sans ACK ...
    "syn_window": 5,        # ... en N secondes => SYN flood
    "dns_count": 300,       # requêtes DNS ...
    "dns_window": 60,       # ... en N secondes => DNS suspect
    "cooldown": 60,         # secondes entre deux alertes identiques
    "spike_z": 3.0,         # seuil du z-score
    "spike_min_windows": 6, # historique minimal avant de juger
    "spike_min_packets": 2000,
    "spike_min_bytes": 3000000,
}

TCP_SYN, TCP_ACK = 0x02, 0x10


def reputation(ip: str) -> str:
    """Réputation très simple d'une destination (pas de base de menaces)."""
    try:
        if ipaddress.ip_address(ip).is_private:
            return "Internal host (private range)"
    except ValueError:
        return "Unknown"
    return "External host (reputation unknown)"


def _ev(volume: str, baseline: str, dest: str) -> Dict[str, str]:
    return {"transferVolume": volume, "baselineVariance": baseline,
            "destinationReputation": dest}


class Detector:
    def __init__(self, on_alert: Optional[Callable[[Dict[str, Any]], None]] = None,
                 cfg: Optional[Dict[str, float]] = None):
        self.cfg = dict(DEFAULT_CFG)
        if cfg:
            self.cfg.update(cfg)
        self.on_alert = on_alert
        self.lock = threading.Lock()
        self._syns = defaultdict(deque)   # src -> deque[(ts, dport)]
        self._dns = defaultdict(deque)    # src -> deque[ts]
        self._arp = {}                    # ip -> mac
        self._last = {}                   # (type, clé) -> ts de la dernière alerte
        self._pkt_hist = deque(maxlen=60)
        self._byte_hist = deque(maxlen=60)
        self.ml = None                    # MLDetector optionnel

    # ------------------------------------------------------------ alertes
    def raise_alert(self, type_: str, severity: str, source_ip: str,
                    description: str, key: str = "", dest_ip: str = "",
                    evidence: Optional[Dict[str, str]] = None) -> Optional[Dict[str, Any]]:
        now = time.time()
        k = (type_, key or source_ip)
        with self.lock:
            if now - self._last.get(k, 0) < self.cfg["cooldown"]:
                return None
            self._last[k] = now
        ts = int(now)
        ev = json.dumps(evidence or {})
        alert_id = db.insert_alert(ts, type_, severity, source_ip, description,
                                   dest_ip, ev)
        alert = {"id": alert_id, "ts": ts, "type": type_, "severity": severity,
                 "source_ip": source_ip, "description": description,
                 "status": "open", "dest_ip": dest_ip, "evidence": ev}
        if self.on_alert:
            try:
                self.on_alert(alert)
            except Exception:  # ne jamais casser la capture à cause d'un callback
                pass
        return alert

    # ------------------------------------------------------------ paquets
    def on_packet(self, p: Dict[str, Any]) -> None:
        now = time.time()
        src, dst, proto = p["src"], p["dst"], p["proto"]
        c = self.cfg

        if proto == "ARP":
            self._check_arp(p)
            return

        if proto == "TCP":
            flags = p.get("flags", 0)
            if flags & TCP_SYN and not flags & TCP_ACK:
                self._check_syn(src, dst, p["dport"], now)
            if p["dport"] in SUSPICIOUS_PORTS:
                self.raise_alert(
                    "suspicious_port", "medium", src,
                    "Connexion de %s vers %s:%d (%s)"
                    % (src, dst, p["dport"], SUSPICIOUS_PORTS[p["dport"]]),
                    key="%s:%d" % (src, p["dport"]), dest_ip=dst,
                    evidence=_ev("1 connection attempt to port %d" % p["dport"],
                                 "Port %d (%s) is rarely used legitimately"
                                 % (p["dport"], SUSPICIOUS_PORTS[p["dport"]]),
                                 reputation(dst)))

        if proto == "DNS" and p.get("is_query"):
            dq = self._dns[src]
            dq.append(now)
            while dq and now - dq[0] > c["dns_window"]:
                dq.popleft()
            if len(dq) >= c["dns_count"]:
                self.raise_alert(
                    "dns_anomaly", "medium", src,
                    "%s a envoyé %d requêtes DNS en %ds (malware ou tunnel DNS ?)"
                    % (src, len(dq), c["dns_window"]), dest_ip=dst,
                    evidence=_ev("%d DNS queries in %ds" % (len(dq), c["dns_window"]),
                                 "Normal: under %d queries/min per device" % (c["dns_count"] // 3),
                                 reputation(dst)))

    def _check_syn(self, src: str, dst: str, dport: int, now: float) -> None:
        c = self.cfg
        dq = self._syns[src]
        dq.append((now, dport))
        horizon = max(c["scan_window"], c["syn_window"])
        while dq and now - dq[0][0] > horizon:
            dq.popleft()
        scan_ports = {port for t, port in dq if now - t <= c["scan_window"]}
        recent = [1 for t, _ in dq if now - t <= c["syn_window"]]
        if len(scan_ports) >= c["scan_ports"]:
            n = len(scan_ports)
            self.raise_alert(
                "port_scan", "high", src,
                "%s a contacté %d ports différents en %ds (scan de ports, cible %s)"
                % (src, n, c["scan_window"], dst), dest_ip=dst,
                evidence=_ev("%d SYN packets to %d distinct ports" % (len(dq), n),
                             "Normal: fewer than 5 distinct ports per %ds; observed %d"
                             % (c["scan_window"], n),
                             reputation(dst)))
        elif len(recent) >= c["syn_count"]:
            rate = len(recent) / float(c["syn_window"])
            self.raise_alert(
                "syn_flood", "critical", src,
                "%s a envoyé %d paquets SYN en %ds vers %s:%d (SYN flood / DoS)"
                % (src, len(recent), c["syn_window"], dst, dport), dest_ip=dst,
                evidence=_ev("%d SYN packets in %ds" % (len(recent), c["syn_window"]),
                             "Normal: a few SYN/s; observed %.0f SYN/s" % rate,
                             reputation(dst)))

    def _check_arp(self, p: Dict[str, Any]) -> None:
        if p.get("arp_op") != 2:        # on ne juge que les réponses (is-at)
            return
        ip, mac = p["src"], p.get("arp_mac", "").lower()
        if not ip or not mac or ip == "0.0.0.0":
            return
        with self.lock:
            old = self._arp.get(ip)
            self._arp[ip] = mac
        if old and old != mac:
            self.raise_alert(
                "arp_spoofing", "critical", ip,
                "L'IP %s est annoncée par deux MAC différentes (%s puis %s) :"
                " usurpation ARP possible (attaque de l'homme du milieu)"
                % (ip, old, mac),
                evidence=_ev("2 conflicting ARP replies for %s" % ip,
                             "MAC changed from %s to %s" % (old, mac),
                             "Local network segment (layer 2)"))

    # ----------------------------------------------------------- fenêtres
    def on_window(self, f: Dict[str, float]) -> None:
        """Appelé toutes les N secondes avec les statistiques de la fenêtre."""
        c = self.cfg
        # Une seule alerte par fenêtre, qu'elle vienne des paquets ou des octets.
        # Plancher absolu : un petit téléchargement sur un réseau calme n'est pas
        # un pic ; l'écart-type est borné pour éviter des z-scores absurdes.
        verdicts = []
        for name, hist, unit, floor in (
                ("paquets", self._pkt_hist, "packets", c["spike_min_packets"]),
                ("octets", self._byte_hist, "bytes", c["spike_min_bytes"])):
            value = f[unit]
            if len(hist) >= c["spike_min_windows"] and value >= floor:
                mean = statistics.mean(hist)
                sd = max(statistics.pstdev(hist), 0.25 * mean, 1.0)
                z = (value - mean) / sd
                if z > c["spike_z"] and value > 2 * mean:
                    verdicts.append((name, unit, value, mean, z))
            hist.append(value)
        if verdicts:
            name, unit, value, mean, z = max(verdicts, key=lambda v: v[4])
            self.raise_alert(
                "traffic_spike", "high", "réseau",
                "Pic de trafic : %d %s dans la fenêtre (moyenne %d, z-score %.1f)"
                % (value, name, mean, z),
                key="spike",
                evidence=_ev("%d packets, %d bytes in one window"
                             % (f["packets"], f["bytes"]),
                             "+%.0f%% vs average (z-score %.1f)"
                             % ((value / mean - 1) * 100 if mean else 0, z),
                             "Whole network"))

        if self.ml is not None and self.ml.is_ready():
            try:
                if self.ml.is_anomaly(f):
                    self.raise_alert(
                        "ml_anomaly", "medium", "réseau",
                        "Le modèle Isolation Forest juge cette fenêtre de trafic anormale"
                        " (%d paquets, %d IP distinctes, %d ports distincts)"
                        % (f["packets"], f["uniq_ips"], f["uniq_ports"]),
                        key="ml",
                        evidence=_ev("%d packets, %d bytes" % (f["packets"], f["bytes"]),
                                     "Outside the profile learned by Isolation Forest",
                                     "Whole network"))
            except Exception:
                pass
        self._prune()

    def _prune(self) -> None:
        """Évite que les dictionnaires grossissent sans fin."""
        now = time.time()
        with self.lock:
            for d, age in ((self._syns, 30), (self._dns, self.cfg["dns_window"])):
                for k in list(d.keys()):
                    q = d[k]
                    while q and now - (q[0][0] if isinstance(q[0], tuple) else q[0]) > age:
                        q.popleft()
                    if not q:
                        del d[k]
            for k in [k for k, t in self._last.items() if now - t > 3600]:
                del self._last[k]
