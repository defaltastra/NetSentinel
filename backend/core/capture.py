"""Capture des paquets (Scapy) + statistiques + simulateur de trafic.

Fonctionnement :
  * `parse_packet` transforme un paquet Scapy en petit dictionnaire ;
  * `TrafficMonitor.handle` compte et transmet le paquet au détecteur ;
  * un thread « tick » (1 fois par seconde) émet le trafic en direct ;
  * toutes les WINDOW secondes, on écrit un agrégat dans SQLite.
"""
import os
import random
import threading
import time
from collections import deque
from typing import Any, Callable, Dict, List, Optional

from . import database as db

WINDOW = int(os.environ.get("NETSENTINEL_WINDOW", "10"))
COUNT_KEYS = ("packets", "bytes", "tcp", "udp", "dns", "icmp", "arp", "other")


def _counter() -> Dict[str, int]:
    return {k: 0 for k in COUNT_KEYS}


# ------------------------------------------------------------------ parsing
def parse_packet(pkt) -> Optional[Dict[str, Any]]:
    """Paquet Scapy -> dictionnaire simple (ou None si sans intérêt)."""
    from scapy.all import ARP, DNS, ICMP, IP, TCP, UDP

    size = len(pkt)
    if ARP in pkt:
        a = pkt[ARP]
        return {"proto": "ARP", "src": a.psrc, "dst": a.pdst, "sport": 0,
                "dport": 0, "size": size, "flags": 0, "arp_op": int(a.op),
                "arp_mac": a.hwsrc}
    if IP not in pkt:
        return None
    ip = pkt[IP]
    info = {"src": ip.src, "dst": ip.dst, "sport": 0, "dport": 0,
            "size": size, "flags": 0, "proto": "OTHER"}
    if TCP in pkt:
        t = pkt[TCP]
        info.update(proto="TCP", sport=int(t.sport), dport=int(t.dport),
                    flags=int(t.flags))
    elif UDP in pkt:
        u = pkt[UDP]
        info.update(proto="UDP", sport=int(u.sport), dport=int(u.dport))
    elif ICMP in pkt:
        info["proto"] = "ICMP"
    # DNS : port 53, ou couche DNS reconnue. On garde TCP/UDP en dessous.
    if info["proto"] in ("UDP", "TCP") and (53 in (info["sport"], info["dport"])
                                             or pkt.haslayer(DNS)):
        info["is_query"] = info["dport"] == 53
        info["proto"] = "DNS"
    return info


