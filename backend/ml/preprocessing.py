"""Feature Engineering and Preprocessing Pipeline."""
from collections import deque
from typing import Dict, Any, List
import numpy as np

class FeatureExtractor:
    def __init__(self, window_size: int = 10):
        self.window_size = window_size
        self.history = deque(maxlen=window_size)

    def extract_features(
        self,
        telemetry: Dict[str, Any],
        residuals: Dict[str, Any]
    ) -> Dict[str, float]:
        """Extract statistical and residual features for ML models."""
        features = {}

        # 1. Raw sensor values
        raw_keys = ["rpm", "cht", "egt", "oil_pressure", "oil_temperature", "fuel_flow", "vibration", "battery_voltage", "alternator_current", "manifold_pressure"]
        for k in raw_keys:
            features[f"raw_{k}"] = float(telemetry.get(k, 0.0))

        # 2. Normalized residuals
        res_channels = residuals.get("channels", {}) if isinstance(residuals, dict) else getattr(residuals, "channels", {})
        for k in raw_keys:
            ch_data = res_channels.get(k) if isinstance(res_channels, dict) else getattr(res_channels, k, None)
            if isinstance(ch_data, dict):
                norm_res = ch_data.get("normalized_residual", 0.0)
            elif ch_data is not None:
                norm_res = getattr(ch_data, "normalized_residual", 0.0)
            else:
                norm_res = 0.0
            features[f"res_{k}"] = float(norm_res)

        # 3. Cross-sensor relationships
        features["cross_thermal_ratio"] = features["raw_egt"] / max(1.0, features["raw_cht"])
        features["cross_power_ratio"] = features["raw_fuel_flow"] / max(1.0, features["raw_rpm"] / 100.0)
        features["cross_lube_factor"] = features["raw_oil_pressure"] * (100.0 / max(1.0, features["raw_oil_temperature"]))

        # 4. Rolling statistics & derivatives
        self.history.append(dict(features))

        if len(self.history) > 1:
            recent_cht = [h["raw_cht"] for h in self.history]
            recent_egt = [h["raw_egt"] for h in self.history]
            recent_vib = [h["raw_vibration"] for h in self.history]

            features["trend_cht"] = float(recent_cht[-1] - recent_cht[0])
            features["trend_egt"] = float(recent_egt[-1] - recent_egt[0])
            features["trend_vibration"] = float(recent_vib[-1] - recent_vib[0])
            features["std_cht"] = float(np.std(recent_cht))
            features["std_vibration"] = float(np.std(recent_vib))
        else:
            features["trend_cht"] = 0.0
            features["trend_egt"] = 0.0
            features["trend_vibration"] = 0.0
            features["std_cht"] = 0.0
            features["std_vibration"] = 0.0

        return features
