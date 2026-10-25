"""Base de données SQLite de NetSentinel.

Une seule connexion partagée, protégée par un verrou (threads : capture,
scan, serveur web). Les dates sont stockées en secondes epoch (entiers).
"""
import os
import sqlite3
import threading
import time
from typing import Any, Dict, List, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get(
    "NETSENTINEL_DB", os.path.join(BASE_DIR, "data", "netsentinel.db")
)

_lock = threading.RLock()
_conn = None  # type: Optional[sqlite3.Connection]

SCHEMA = """
CREATE TABLE IF NOT EXISTS traffic_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    packets INTEGER, bytes INTEGER,
    tcp INTEGER, udp INTEGER, dns INTEGER, icmp INTEGER, arp INTEGER, other INTEGER
);
CREATE INDEX IF NOT EXISTS idx_traffic_ts ON traffic_stats(ts);

CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    src TEXT, dst TEXT, dport INTEGER, proto TEXT,
    packets INTEGER, bytes INTEGER
);
CREATE INDEX IF NOT EXISTS idx_conn_ts ON connections(ts);

CREATE TABLE IF NOT EXISTS devices (
    mac TEXT PRIMARY KEY,
    ip TEXT, vendor TEXT, hostname TEXT,
    first_seen INTEGER, last_seen INTEGER,
    online INTEGER DEFAULT 1,
    is_new INTEGER DEFAULT 0,
    trusted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    source_ip TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    dest_ip TEXT DEFAULT '',
    evidence TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(ts);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    packets REAL, bytes REAL, uniq_ips REAL, uniq_ports REAL,
    tcp_ratio REAL, udp_ratio REAL, dns_ratio REAL, avg_size REAL
);
"""


def init_db(path: Optional[str] = None) -> None:
    global _conn, DB_PATH
    if path:
        DB_PATH = path
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    with _lock:
        if _conn is not None:
            _conn.close()
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.executescript(SCHEMA)
        for col in ("dest_ip TEXT DEFAULT ''", "evidence TEXT DEFAULT ''"):
            try:  # anciennes bases : on ajoute les colonnes manquantes
                _conn.execute("ALTER TABLE alerts ADD COLUMN " + col)
            except sqlite3.OperationalError:
                pass
        _conn.commit()


def _q(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with _lock:
        cur = _conn.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]


def _x(sql: str, params: tuple = ()) -> int:
    with _lock:
        cur = _conn.execute(sql, params)
        _conn.commit()
        return cur.lastrowid


# ----------------------------------------------------------------- trafic
def insert_traffic(ts: int, c: Dict[str, int]) -> None:
    _x(
        "INSERT INTO traffic_stats(ts,packets,bytes,tcp,udp,dns,icmp,arp,other)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (ts, c["packets"], c["bytes"], c["tcp"], c["udp"], c["dns"],
         c["icmp"], c["arp"], c["other"]),
    )


def get_traffic(since: int, bucket: int) -> List[Dict[str, Any]]:
    """Trafic regroupé par tranches de `bucket` secondes."""
    return _q(
        "SELECT (ts/?)*? AS ts, SUM(packets) AS packets, SUM(bytes) AS bytes,"
        " SUM(tcp) AS tcp, SUM(udp) AS udp, SUM(dns) AS dns, SUM(icmp) AS icmp,"
        " SUM(arp) AS arp, SUM(other) AS other"
        " FROM traffic_stats WHERE ts>=? GROUP BY ts/? ORDER BY ts",
        (bucket, bucket, since, bucket),
    )


def get_protocol_totals(since: int) -> Dict[str, int]:
    rows = _q(
        "SELECT COALESCE(SUM(tcp),0) tcp, COALESCE(SUM(udp),0) udp,"
        " COALESCE(SUM(dns),0) dns, COALESCE(SUM(icmp),0) icmp,"
        " COALESCE(SUM(arp),0) arp, COALESCE(SUM(other),0) other,"
        " COALESCE(SUM(packets),0) packets, COALESCE(SUM(bytes),0) bytes"
        " FROM traffic_stats WHERE ts>=?",
        (since,),
    )
    return rows[0]


def insert_connections(ts: int, rows: List[tuple]) -> None:
    with _lock:
        _conn.executemany(
            "INSERT INTO connections(ts,src,dst,dport,proto,packets,bytes)"
            " VALUES(?,?,?,?,?,?,?)",
            [(ts,) + r for r in rows],
        )
        _conn.commit()


def get_connections(since: int, limit: int = 100) -> List[Dict[str, Any]]:
    return _q(
        "SELECT src,dst,dport,proto,SUM(packets) packets,SUM(bytes) bytes,"
        " MAX(ts) last_seen FROM connections WHERE ts>=?"
        " GROUP BY src,dst,dport,proto ORDER BY bytes DESC LIMIT ?",
        (since, limit),
    )


def get_top_sources(since: int, limit: int = 5) -> List[Dict[str, Any]]:
    return _q(
        "SELECT src AS ip, SUM(packets) packets, SUM(bytes) bytes"
        " FROM connections WHERE ts>=? GROUP BY src ORDER BY bytes DESC LIMIT ?",
        (since, limit),
    )


# ------------------------------------------------------------ appareils
def device_exists(mac: str) -> bool:
    return bool(_q("SELECT 1 FROM devices WHERE mac=?", (mac,)))


def count_devices() -> int:
    return _q("SELECT COUNT(*) n FROM devices")[0]["n"]