# ------------------------------------------------------------------ moniteur
class TrafficMonitor:
    def __init__(self, detector, on_event: Optional[Callable[[str, Any], None]] = None,
                 iface: Optional[str] = None):
        self.detector = detector
        self.on_event = on_event
        self.iface = iface
        self.lock = threading.Lock()
        self._stop = threading.Event()
        self._sec = _counter()
        self._win = _counter()
        self._ips = set()      # type: set
        self._ports = set()    # type: set
        self._flows = {}       # type: Dict[tuple, List[int]]
        self._ticks = 0
        self.live = deque(maxlen=300)      # dernières secondes (pour le graphique)
        self.last_sec = _counter()
        self.error = None      # type: Optional[str]
        self.running = False
        self.own_ip = None     # type: Optional[str]

    # --------------------------------------------------------- comptage
    def handle(self, p: Dict[str, Any]) -> None:
        if (self.own_ip and p["proto"] == "ARP" and p.get("arp_op") == 1
                and p["src"] == self.own_ip):
            return
        kind = p["proto"].lower()
        if kind not in ("tcp", "udp", "dns", "icmp", "arp"):
            kind = "other"
        with self.lock:
            for c in (self._sec, self._win):
                c["packets"] += 1
                c["bytes"] += p["size"]
                c[kind] += 1
            self._ips.add(p["src"])
            self._ips.add(p["dst"])
            if p["dport"]:
                self._ports.add(p["dport"])
            key = (p["src"], p["dst"], p["dport"], p["proto"])
            fl = self._flows.setdefault(key, [0, 0])
            fl[0] += 1
            fl[1] += p["size"]
        self.detector.on_packet(p)

    # ---------------------------------------------------------- threads
    def start(self, mode: str = "live") -> None:
        self.running = True
        threading.Thread(target=self._tick_loop, daemon=True, name="tick").start()
        if mode == "live":
            threading.Thread(target=self._sniff_loop, daemon=True, name="sniff").start()

    def stop(self) -> None:
        self._stop.set()
        self.running = False

    def _sniff_loop(self) -> None:
        try:
            from scapy.all import sniff
            sniff(iface=self.iface, store=False, prn=self._on_scapy_packet,
                  stop_filter=lambda _p: self._stop.is_set())
        except PermissionError:
            self.error = ("Droits insuffisants : lance le serveur avec sudo "
                          "(sudo venv/bin/python -m uvicorn ...)")
        except Exception as exc:  # interface inconnue, libpcap absente...
            self.error = "Erreur de capture : %s" % exc

    def _on_scapy_packet(self, pkt) -> None:
        try:
            info = parse_packet(pkt)
            if info:
                self.handle(info)
        except Exception:
            pass

    def _tick_loop(self) -> None:
        nxt = time.time() + 1
        while not self._stop.is_set():
            time.sleep(max(0.0, nxt - time.time()))
            nxt += 1
            if time.time() - nxt > 3:
                nxt = time.time() + 1
                continue
            try:
                self._tick()
            except Exception as exc:
                self.error = "tick: %s" % exc

    def _tick(self) -> None:
        with self.lock:
            sec, self._sec = self._sec, _counter()
            for k in COUNT_KEYS:
                self._win[k] += sec[k]
            self._ticks += 1
            window_done = self._ticks % WINDOW == 0
            if window_done:
                win, self._win = self._win, _counter()
                ips, ports, flows = self._ips, self._ports, self._flows
                self._ips, self._ports, self._flows = set(), set(), {}
        self.last_sec = sec
        point = dict(sec, ts=int(time.time()))
        self.live.append(point)
        if self.on_event:
            self.on_event("traffic", point)
        if not window_done:
            return
        ts = int(time.time())
        db.insert_traffic(ts, win)
        top = sorted(flows.items(), key=lambda kv: kv[1][1], reverse=True)[:100]
        db.insert_connections(ts, [(k[0], k[1], k[2], k[3], v[0], v[1])
                                   for k, v in top])
        n = win["packets"]
        feats = {
            "packets": n, "bytes": win["bytes"],
            "uniq_ips": len(ips), "uniq_ports": len(ports),
            "tcp_ratio": win["tcp"] / n if n else 0.0,
            "udp_ratio": win["udp"] / n if n else 0.0,
            "dns_ratio": win["dns"] / n if n else 0.0,
            "avg_size": win["bytes"] / n if n else 0.0,
        }
        if n:  # une fenêtre vide ne dit rien sur le trafic « normal »
            db.insert_features(ts, feats)
        self.detector.on_window(feats)
        if self._ticks % (WINDOW * 360) == 0:
            now = int(time.time())
            db.prune(now - 7 * 86400, now - 86400)


