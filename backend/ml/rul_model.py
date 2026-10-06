"""Remaining Useful Life (RUL) and Degradation Estimator."""
from typing import Dict, Any
from ..app.schemas.predictions import RULPrediction

class RULModel:
    def __init__(self, tbo_hours: float = 2500.0, current_ttsn_hours: float = 1216.0):
        self.tbo_hours = tbo_hours
        self.current_ttsn = current_ttsn_hours
        # Baseline nominal RUL
        self.nominal_rul = max(0.0, self.tbo_hours - self.current_ttsn) # ~1284 hours

    def estimate_rul(
        self,
        health_score: float,
        fault_type: str,
        anomaly_score: float
    ) -> RULPrediction:
        """Estimate remaining flight hours until scheduled TBO overhaul or required inspection."""
        # Wear factor based on health score (100 = 1.0x nominal degradation)
        health_ratio = max(0.1, health_score / 100.0)

        if fault_type == "NORMAL":
            rul = self.nominal_rul
            trend = "NOMINAL_LINEAR"
            confidence = 94.2
        elif fault_type in ["OVERHEATING", "LUBRICATION_ISSUE"]:
            # Thermal/lube stress significantly accelerates mechanical fatigue
            penalty = 320.0 * (1.0 - health_ratio) * (1.0 + anomaly_score)
            rul = max(80.0, self.nominal_rul - penalty)
            trend = "ACCELERATING_THERMAL_WEAR" if fault_type == "OVERHEATING" else "CRITICAL_LUBRICATION_DEGRADATION"
            confidence = 91.5
        elif fault_type in ["VIBRATION_ANOMALY", "MISFIRE"]:
            penalty = 210.0 * (1.0 - health_ratio)
            rul = max(150.0, self.nominal_rul - penalty)
            trend = "MECHANICAL_FATIGUE_ACCELERATION"
            confidence = 88.7
        else:
            rul = self.nominal_rul - (100.0 * (1.0 - health_ratio))
            trend = "MONITORED_DEGRADATION"
            confidence = 92.0

        estimated_wear = ((self.tbo_hours - rul) / self.tbo_hours) * 100.0

        return RULPrediction(
            rul_hours=round(rul, 1),
            confidence=round(confidence, 1),
            degradation_trend=trend,
            tbo_limit_hours=self.tbo_hours,
            estimated_wear_pct=round(estimated_wear, 1)
        )
