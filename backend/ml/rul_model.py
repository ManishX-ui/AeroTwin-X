"""Time Between Overhaul (TBO) Maintenance Countdown and Degradation Estimator.

Calculates remaining flight hours until scheduled TBO overhaul based on configured
maintenance intervals and accumulated operational time (TTSN). Incorporates
heuristic operational wear adjustments under active faults without claiming
uncalibrated statistical Weibull survival confidence.
"""
import math
from typing import Optional, Union, Dict, Any
from ..app.schemas.predictions import RULPrediction


class RULModel:
    def __init__(self, tbo_hours: float = 2500.0, current_ttsn_hours: float = 1216.0):
        self.is_config_valid = True
        self.config_error: Optional[str] = None

        # Defensive validation of configuration inputs
        try:
            if tbo_hours is None or current_ttsn_hours is None:
                raise ValueError("tbo_hours and current_ttsn_hours cannot be None")

            tbo_val = float(tbo_hours)
            ttsn_val = float(current_ttsn_hours)

            if math.isnan(tbo_val) or math.isinf(tbo_val) or math.isnan(ttsn_val) or math.isinf(ttsn_val):
                raise ValueError("tbo_hours and current_ttsn_hours must be finite numbers, not NaN or Inf")

            if tbo_val <= 0.0:
                raise ValueError(f"tbo_hours must be greater than zero, got {tbo_val}")

            if ttsn_val < 0.0:
                raise ValueError(f"current_ttsn_hours cannot be negative, got {ttsn_val}")

            self.tbo_hours = tbo_val
            self.current_ttsn = ttsn_val
            self.nominal_rul = max(0.0, self.tbo_hours - self.current_ttsn)
        except Exception as e:
            self.is_config_valid = False
            self.config_error = str(e)
            self.tbo_hours = 0.0
            self.current_ttsn = 0.0
            self.nominal_rul = 0.0

    def estimate_tbo_countdown(
        self,
        health_score: Optional[float] = 100.0,
        fault_type: Optional[str] = "NORMAL",
        anomaly_score: Optional[float] = 0.0
    ) -> RULPrediction:
        """Estimate remaining flight hours until scheduled TBO overhaul or required inspection.

        This calculation represents a maintenance interval countdown adjusted with
        heuristic operational penalties. It is NOT a calibrated statistical survival model.
        """
        # 1. Check configuration validity
        if not self.is_config_valid:
            return RULPrediction(
                tbo_countdown_hours=0.0,
                rul_hours=0.0,
                confidence=None,
                confidence_status="INVALID_INPUT",
                estimate_method="TBO_COUNTDOWN",
                degradation_trend="INVALID_CONFIGURATION",
                tbo_limit_hours=self.tbo_hours,
                current_ttsn_hours=self.current_ttsn,
                estimated_wear_pct=0.0,
                is_valid=False,
                status_message=f"Configuration error: {self.config_error}"
            )

        # 2. Defensive validation of runtime inputs
        try:
            if health_score is None:
                raise ValueError("health_score cannot be None")
            if anomaly_score is None:
                raise ValueError("anomaly_score cannot be None")

            h_val = float(health_score)
            a_val = float(anomaly_score)

            if math.isnan(h_val) or math.isinf(h_val):
                raise ValueError(f"health_score must be a finite number, got {health_score}")
            if math.isnan(a_val) or math.isinf(a_val):
                raise ValueError(f"anomaly_score must be a finite number, got {anomaly_score}")
        except Exception as e:
            return RULPrediction(
                tbo_countdown_hours=0.0,
                rul_hours=0.0,
                confidence=None,
                confidence_status="INVALID_INPUT",
                estimate_method="TBO_COUNTDOWN",
                degradation_trend="INVALID_INPUT",
                tbo_limit_hours=self.tbo_hours,
                current_ttsn_hours=self.current_ttsn,
                estimated_wear_pct=0.0,
                is_valid=False,
                status_message=f"Input validation error: {e}"
            )

        fault_str = str(fault_type) if fault_type is not None else "NORMAL"

        # 3. Check if TBO is reached or exceeded
        if self.current_ttsn >= self.tbo_hours:
            return RULPrediction(
                tbo_countdown_hours=0.0,
                rul_hours=0.0,
                confidence=None,
                confidence_status="NOT_CALIBRATED",
                estimate_method="TBO_COUNTDOWN",
                degradation_trend="TBO_EXCEEDED",
                tbo_limit_hours=self.tbo_hours,
                current_ttsn_hours=self.current_ttsn,
                estimated_wear_pct=100.0,
                is_valid=True,
                status_message="Configured TBO maintenance interval reached or exceeded; overhaul due"
            )

        # 4. Standard countdown with heuristic operational wear adjustments
        health_clamped = max(0.0, min(100.0, h_val))
        health_ratio = max(0.1, health_clamped / 100.0)
        anomaly_clamped = max(0.0, min(1.0, a_val))

        if fault_str == "NORMAL":
            countdown = self.nominal_rul
            trend = "NOMINAL_LINEAR"
        elif fault_str in ["OVERHEATING", "LUBRICATION_ISSUE"]:
            penalty = 320.0 * (1.0 - health_ratio) * (1.0 + anomaly_clamped)
            countdown = max(0.0, self.nominal_rul - penalty)
            trend = "ACCELERATING_THERMAL_WEAR" if fault_str == "OVERHEATING" else "CRITICAL_LUBRICATION_DEGRADATION"
        elif fault_str in ["VIBRATION_ANOMALY", "MISFIRE"]:
            penalty = 210.0 * (1.0 - health_ratio)
            countdown = max(0.0, self.nominal_rul - penalty)
            trend = "MECHANICAL_FATIGUE_ACCELERATION"
        else:
            countdown = max(0.0, self.nominal_rul - (100.0 * (1.0 - health_ratio)))
            trend = "MONITORED_DEGRADATION"

        estimated_wear = max(0.0, min(100.0, ((self.tbo_hours - countdown) / self.tbo_hours) * 100.0))

        return RULPrediction(
            tbo_countdown_hours=round(countdown, 1),
            rul_hours=round(countdown, 1),
            confidence=None,
            confidence_status="NOT_CALIBRATED",
            estimate_method="TBO_COUNTDOWN",
            degradation_trend=trend,
            tbo_limit_hours=self.tbo_hours,
            current_ttsn_hours=self.current_ttsn,
            estimated_wear_pct=round(estimated_wear, 1),
            is_valid=True,
            status_message="Configured TBO interval countdown (heuristic adjustment; uncalibrated)"
        )

    # Backward-compatible alias
    estimate_rul = estimate_tbo_countdown

