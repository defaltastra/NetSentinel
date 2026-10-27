#!/usr/bin/env python3
"""Évalue la détection d'anomalies par IA sur le trafic capturé par NetSentinel.

Principe
  1. Les « fenêtres » de 10 s enregistrées (table `features`) sont les exemples.
  2. Les fenêtres pendant tes attaques sont étiquetées « attaque », les autres
     « normales ». L'étiquette vient soit des heures que tu donnes (--attack),
     soit des alertes à règles déjà détectées (--labels alerts).
  3. On entraîne chaque modèle sur 70 % du trafic normal (le plus ancien),
     puis on le teste sur le reste du normal + toutes les attaques.
  4. On compare : précision, rappel, F1, taux de fausses alertes, AUC.

Exemples
  python3 ml_eval.py --attack "2026-10-25 20:10/2026-10-25 20:20" \
                     --attack "2026-10-25 20:40/2026-10-25 20:45"
  python3 ml_eval.py --labels alerts
Les heures sont celles de la VM (commande `date`).
"""
import argparse
import json
import os
import sqlite3
import sys
import time

import numpy as np

FEATURES = ["packets", "bytes", "uniq_ips", "uniq_ports",
            "tcp_ratio", "udp_ratio", "dns_ratio", "avg_size"]
WINDOW = int(os.environ.get("NETSENTINEL_WINDOW", "10"))
HERE = os.path.dirname(os.path.abspath(__file__))


def parse_time(text):
    """Accepte 'AAAA-MM-JJ HH:MM' ou 'AAAA-MM-JJ HH:MM:SS' (heure de la VM)."""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return int(time.mktime(time.strptime(text.strip(), fmt)))
        except ValueError:
            pass
    sys.exit("Heure invalide : %r (format : 2026-10-25 20:10 ou 2026-10-25 20:10:30)" % text)


def load(db_path):
    con = sqlite3.connect("file:%s?mode=ro" % db_path, uri=True)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT * FROM features ORDER BY ts").fetchall()
    alerts = con.execute("SELECT ts, type FROM alerts").fetchall()
    con.close()
    ts = np.array([r["ts"] for r in rows], dtype=int)
    X = np.array([[r[f] for f in FEATURES] for r in rows], dtype=float)
    return ts, X, [(a["ts"], a["type"]) for a in alerts]


def label(ts, intervals):
    y = np.zeros(len(ts), dtype=int)
    for start, end in intervals:
        y[(ts >= start) & (ts <= end + WINDOW)] = 1
    return y


def metrics(y_true, y_pred, scores):
    from sklearn.metrics import roc_auc_score
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())
    tn = int(((y_pred == 0) & (y_true == 0)).sum())
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    fpr = fp / (fp + tn) if fp + tn else 0.0
    try:
        auc = float(roc_auc_score(y_true, scores))
    except ValueError:
        auc = float("nan")
    return {"precision": prec, "recall": rec, "f1": f1, "fausses_alertes": fpr,
            "auc": auc, "tp": tp, "fp": fp, "fn": fn, "tn": tn}


