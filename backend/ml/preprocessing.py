"""Feature Engineering and Preprocessing Pipeline."""
import math
from collections import deque
from typing import Dict, Any, List, Optional
import numpy as np


class FeatureExtractor:
    RAW_KEYS = [
        "rpm", "cht", "egt", "oil_pressure", "oil_temperature",
        "fuel_flow", "vibration", "battery_voltage", "alternator_current", "manifold_pressure"
    ]

    def __init__(self, window_size: int = 10):
        self.window_size = window_size
        self.history = deque(maxlen=window_size)

    def extract_features(
        self,
        telemetry: Optional[Dict[str, Any]],
        residuals: Optional[Dict[str, Any]],
        quality_assessment: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Extract statistical and residual features for ML models with channel quality tracking."""
        features: Dict[str, Any] = {}
        issues: List[str] = []
        channel_status: Dict[str, str] = {}
        missing_channels: List[str] = []
        invalid_channels: List[str] = []
        present_channels: List[str] = []

        stale_channels: List[str] = []
        frozen_channels: List[str] = []
        drifting_channels: List[str] = []
        fallback_inputs: List[str] = []

        if quality_assessment is not None:
            if hasattr(quality_assessment, "stale_channels"):
                stale_channels = list(quality_assessment.stale_channels)
            elif isinstance(quality_assessment, dict):
                stale_channels = list(quality_assessment.get("stale_channels", []))

            if hasattr(quality_assessment, "frozen_channels"):
                frozen_channels = list(quality_assessment.frozen_channels)
            elif isinstance(quality_assessment, dict):
                frozen_channels = list(quality_assessment.get("frozen_channels", []))

            if hasattr(quality_assessment, "drifting_channels"):
                drifting_channels = list(quality_assessment.drifting_channels)
            elif isinstance(quality_assessment, dict):
                drifting_channels = list(quality_assessment.get("drifting_channels", []))

            if hasattr(quality_assessment, "operating_condition_fallbacks"):
                fallback_inputs = list(quality_assessment.operating_condition_fallbacks)
            elif isinstance(quality_assessment, dict):
                fallback_inputs = list(quality_assessment.get("operating_condition_fallbacks", []))

        # Safe input coercion
        if telemetry is None:
            raw_telem: Dict[str, Any] = {}
            issues.append("Telemetry dictionary is None")
        elif hasattr(telemetry, "model_dump"):
            raw_telem = telemetry.model_dump()
        elif isinstance(telemetry, dict):
            raw_telem = telemetry
        else:
            raw_telem = {}
            issues.append(f"Unexpected telemetry type: {type(telemetry).__name__}")

        # 1. Raw sensor values & channel presence tracking
        for k in self.RAW_KEYS:
            is_stale = k in stale_channels
            is_frozen = k in frozen_channels
            features[f"is_frozen_{k}"] = is_frozen

            if k not in raw_telem or raw_telem[k] is None:
                channel_status[k] = "MISSING"
                missing_channels.append(k)
                features[f"raw_{k}"] = 0.0
                features[f"is_present_{k}"] = False
            elif is_stale:
                channel_status[k] = "STALE"
                issues.append(f"Channel {k} telemetry is STALE (freshness timeout exceeded)")
                features[f"raw_{k}"] = 0.0
                features[f"is_present_{k}"] = False
            else:
                try:
                    val = float(raw_telem[k])
                    if math.isnan(val) or math.isinf(val):
                        channel_status[k] = "INVALID"
                        invalid_channels.append(k)
                        issues.append(f"Channel {k} contains NaN or Inf value")
                        features[f"raw_{k}"] = 0.0
                        features[f"is_present_{k}"] = False
                    else:
                        if is_frozen:
                            channel_status[k] = "FROZEN"
                            issues.append(f"Channel {k} is FROZEN (constant output under dynamic conditions)")
                            # Frozen sensor is still numerically present for raw reading, but flagged
                            present_channels.append(k)
                            features[f"raw_{k}"] = val
                            features[f"is_present_{k}"] = True
                        else:
                            channel_status[k] = "PRESENT_AND_VALID"
                            present_channels.append(k)
                            features[f"raw_{k}"] = val
                            features[f"is_present_{k}"] = True
                except (ValueError, TypeError):
                    channel_status[k] = "INVALID"
                    invalid_channels.append(k)
                    issues.append(f"Channel {k} contains non-numeric value: {raw_telem[k]}")
                    features[f"raw_{k}"] = 0.0
                    features[f"is_present_{k}"] = False

        # 2. Normalized residuals
        res_channels = {}
        if residuals is not None:
            if isinstance(residuals, dict):
                res_channels = residuals.get("channels", {})
            elif hasattr(residuals, "channels"):
                res_channels = getattr(residuals, "channels", {})
            elif hasattr(residuals, "model_dump"):
                res_channels = residuals.model_dump().get("channels", {})

        for k in self.RAW_KEYS:
            ch_data = res_channels.get(k) if isinstance(res_channels, dict) else getattr(res_channels, k, None)
            is_valid_telemetry = channel_status.get(k) in ("PRESENT_AND_VALID", "FROZEN")

            if ch_data is not None and is_valid_telemetry:
                if isinstance(ch_data, dict):
                    raw_norm = ch_data.get("normalized_residual", 0.0)
                else:
                    raw_norm = getattr(ch_data, "normalized_residual", 0.0)

                try:
                    norm_res = float(raw_norm)
                    if math.isnan(norm_res) or math.isinf(norm_res):
                        norm_res = 0.0
                        features[f"res_{k}_observed"] = False
                    else:
                        features[f"res_{k}_observed"] = True
                except (ValueError, TypeError):
                    norm_res = 0.0
                    features[f"res_{k}_observed"] = False
            else:
                norm_res = 0.0
                features[f"res_{k}_observed"] = False

            features[f"res_{k}"] = float(norm_res)

        # 3. Observability determination
        valid_unfrozen_present = [c for c in present_channels if c not in frozen_channels and c not in stale_channels]
        if not present_channels or not valid_unfrozen_present:
            observability_status = "UNAVAILABLE"
        elif missing_channels or invalid_channels or stale_channels or frozen_channels or fallback_inputs:
            observability_status = "DEGRADED_OBSERVABILITY"
        else:
            observability_status = "FULL_OBSERVABILITY"

        features["_channel_status"] = channel_status
        features["_missing_channels"] = missing_channels
        features["_invalid_channels"] = invalid_channels
        features["_present_channels"] = present_channels
        features["_stale_channels"] = stale_channels
        features["_frozen_channels"] = frozen_channels
        features["_drifting_channels"] = drifting_channels
        features["_fallback_operating_inputs"] = fallback_inputs
        features["_observability_status"] = observability_status
        features["_data_quality_issues"] = issues

        # 4. Cross-sensor relationships
        features["cross_thermal_ratio"] = features["raw_egt"] / max(1.0, features["raw_cht"])
        features["cross_power_ratio"] = features["raw_fuel_flow"] / max(1.0, features["raw_rpm"] / 100.0)
        features["cross_lube_factor"] = features["raw_oil_pressure"] * (100.0 / max(1.0, features["raw_oil_temperature"]))

        # 5. Rolling statistics & derivatives (avoid stale/frozen propagation)
        self.history.append(dict(features))

        if len(self.history) > 1:
            recent_cht = [h["raw_cht"] for h in self.history if h.get("is_present_cht", False) and not h.get("is_frozen_cht", False)]
            recent_egt = [h["raw_egt"] for h in self.history if h.get("is_present_egt", False) and not h.get("is_frozen_egt", False)]
            recent_vib = [h["raw_vibration"] for h in self.history if h.get("is_present_vibration", False) and not h.get("is_frozen_vibration", False)]

            features["trend_cht"] = float(recent_cht[-1] - recent_cht[0]) if len(recent_cht) > 1 else 0.0
            features["trend_egt"] = float(recent_egt[-1] - recent_egt[0]) if len(recent_egt) > 1 else 0.0
            features["trend_vibration"] = float(recent_vib[-1] - recent_vib[0]) if len(recent_vib) > 1 else 0.0
            features["std_cht"] = float(np.std(recent_cht)) if len(recent_cht) > 1 else 0.0
            features["std_vibration"] = float(np.std(recent_vib)) if len(recent_vib) > 1 else 0.0
        else:
            features["trend_cht"] = 0.0
            features["trend_egt"] = 0.0
            features["trend_vibration"] = 0.0
            features["std_cht"] = 0.0
            features["std_vibration"] = 0.0

        return features

