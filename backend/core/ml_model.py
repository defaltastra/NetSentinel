"""IA optionnelle : détection d'anomalies par Isolation Forest.

Non supervisé : il apprend à quoi ressemble ton trafic « normal » (table
`features`, une ligne par fenêtre de 10 s) puis signale ce qui s'en écarte.
"""
import os
from typing import Any, Dict

from . import database as db

FEATURES = ["packets", "bytes", "uniq_ips", "uniq_ports",
            "tcp_ratio", "udp_ratio", "dns_ratio", "avg_size"]
MODEL_PATH = os.environ.get(
    "NETSENTINEL_MODEL",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "data", "model.pkl"))


class MLDetector:
    def __init__(self):
        self.model = None
        self.info = {}  # type: Dict[str, Any]
        self.load()

    def is_ready(self) -> bool:
        return self.model is not None

    def load(self) -> bool:
        if not os.path.exists(MODEL_PATH):
            return False
        try:
            import joblib
            blob = joblib.load(MODEL_PATH)
            self.model, self.info = blob["model"], blob.get("info", {})
            return True
        except Exception:
            self.model = None
            return False

    def train(self, min_rows: int = 100, contamination: float = 0.05) -> Dict[str, Any]:
        import joblib
        import numpy as np
        from sklearn.ensemble import IsolationForest

        rows = db.get_features()
        if len(rows) < min_rows:
            raise ValueError(
                "Pas assez de données : %d fenêtres, il en faut au moins %d "
                "(environ %d minutes de capture normale)."
                % (len(rows), min_rows, min_rows * 10 // 60 + 1))
        X = np.array([[r[f] for f in FEATURES] for r in rows], dtype=float)
        model = IsolationForest(n_estimators=100, contamination=contamination,
                                random_state=42).fit(X)
        flagged = int((model.predict(X) == -1).sum())
        self.model = model
        self.info = {"samples": len(rows), "contamination": contamination,
                     "flagged_in_training": flagged, "features": FEATURES}
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump({"model": model, "info": self.info}, MODEL_PATH)
        return self.info

    def is_anomaly(self, feats: Dict[str, float]) -> bool:
        x = [[float(feats[f]) for f in FEATURES]]
        return int(self.model.predict(x)[0]) == -1

    def score(self, feats: Dict[str, float]) -> float:
        """Plus le score est bas (négatif), plus la fenêtre est anormale."""
        return float(self.model.decision_function([[float(feats[f]) for f in FEATURES]])[0])
