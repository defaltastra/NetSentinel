# NetSentinel : backend

API FastAPI + capture réseau (Scapy) + détection d'anomalies + rapports.
Compatible Python 3.8 et plus.

## Installation (une fois)

    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt

## Lancement

Mode démo, sans root, avec trafic et attaques simulés (idéal pour développer
avec le frontend) :

    NETSENTINEL_MODE=simulate venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000

Mode réel (capture et scan ARP : root obligatoire) :

    sudo venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000

Ouvre ensuite `http://IP_DE_LA_VM:8000/docs` pour tester chaque route.

## Variables d'environnement

| Variable | Rôle | Défaut |
| --- | --- | --- |
| NETSENTINEL_MODE | `live` ou `simulate` | live |
| NETSENTINEL_IFACE | interface à écouter (ex : ens33) | détectée automatiquement |
| NETSENTINEL_NETWORK | réseau à scanner (ex : 192.168.1.0/24) | détecté automatiquement |
| NETSENTINEL_SCAN_INTERVAL | secondes entre deux scans ARP | 60 |
| NETSENTINEL_WINDOW | taille d'une fenêtre d'analyse, en secondes | 10 |

## Routes (formats de `src/types/index.ts`)

| Route | Renvoie |
| --- | --- |
| GET /api/health | état du serveur, erreurs de capture et de scan |
| GET /api/overview | `OverviewStats` |
| GET /api/devices, GET /api/devices/{id} | `Device[]` / `Device` (id = adresse MAC) |
| POST /api/devices | enregistre un appareil à la main |
| POST /api/devices/{id}/trust, POST /api/scan | valide un appareil / force un scan ARP |
| GET /api/events | `SecurityEvent[]` |
| GET /api/alerts, PATCH /api/alerts/{id}/status | `SecurityAlert[]` / change le statut (Open, Investigating, Resolved) |
| GET /api/traffic/overview?range=1H\|24H\|7D\|30D | `TrafficData` |
| GET /api/traffic/records | `TrafficRecord[]` |
| GET /api/reports, GET /api/reports/{id}/download | `ReportItem[]` / fichier PDF ou CSV |
| GET/PUT /api/settings | `WorkspaceSettings` |
| GET /api/traffic, /api/traffic/live, /api/reports/summary, /api/reports/html, /api/reports/alerts.csv | données brutes et rapport HTML |
| POST /api/ml/train | entraîne l'Isolation Forest sur le trafic capturé |
| POST /api/simulate/{portscan,synflood,dnsflood,arpspoof,spike,newdevice,telnet} | fausses attaques (mode simulate) |
| WS /ws | temps réel : messages `traffic`, `alert`, `device` |

## Tester la détection pour de vrai (sur ton propre réseau uniquement)

    nmap -p 1-1000 IP_DE_LA_VM        # depuis une autre machine : alerte port_scan
    sudo hping3 -S -p 80 --flood IP   # alerte syn_flood (labo isolé uniquement)

## Structure

    main.py            routes FastAPI + WebSocket
    core/database.py   tables SQLite
    core/capture.py    capture Scapy, statistiques, simulateur
    core/devices.py    scan ARP, nouveaux appareils
    core/detection.py  règles : scan de ports, SYN flood, ARP spoofing, DNS, pics, ports suspects
    core/ml_model.py   Isolation Forest (optionnel)
    core/reports.py    rapports HTML/CSV et recommandations
