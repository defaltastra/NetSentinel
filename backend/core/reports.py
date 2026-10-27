"""Rapports : résumé des événements, recommandations, HTML et CSV."""
import csv
import io
import time
from typing import Any, Dict, List

from jinja2 import Template

from . import database as db

TYPE_LABELS = {
    "port_scan": "Scan de ports",
    "syn_flood": "SYN flood (déni de service)",
    "arp_spoofing": "Usurpation ARP",
    "dns_anomaly": "Activité DNS suspecte",
    "traffic_spike": "Pic de trafic anormal",
    "new_device": "Nouvel appareil",
    "suspicious_port": "Port suspect",
    "ml_anomaly": "Anomalie détectée par l'IA",
}

RECOMMENDATIONS = {
    "port_scan": "Activer le pare-feu et fermer les ports inutiles. Bloquer l'IP "
                 "source si elle est inconnue.",
    "syn_flood": "Limiter le débit de connexions (rate limiting), activer la "
                 "protection anti-DoS de la box, isoler la machine émettrice.",
    "arp_spoofing": "Isoler immédiatement l'appareil concerné. Activer la "
                    "protection ARP (Dynamic ARP Inspection) et segmenter en VLAN.",
    "dns_anomaly": "Analyser l'appareil avec un antivirus, vérifier les domaines "
                   "interrogés et restreindre les serveurs DNS autorisés.",
    "traffic_spike": "Identifier l'appareil le plus bavard (top sources). Si le pic "
                     "n'est pas légitime, le déconnecter et l'analyser.",
    "new_device": "Vérifier que l'appareil est connu. Sinon, changer le mot de "
                  "passe Wi-Fi et activer le filtrage par adresse MAC.",
    "suspicious_port": "Vérifier le programme à l'origine de la connexion. Fermer "
                       "les services non chiffrés (Telnet) et surveiller l'appareil.",
    "ml_anomaly": "Comparer avec le trafic habituel à cette heure et vérifier les "
                  "alertes voisines avant de conclure.",
}

SEVERITY_ORDER = ["critical", "high", "medium", "low"]
HOUR = 3600


def iso(ts: int) -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))


def build_summary(hours: int = 24) -> Dict[str, Any]:
    now = int(time.time())
    since = now - hours * HOUR
    alerts = db.get_alerts(since=since, limit=5000)
    by_type = {}  # type: Dict[str, int]
    by_sev = {s: 0 for s in SEVERITY_ORDER}
    for a in alerts:
        by_type[a["type"]] = by_type.get(a["type"], 0) + 1
        by_sev[a["severity"]] = by_sev.get(a["severity"], 0) + 1
    devices = db.get_devices()
    totals = db.get_protocol_totals(since)
    recos = [{"type": t, "label": TYPE_LABELS.get(t, t), "count": n,
              "advice": RECOMMENDATIONS.get(t, "Surveiller et investiguer.")}
             for t, n in sorted(by_type.items(), key=lambda kv: -kv[1])]
    # Score de posture : 100 moins une pénalité par gravité (plancher à 0).
    penalty = (by_sev["critical"] * 15 + by_sev["high"] * 8
               + by_sev["medium"] * 3 + by_sev["low"])
    return {
        "generated_at": iso(now), "hours": hours,
        "score": max(0, 100 - penalty),
        "alerts_total": len(alerts), "alerts_by_severity": by_sev,
        "alerts_by_type": [{"type": t, "label": TYPE_LABELS.get(t, t), "count": n}
                           for t, n in sorted(by_type.items(), key=lambda kv: -kv[1])],
        "devices_total": len(devices),
        "devices_new": [d for d in devices if d["is_new"] and not d["trusted"]],
        "protocols": {k: totals[k] for k in ("tcp", "udp", "dns", "icmp", "arp", "other")},
        "packets": totals["packets"], "bytes": totals["bytes"],
        "top_sources": db.get_top_sources(since, 5),
        "recent_alerts": [dict(a, time=iso(a["ts"]), label=TYPE_LABELS.get(a["type"], a["type"]))
                          for a in alerts[:20]],
        "recommendations": recos,
    }