# ---------------------------------------------------------------- simulateur
class Simulator:
    """Génère du trafic réaliste et des attaques pour tester sans root."""

    GATEWAY = ("192.168.1.1", "aa:bb:cc:00:00:01")
    HOSTS = [
        ("192.168.1.10", "3c:22:fb:11:22:33", "MacBook de Sara"),
        ("192.168.1.11", "f0:18:98:44:55:66", "iPhone de Youssef"),
        ("192.168.1.12", "b8:27:eb:77:88:99", "Raspberry Pi"),
        ("192.168.1.20", "00:1a:79:aa:bb:cc", "Smart TV"),
    ]
    EXTERNAL = ["142.250.74.46", "151.101.1.69", "104.18.32.7", "13.107.42.14"]

    def __init__(self, monitor: TrafficMonitor):
        self.monitor = monitor
        self._stop = threading.Event()
        self.extra_devices = []   # type: List[Dict[str, str]]
        self.running = False

    def start(self) -> None:
        self.running = True
        threading.Thread(target=self._loop, daemon=True, name="simulator").start()

    def stop(self) -> None:
        self._stop.set()

    def devices(self) -> List[Dict[str, str]]:
        base = [{"ip": self.GATEWAY[0], "mac": self.GATEWAY[1]}]
        base += [{"ip": ip, "mac": mac} for ip, mac, _ in self.HOSTS]
        return base + list(self.extra_devices)

    def _pkt(self, **kw) -> Dict[str, Any]:
        p = {"sport": 0, "dport": 0, "size": 100, "flags": 0}
        p.update(kw)
        self.monitor.handle(p)

    def _loop(self) -> None:
        last_attack = time.time()
        attack_types = ["portscan", "synflood", "dnsflood", "arpspoof", "spike", "telnet"]
        initial_attack_done = False

        while not self._stop.is_set():
            now = time.time()
            if not initial_attack_done and now - last_attack > 4.0:
                self.inject("portscan")
                initial_attack_done = True
                last_attack = now
            elif now - last_attack > random.uniform(25.0, 50.0):
                chosen = random.choice(attack_types)
                self.inject(chosen)
                last_attack = now

            time.sleep(random.uniform(0.005, 0.03))
            ip = random.choice(self.HOSTS)[0]
            r = random.random()
            if r < 0.04:
                self._pkt(proto="DNS", src=ip, dst=self.GATEWAY[0], sport=40000,
                          dport=53, size=random.randint(70, 120), is_query=True)
            elif r < 0.14:
                self._pkt(proto="UDP", src=ip, dst=random.choice(self.EXTERNAL),
                          sport=50000, dport=443, size=random.randint(300, 1300))
            elif r < 0.16:
                self._pkt(proto="ICMP", src=ip, dst=self.GATEWAY[0], size=84)
            else:
                self._pkt(proto="TCP", src=ip, dst=random.choice(self.EXTERNAL),
                          sport=random.randint(40000, 60000),
                          dport=random.choice([443, 443, 443, 80]),
                          size=random.randint(60, 1500), flags=0x18)

    # ------------------------------------------------------- attaques
    def inject(self, kind: str) -> bool:
        attacks = {"portscan": self._portscan, "synflood": self._synflood,
                   "dnsflood": self._dnsflood, "arpspoof": self._arpspoof,
                   "spike": self._spike, "newdevice": self._newdevice,
                   "telnet": self._telnet}
        fn = attacks.get(kind)
        if not fn:
            return False
        threading.Thread(target=fn, daemon=True).start()
        return True

    def _portscan(self) -> None:
        for port in range(1, 61):
            self._pkt(proto="TCP", src="192.168.1.99", dst="192.168.1.10",
                      sport=44444, dport=port, size=60, flags=0x02)
            time.sleep(0.02)

    def _synflood(self) -> None:
        for _ in range(250):
            self._pkt(proto="TCP", src="192.168.1.77", dst="192.168.1.12",
                      sport=random.randint(1024, 65000), dport=80, size=60, flags=0x02)
            time.sleep(0.004)

    def _dnsflood(self) -> None:
        for _ in range(400):
            self._pkt(proto="DNS", src="192.168.1.11", dst=self.GATEWAY[0],
                      sport=40001, dport=53, size=90, is_query=True)
            time.sleep(0.005)

    def _arpspoof(self) -> None:
        gw_ip, gw_mac = self.GATEWAY
        self._pkt(proto="ARP", src=gw_ip, dst="192.168.1.10", arp_op=2, arp_mac=gw_mac)
        time.sleep(0.2)
        self._pkt(proto="ARP", src=gw_ip, dst="192.168.1.10", arp_op=2,
                  arp_mac="de:ad:be:ef:00:66")

    def _spike(self) -> None:
        end = time.time() + WINDOW * 1.5
        while time.time() < end:
            for _ in range(60):
                self._pkt(proto="UDP", src="192.168.1.20", dst="8.8.4.4", sport=5000,
                          dport=443, size=1400)
            time.sleep(0.01)

    def _telnet(self) -> None:
        self._pkt(proto="TCP", src="192.168.1.12", dst="203.0.113.50",
                  sport=40100, dport=4444, size=60, flags=0x02)

    def _newdevice(self) -> None:
        self.extra_devices.append({"ip": "192.168.1.150", "mac": "02:42:ac:11:00:99"})
