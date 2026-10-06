"""Residual Analysis and State Comparison Engine."""
from typing import Dict, Any, Tuple
from .performance_map import SENSOR_SCALES
from ..app.schemas.digital_twin import ChannelResidual, DigitalTwinState

class ResidualAnalyzer:
    def __init__(self):
        self.scales = SENSOR_SCALES
        self.units = {
            "cht": "°C",
            "egt": "°C",
            "oil_pressure": "bar",
            "oil_temperature": "°C",
            "fuel_flow": "L/h",
            "vibration": "g",
            "battery_voltage": "V",
            "alternator_current": "A",
            "manifold_pressure": "inHg",
            "rpm": "RPM"
        }

    def compute_residuals(
        self,
        actual_telemetry: Dict[str, Any],
        expected_telemetry: Dict[str, Any],
        timestamp: str
    ) -> DigitalTwinState:
        """Compute raw and normalized residuals between actual telemetry and physics expectation."""
        channels: Dict[str, ChannelResidual] = {}
        sum_sq_norm = 0.0
        num_evaluated = 0

        for key, scale in self.scales.items():
            if key in actual_telemetry and key in expected_telemetry:
                act = float(actual_telemetry[key])
                exp = float(expected_telemetry[key])
                res = act - exp
                norm_res = res / scale

                # Determine channel status
                abs_norm = abs(norm_res)
                if abs_norm > 3.0:
                    status = "CRITICAL"
                elif abs_norm > 1.8:
                    status = "WARNING"
                else:
                    status = "NORMAL"

                channels[key] = ChannelResidual(
                    actual=round(act, 2),
                    expected=round(exp, 2),
                    residual=round(res, 2),
                    normalized_residual=round(norm_res, 2),
                    unit=self.units.get(key, ""),
                    status=status
                )

                sum_sq_norm += (norm_res ** 2)
                num_evaluated += 1

        # Chi-square / overall divergence metric
        overall_div = (sum_sq_norm / max(1, num_evaluated)) ** 0.5
        # Twin sync percentage: nominal is ~99.5%, decreases as divergence spikes
        sync_pct = max(35.0, min(100.0, 100.0 - (overall_div * 12.0)))

        return DigitalTwinState(
            timestamp=timestamp,
            twin_sync_percent=round(sync_pct, 1),
            overall_divergence=round(overall_div, 2),
            channels=channels
        )