def upsert_device(mac: str, ip: str, vendor: str, hostname: str,
                  now: int, baseline: bool) -> bool:
    """Retourne True si l'appareil est nouveau (hors scan de référence)."""
    with _lock:
        row = _q("SELECT mac FROM devices WHERE mac=?", (mac,))
        if row:
            _conn.execute(
                "UPDATE devices SET ip=?, last_seen=?, online=1,"
                " vendor=COALESCE(NULLIF(vendor,''),?),"
                " hostname=COALESCE(NULLIF(hostname,''),?) WHERE mac=?",
                (ip, now, vendor, hostname, mac),
            )
            _conn.commit()
            return False
        _conn.execute(
            "INSERT INTO devices(mac,ip,vendor,hostname,first_seen,last_seen,"
            "online,is_new,trusted) VALUES(?,?,?,?,?,?,1,?,?)",
            (mac, ip, vendor, hostname, now, now,
             0 if baseline else 1, 1 if baseline else 0),
        )
        _conn.commit()
        return not baseline


def mark_offline(before: int) -> None:
    _x("UPDATE devices SET online=0 WHERE last_seen<?", (before,))


def get_devices() -> List[Dict[str, Any]]:
    return _q("SELECT * FROM devices ORDER BY online DESC, last_seen DESC")


def trust_device(mac: str) -> bool:
    _x("UPDATE devices SET trusted=1, is_new=0 WHERE mac=?", (mac,))
    return device_exists(mac)


# --------------------------------------------------------------- alertes
def insert_alert(ts: int, type_: str, severity: str, source_ip: str,
                 description: str, dest_ip: str = "", evidence: str = "") -> int:
    return _x(
        "INSERT INTO alerts(ts,type,severity,source_ip,description,status,"
        "dest_ip,evidence) VALUES(?,?,?,?,?,'open',?,?)",
        (ts, type_, severity, source_ip, description, dest_ip, evidence),
    )


def get_alert(alert_id: int) -> Optional[Dict[str, Any]]:
    rows = _q("SELECT * FROM alerts WHERE id=?", (alert_id,))
    return rows[0] if rows else None


def get_alerts(severity: Optional[str] = None, status: Optional[str] = None,
               since: int = 0, limit: int = 200) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM alerts WHERE ts>=?"
    params = [since]  # type: List[Any]
    if severity:
        sql += " AND severity=?"
        params.append(severity)
    if status:
        sql += " AND status=?"
        params.append(status)
    sql += " ORDER BY ts DESC, id DESC LIMIT ?"
    params.append(limit)
    return _q(sql, tuple(params))


def set_alert_status(alert_id: int, status: str) -> bool:
    _x("UPDATE alerts SET status=? WHERE id=?", (status, alert_id))
    return bool(_q("SELECT 1 FROM alerts WHERE id=?", (alert_id,)))


def count_open_alerts() -> Dict[str, int]:
    rows = _q("SELECT severity, COUNT(*) n FROM alerts WHERE status='open'"
              " GROUP BY severity")
    out = {"total": 0}
    for r in rows:
        out[r["severity"]] = r["n"]
        out["total"] += r["n"]
    return out


# ------------------------------------------------------------- features
def insert_features(ts: int, f: Dict[str, float]) -> None:
    _x(
        "INSERT INTO features(ts,packets,bytes,uniq_ips,uniq_ports,tcp_ratio,"
        "udp_ratio,dns_ratio,avg_size) VALUES(?,?,?,?,?,?,?,?,?)",
        (ts, f["packets"], f["bytes"], f["uniq_ips"], f["uniq_ports"],
         f["tcp_ratio"], f["udp_ratio"], f["dns_ratio"], f["avg_size"]),
    )


def get_features(limit: int = 50000) -> List[Dict[str, Any]]:
    return _q("SELECT * FROM features ORDER BY ts DESC LIMIT ?", (limit,))


def prune(older_than_traffic: int, older_than_conn: int) -> None:
    with _lock:
        _conn.execute("DELETE FROM traffic_stats WHERE ts<?", (older_than_traffic,))
        _conn.execute("DELETE FROM features WHERE ts<?", (older_than_traffic,))
        _conn.execute("DELETE FROM connections WHERE ts<?", (older_than_conn,))
        _conn.commit()


def now() -> int:
    return int(time.time())


# ------------------------------------------------- compléments (frontend)
def get_device(mac: str) -> Optional[Dict[str, Any]]:
    rows = _q("SELECT * FROM devices WHERE mac=?", (mac,))
    return rows[0] if rows else None


def get_bytes_between(start: int, end: int) -> int:
    return _q("SELECT COALESCE(SUM(bytes),0) b FROM traffic_stats"
              " WHERE ts>=? AND ts<?", (start, end))[0]["b"]


def get_recent_connections(since: int, limit: int = 100) -> List[Dict[str, Any]]:
    return _q("SELECT * FROM connections WHERE ts>=? ORDER BY ts DESC, bytes DESC"
              " LIMIT ?", (since, limit))


def get_settings() -> Dict[str, Any]:
    import json
    out = {}
    for r in _q("SELECT key, value FROM settings"):
        try:
            out[r["key"]] = json.loads(r["value"])
        except ValueError:
            pass
    return out


def set_settings(values: Dict[str, Any]) -> None:
    import json
    with _lock:
        for k, v in values.items():
            _conn.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)",
                          (k, json.dumps(v)))
        _conn.commit()
