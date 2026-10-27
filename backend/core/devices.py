"""Détection des appareils du réseau local par scan ARP."""
import concurrent.futures
import ipaddress
import os
import re
import socket
import subprocess
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from . import database as db

_vendor = None
_vendor_tried = False


def local_network(iface: Optional[str] = None) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Retourne (interface, réseau CIDR, IP locale) sans dépendance externe.

    Utilise `ip route get` : trouve l'interface qui sort vers Internet, donc
    évite docker0 / virbr0 qui perturbent Scapy sur une VM de labo.
    """
    try:
        if not iface:
            out = subprocess.check_output(["ip", "-o", "-4", "route", "get", "8.8.8.8"],
                                          text=True, timeout=3)
            m = re.search(r"dev (\S+)", out)
            iface = m.group(1) if m else None
        if not iface:
            return None, None, None
        out = subprocess.check_output(["ip", "-o", "-f", "inet", "addr", "show", "dev", iface],
                                      text=True, timeout=3)
        m = re.search(r"inet (\d+\.\d+\.\d+\.\d+/\d+)", out)
        if not m:
            return iface, None, None
        itf = ipaddress.ip_interface(m.group(1))
        net = itf.network
        if net.prefixlen < 22:  # évite de scanner 65 000 adresses
            net = ipaddress.ip_network("%s/24" % itf.ip, strict=False)
        return iface, str(net), str(itf.ip)
    except Exception:
        return iface, None, None


def _vendor_lookup(mac: str) -> str:
    global _vendor, _vendor_tried
    first = int(mac.split(":")[0], 16)
    if first & 0x02:  # bit « administré localement » = MAC aléatoire/privée
        return "MAC aléatoire (téléphone en mode privé ?)"
    if not _vendor_tried:
        _vendor_tried = True
        try:
            from mac_vendor_lookup import MacLookup
            _vendor = MacLookup()
        except Exception:
            _vendor = None
    if _vendor is None:
        return "Inconnu"
    try:
        return _vendor.lookup(mac)
    except Exception:
        return "Inconnu"


def resolve_hostname(ip: str, timeout: float = 2.0) -> str:
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(socket.gethostbyaddr, ip)
        try:
            return fut.result(timeout=timeout)[0]
        except Exception:
            return ""


def arp_scan(cidr: str, iface: Optional[str] = None, own_ip: Optional[str] = None,
             timeout: int = 3) -> List[Dict[str, str]]:
    from scapy.all import ARP, Ether, get_if_hwaddr, srp

    ans, _ = srp(Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=cidr), timeout=timeout,
                 iface=iface, verbose=False)
    found = {r.hwsrc.lower(): r.psrc for _, r in ans}
    if own_ip and iface:  # sa propre machine ne répond pas à son propre scan
        try:
            found[get_if_hwaddr(iface).lower()] = own_ip
        except Exception:
            pass
    return [{"ip": ip, "mac": mac} for mac, ip in found.items()]


class DeviceMonitor(threading.Thread):
    """Scanne régulièrement et signale les appareils jamais vus."""

    def __init__(self, scan_fn: Callable[[], List[Dict[str, str]]],
                 on_new_device: Callable[[Dict[str, Any]], None],
                 on_event: Optional[Callable[[str, Any], None]] = None,
                 interval: int = 60, resolve_names: bool = True):
        super().__init__(daemon=True, name="device-monitor")
        self.scan_fn = scan_fn
        self.on_new_device = on_new_device
        self.on_event = on_event
        self.interval = interval
        self.resolve_names = resolve_names
        self._stop_evt = threading.Event()
        self.error = None  # type: Optional[str]
        self.last_scan = 0

    def stop(self) -> None:
        self._stop_evt.set()

    def run(self) -> None:
        while not self._stop_evt.is_set():
            try:
                self.scan_once()
                self.error = None
            except PermissionError:
                self.error = "Scan ARP impossible : lance le serveur avec sudo"
            except Exception as exc:
                self.error = "Scan ARP : %s" % exc
            self._stop_evt.wait(self.interval)

    def scan_once(self) -> int:
        found = self.scan_fn()
        now = int(time.time())
        # Premier scan sur une base vide = référence : on ne crie pas « nouvel
        # appareil » pour tout ce qui est déjà là.
        baseline = db.count_devices() == 0
        for d in found:
            mac, ip = d["mac"].lower(), d["ip"]
            known = db.device_exists(mac)
            vendor = "" if known else _vendor_lookup(mac)
            host = ""
            if not known and self.resolve_names:
                host = resolve_hostname(ip)
            is_new = db.upsert_device(mac, ip, vendor, host, now, baseline)
            if is_new:
                dev = {"mac": mac, "ip": ip, "vendor": vendor, "hostname": host,
                       "first_seen": now}
                self.on_new_device(dev)
        db.mark_offline(now - int(self.interval * 2.5))
        self.last_scan = now
        if self.on_event:
            self.on_event("devices", {"count": len(found), "ts": now})
        return len(found)
