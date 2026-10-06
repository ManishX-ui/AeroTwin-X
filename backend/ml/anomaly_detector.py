"""Isolation Forest Anomaly Detection Engine."""
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict, Any, Tuple
from ..app.schemas.predictions import AnomalyPrediction

class AnomalyDetector:
    def __init__(self, threshold: float = 0.35):
        self.threshold = threshold
        self.feature_names = [
            "res_cht", "res_egt", "res_oil_pressure", "res_oil_temperature",
            "res_fuel_flow", "res_vibration", "res_manifold_pressure",
            "trend_cht", "trend_egt", "trend_vibration"
        ]
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42
        )
        self._fit_baseline_distribution()

    def _fit_baseline_distribution(self):
        """Fit model on synthetic baseline nominal distribution."""
        np.random.seed(42)
        n_samples = 600
        # Nominal residuals are zero-mean with unit standard deviation
        X_nominal = np.random.normal(loc=0.0, scale=0.8, size=(n_samples, len(self.feature_names)))
        self.model.fit(X_nominal)

    def predict(self, feature_dict: Dict[str, float]) -> AnomalyPrediction:
        """Predict anomaly score from feature dict."""
        x = np.array([[feature_dict.get(fn, 0.0) for fn in self.feature_names]])
        # decision_function gives positive for inliers (> 0.05), negative for outliers (< 0.0)
        raw_score = float(self.model.decision_function(x)[0])

        # Centered calibration:
        # raw_score >= 0.10 -> score < 0.15
        # raw_score == 0.00 -> score == 0.35
        # raw_score <= -0.10 -> score > 0.70
        centered_x = (0.05 - raw_score) * 12.0
        anomaly_score = 1.0 / (1.0 + np.exp(-centered_x))
        anomaly_score = max(0.02, min(0.99, float(anomaly_score)))

        # Also incorporate extreme individual residuals directly
        max_norm_res = max(abs(feature_dict.get(f"res_{k}", 0.0)) for k in ["cht", "egt", "oil_pressure", "vibration"])
        if max_norm_res > 3.0:
            anomaly_score = max(anomaly_score, 0.75 + min(0.24, (max_norm_res - 3.0) * 0.08))

        is_anomaly = anomaly_score >= self.threshold
        if anomaly_score > 0.65:
            status = "ANOMALOUS"
        elif anomaly_score >= self.threshold:
            status = "ELEVATED"
        else:
            status = "NORMAL"

        return AnomalyPrediction(
            anomaly_score=round(anomaly_score, 3),
            anomaly_status=status,
            threshold=self.threshold,
            is_anomaly=is_anomaly
        )