HTML = Template("""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Rapport NetSentinel</title>
<style>
body{font-family:system-ui,Arial,sans-serif;max-width:900px;margin:2rem auto;color:#1a1a2e;padding:0 1rem}
h1{border-bottom:3px solid #2563eb;padding-bottom:.4rem} h2{margin-top:2rem;color:#1e3a8a}
table{border-collapse:collapse;width:100%} td,th{border:1px solid #d1d5db;padding:.4rem .6rem;text-align:left}
th{background:#eff6ff} .score{font-size:2.5rem;font-weight:700}
.critical{color:#b91c1c;font-weight:700}.high{color:#c2410c;font-weight:700}.medium{color:#a16207}.low{color:#475569}
.muted{color:#6b7280}
</style></head><body>
<h1>Rapport de sécurité réseau</h1>
<p class="muted">Généré le {{ s.generated_at }} · période : {{ s.hours }} dernières heures</p>
<h2>Synthèse</h2>
<p>Score de posture : <span class="score">{{ s.score }}/100</span></p>
<ul>
<li>{{ s.alerts_total }} alertes ({% for k,v in s.alerts_by_severity.items() %}<span class="{{k}}">{{ v }} {{ k }}</span>{{ ", " if not loop.last }}{% endfor %})</li>
<li>{{ s.devices_total }} appareils connus, dont {{ s.devices_new|length }} nouveaux non validés</li>
<li>{{ s.packets }} paquets analysés ({{ (s.bytes/1048576)|round(1) }} Mo)</li>
</ul>
<h2>Protocoles</h2>
<table><tr>{% for k in s.protocols %}<th>{{ k|upper }}</th>{% endfor %}</tr>
<tr>{% for k,v in s.protocols.items() %}<td>{{ v }}</td>{% endfor %}</tr></table>
<h2>Alertes par type</h2>
{% if s.alerts_by_type %}<table><tr><th>Type</th><th>Nombre</th></tr>
{% for a in s.alerts_by_type %}<tr><td>{{ a.label }}</td><td>{{ a.count }}</td></tr>{% endfor %}</table>
{% else %}<p>Aucune alerte sur la période.</p>{% endif %}
<h2>Appareils nouveaux à valider</h2>
{% if s.devices_new %}<table><tr><th>IP</th><th>MAC</th><th>Fabricant</th></tr>
{% for d in s.devices_new %}<tr><td>{{ d.ip }}</td><td>{{ d.mac }}</td><td>{{ d.vendor }}</td></tr>{% endfor %}</table>
{% else %}<p>Aucun.</p>{% endif %}
<h2>Sources les plus actives</h2>
{% if s.top_sources %}<table><tr><th>IP</th><th>Paquets</th><th>Octets</th></tr>
{% for t in s.top_sources %}<tr><td>{{ t.ip }}</td><td>{{ t.packets }}</td><td>{{ t.bytes }}</td></tr>{% endfor %}</table>
{% else %}<p>Pas de données.</p>{% endif %}
<h2>Dernières alertes</h2>
{% if s.recent_alerts %}<table><tr><th>Heure</th><th>Gravité</th><th>Type</th><th>Détail</th></tr>
{% for a in s.recent_alerts %}<tr><td>{{ a.time }}</td><td class="{{ a.severity }}">{{ a.severity }}</td><td>{{ a.label }}</td><td>{{ a.description }}</td></tr>{% endfor %}</table>
{% else %}<p>Aucune.</p>{% endif %}
<h2>Recommandations de sécurité</h2>
{% if s.recommendations %}<ol>{% for r in s.recommendations %}
<li><b>{{ r.label }}</b> ({{ r.count }}) : {{ r.advice }}</li>{% endfor %}</ol>
{% else %}<p>Aucune action requise. Continue la surveillance.</p>{% endif %}
</body></html>""")


def render_html(hours: int = 24) -> str:
    return HTML.render(s=build_summary(hours))


def alerts_csv(hours: int = 24 * 7) -> str:
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["id", "date", "gravite", "type", "source", "description", "statut"])
    for a in db.get_alerts(since=int(time.time()) - hours * HOUR, limit=100000):
        w.writerow([a["id"], iso(a["ts"]), a["severity"], a["type"],
                    a["source_ip"], a["description"], a["status"]])
    return out.getvalue()


# ----------------------------------------------------- étapes pour le frontend
RECOMMENDATION_STEPS = {
    "port_scan": [
        "Block the source IP at the firewall if it is not a known device.",
        "Close every port that does not need to be reachable.",
        "Review the logs of the targeted host for follow-up connection attempts.",
    ],
    "syn_flood": [
        "Enable SYN cookies / connection rate limiting on the targeted host.",
        "Isolate or block the source device.",
        "Enable the router's DoS protection and monitor the connection table.",
    ],
    "arp_spoofing": [
        "Isolate the device announcing the second MAC address immediately.",
        "Enable Dynamic ARP Inspection or static ARP entries for the gateway.",
        "Segment the network with VLANs and rotate credentials sent in clear text.",
    ],
    "dns_anomaly": [
        "Scan the source device with an up-to-date antivirus.",
        "Inspect the domains queried for random-looking names (DGA / DNS tunnel).",
        "Restrict clients to an approved DNS resolver.",
    ],
    "traffic_spike": [
        "Identify the busiest device in the top sources list.",
        "If the burst is not legitimate, disconnect the device and analyse it.",
        "Compare with the usual traffic at this time of day.",
    ],
    "new_device": [
        "Verify that the device is known (owner, purpose).",
        "If unknown, change the Wi-Fi password and enable MAC filtering.",
        "Mark the device as trusted once it is verified.",
    ],
    "suspicious_port": [
        "Identify the program that opened the connection.",
        "Disable unencrypted services such as Telnet and use SSH instead.",
        "Keep monitoring the device for repeated attempts.",
    ],
    "ml_anomaly": [
        "Compare with the usual traffic profile for this time of day.",
        "Check neighbouring alerts before drawing a conclusion.",
        "Retrain the model if the network usage has legitimately changed.",
    ],
}