def main():
    global WINDOW
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default=os.path.join(HERE, "data", "netsentinel.db"))
    ap.add_argument("--attack", action="append", default=[],
                    help='intervalle d\'attaque "AAAA-MM-JJ HH:MM/AAAA-MM-JJ HH:MM" (répétable)')
    ap.add_argument("--labels", choices=["alerts"],
                    help="étiqueter d'après les alertes à règles déjà détectées")
    ap.add_argument("--contamination", type=float, default=0.01,
                    help="part d'anomalies attendue dans le trafic normal (défaut 0.01)")
    ap.add_argument("--window", type=int, default=WINDOW,
                    help="taille d'une fenêtre en secondes (défaut : NETSENTINEL_WINDOW ou 10)")
    ap.add_argument("--out", default=os.path.join(HERE, "data", "ml_report.json"))
    a = ap.parse_args()
    WINDOW = a.window

    from sklearn.ensemble import IsolationForest
    from sklearn.neighbors import LocalOutlierFactor
    from sklearn.preprocessing import StandardScaler
    from sklearn.svm import OneClassSVM

    if not os.path.exists(a.db):
        sys.exit("Base introuvable : %s" % a.db)
    ts, X, alerts = load(a.db)
    if len(ts) == 0:
        sys.exit("Aucune fenêtre dans la base : laisse le serveur tourner plus longtemps.")

    intervals = [tuple(parse_time(p) for p in s.split("/")) for s in a.attack]
    if a.labels == "alerts":
        skip = {"ml_anomaly", "new_device"}
        intervals += [(t - 3 * WINDOW, t + 2 * WINDOW) for t, typ in alerts if typ not in skip]
    if not intervals:
        sys.exit("Donne des attaques avec --attack ou utilise --labels alerts.")
    y = label(ts, intervals)

    normal = np.where(y == 0)[0]
    attack = np.where(y == 1)[0]
    print("Fenêtres : %d au total, %d normales, %d d'attaque" % (len(ts), len(normal), len(attack)))
    if len(attack) < 3:
        sys.exit("Moins de 3 fenêtres d'attaque : vérifie les heures (commande `date`).")
    if len(normal) < 30:
        sys.exit("Il faut au moins 60 fenêtres normales (10 minutes). Laisse tourner plus longtemps.")

    cut = int(len(normal) * 0.7)
    train_idx, test_normal = normal[:cut], normal[cut:]
    test_idx = np.concatenate([test_normal, attack])
    X_train, X_test, y_test = X[train_idx], X[test_idx], y[test_idx]
    print("Entraînement : %d fenêtres normales | Test : %d normales + %d attaques\n"
          % (len(train_idx), len(test_normal), len(attack)))

    scaler = StandardScaler().fit(X_train)
    Xs_train, Xs_test = scaler.transform(X_train), scaler.transform(X_test)
    models = {
        "Isolation Forest": (IsolationForest(n_estimators=200, contamination=a.contamination,
                                             random_state=42), False),
        "One-Class SVM": (OneClassSVM(nu=max(a.contamination, 0.01), gamma="scale"), True),
        "Local Outlier Factor": (LocalOutlierFactor(n_neighbors=20, novelty=True,
                                                    contamination=a.contamination), True),
    }
    results = {}
    for name, (model, scaled) in models.items():
        model.fit(Xs_train if scaled else X_train)
        data = Xs_test if scaled else X_test
        pred = (model.predict(data) == -1).astype(int)
        score = -model.decision_function(data)      # plus grand = plus anormal
        results[name] = metrics(y_test, pred, score)

    head = "%-22s %9s %7s %6s %17s %6s" % ("Modèle", "Précision", "Rappel", "F1",
                                           "Fausses alertes", "AUC")
    print(head)
    print("-" * len(head))
    for name, m in results.items():
        print("%-22s %9.2f %7.2f %6.2f %16.1f%% %6.2f" % (
            name, m["precision"], m["recall"], m["f1"], m["fausses_alertes"] * 100, m["auc"]))
    best = max(results, key=lambda n: (results[n]["f1"], results[n]["auc"]))
    print("\nMeilleur modèle sur ces données (F1) : %s" % best)
    print("Lecture : précision = part des alertes qui étaient de vraies attaques ;")
    print("rappel = part des attaques détectées ; fausses alertes = fenêtres normales")
    print("signalées à tort ; AUC = qualité du classement (1.0 parfait, 0.5 hasard).")

    report = {"fenetres": int(len(ts)), "normales": int(len(normal)),
              "attaques": int(len(attack)), "entrainement": int(len(train_idx)),
              "contamination": a.contamination, "meilleur": best, "modeles": results}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    print("\nRapport enregistré : %s" % a.out)


if __name__ == "__main__":
    main()