REPORT_DEFS = [
    {"id": "security-24h", "name": "Security Summary", "period": "Last 24 hours",
     "hours": 24, "format": "PDF"},
    {"id": "security-7d", "name": "Weekly Security Report", "period": "Last 7 days",
     "hours": 168, "format": "PDF"},
    {"id": "alerts-csv", "name": "Alert Log Export", "period": "Last 7 days",
     "hours": 168, "format": "CSV"},
    {"id": "devices-csv", "name": "Device Inventory Export", "period": "Current",
     "hours": 0, "format": "CSV"},
]


def report_items() -> List[Dict[str, Any]]:
    now = iso(int(time.time()))
    return [{"id": r["id"], "name": r["name"], "period": r["period"],
             "generatedAt": now, "format": r["format"], "status": "Ready"}
            for r in REPORT_DEFS]


def devices_csv() -> str:
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["mac", "ip", "fabricant", "nom", "premiere_vue", "derniere_vue",
                "en_ligne", "nouveau", "de_confiance"])
    for d in db.get_devices():
        w.writerow([d["mac"], d["ip"], d["vendor"], d["hostname"],
                    iso(d["first_seen"]), iso(d["last_seen"]), d["online"],
                    d["is_new"], d["trusted"]])
    return out.getvalue()


def build_report(report_id: str):
    """Retourne (contenu, type MIME, nom de fichier) ou None si inconnu."""
    d = next((r for r in REPORT_DEFS if r["id"] == report_id), None)
    if d is None:
        return None
    if report_id == "alerts-csv":
        return alerts_csv(d["hours"]), "text/csv", "alertes.csv"
    if report_id == "devices-csv":
        return devices_csv(), "text/csv", "appareils.csv"
    try:  # vrai PDF avec reportlab (Python pur, aucune bibliothèque système)
        return render_pdf(d["hours"]), "application/pdf", report_id + ".pdf"
    except ImportError:
        return render_html(d["hours"]), "text/html", report_id + ".html"


def render_pdf(hours: int = 24) -> bytes:
    from xml.sax.saxutils import escape

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    s = build_summary(hours)
    st = getSampleStyleSheet()
    small = st["BodyText"]
    small.fontSize = 8
    small.leading = 10
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="Rapport NetSentinel",
                            leftMargin=1.8 * cm, rightMargin=1.8 * cm,
                            topMargin=1.5 * cm, bottomMargin=1.5 * cm)

    def table(rows, widths=None):
        t = Table(rows, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9ca3af")),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        return t

    def para(text):
        return Paragraph(escape(str(text)), small)

    sev = s["alerts_by_severity"]
    el = [Paragraph("Rapport de sécurité réseau", st["Title"]),
          Paragraph("Généré le %s - période : %d dernières heures"
                    % (s["generated_at"], s["hours"]), st["BodyText"]),
          Spacer(1, 10),
          Paragraph("Synthèse", st["Heading2"]),
          Paragraph("Score de posture : <b>%d/100</b>" % s["score"], st["BodyText"]),
          Paragraph("%d alertes (critical %d, high %d, medium %d, low %d) - %d appareils, "
                    "dont %d nouveaux non validés - %d paquets analysés (%.1f Mo)"
                    % (s["alerts_total"], sev.get("critical", 0), sev.get("high", 0),
                       sev.get("medium", 0), sev.get("low", 0), s["devices_total"],
                       len(s["devices_new"]), s["packets"], s["bytes"] / 1048576.0),
                    st["BodyText"]),
          Paragraph("Protocoles", st["Heading2"]),
          table([[k.upper() for k in s["protocols"]], list(s["protocols"].values())])]
    el.append(Paragraph("Alertes par type", st["Heading2"]))
    if s["alerts_by_type"]:
        el.append(table([["Type", "Nombre"]] + [[a["label"], a["count"]]
                                                  for a in s["alerts_by_type"]]))
    else:
        el.append(Paragraph("Aucune alerte sur la période.", st["BodyText"]))
    el.append(Paragraph("Dernières alertes", st["Heading2"]))
    if s["recent_alerts"]:
        rows = [["Heure", "Gravité", "Type", "Détail"]]
        for a in s["recent_alerts"]:
            rows.append([a["time"], a["severity"], para(a["label"]), para(a["description"])])
        el.append(table(rows, [3.2 * cm, 1.8 * cm, 3.5 * cm, 8.5 * cm]))
    else:
        el.append(Paragraph("Aucune.", st["BodyText"]))
    el.append(Paragraph("Recommandations de sécurité", st["Heading2"]))
    if s["recommendations"]:
        for r in s["recommendations"]:
            el.append(Paragraph("<b>%s</b> (%d) : %s" % (escape(r["label"]), r["count"],
                                                         escape(r["advice"])), st["BodyText"]))
    else:
        el.append(Paragraph("Aucune action requise. Continue la surveillance.", st["BodyText"]))
    doc.build(el)
    return buf.getvalue()
