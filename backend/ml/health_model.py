"""Subsystem Health Evaluation Model."""
from typing import Dict, Any
from ..app.schemas.predictions import SubsystemHealth

class HealthModel:
    def __init__(self):
        # Weights for composite engine health
        self.weights = {
            "thermal": 0.25,
            "lubrication": 0.25,
            "combustion": 0.20,
            "vibration": 0.20,
            "electrical": 0.10
        }

    def compute_health(
        self,
        features: Dict[str, float],
        anomaly_score: float
    ) -> SubsystemHealth:
        """Evaluate 0-100 health metrics for all aero-piston subsystems."""
        # Penalty function: each unit of normalized residual degrades health
        penalty = lambda norm_res, scale=8.0: min(65.0, abs(norm_res) * scale)

        # 1. Thermal Health (CHT & EGT residuals & trends)
        therm_res = max(abs(features.get("res_cht", 0.0)), abs(features.get("res_egt", 0.0)))
        thermal_penalty = penalty(therm_res, 10.0) + (abs(features.get("trend_cht", 0.0)) * 2.0)
        thermal_h = max(10.0, min(100.0, 99.0 - thermal_penalty))

        # 2. Lubrication Health (Oil pressure & Oil temperature)
        lube_res = max(abs(features.get("res_oil_pressure", 0.0)), abs(features.get("res_oil_temperature", 0.0)))
        lube_penalty = penalty(lube_res, 11.0)
        lube_h = max(10.0, min(100.0, 99.0 - lube_penalty))

        # 3. Combustion Health (Fuel flow, EGT balance, MAP surging)
        comb_res = max(abs(features.get("res_fuel_flow", 0.0)), abs(features.get("res_manifold_pressure", 0.0)))
        comb_penalty = penalty(comb_res, 8.5)
        comb_h = max(10.0, min(100.0, 98.0 - comb_penalty))

        # 4. Vibration Health
        vib_res = abs(features.get("res_vibration", 0.0))
        vib_penalty = penalty(vib_res, 12.0) + (features.get("std_vibration", 0.0) * 15.0)
        vib_h = max(10.0, min(100.0, 99.0 - vib_penalty))

        # 5. Electrical Health
        batt_v = features.get("raw_battery_voltage", 28.0)
        volt_delta = max(0.0, 28.0 - batt_v)
        elec_penalty = volt_delta * 12.0
        elec_h = max(10.0, min(100.0, 100.0 - elec_penalty))

        # Overall composite Engine Health
        composite = (
            thermal_h * self.weights["thermal"] +
            lube_h * self.weights["lubrication"] +
            comb_h * self.weights["combustion"] +
            vib_h * self.weights["vibration"] +
            elec_h * self.weights["electrical"]
        )

        # Dampen composite slightly if high anomaly detected
        if anomaly_score > 0.4:
            composite = min(composite, 100.0 - (anomaly_score * 45.0))

        return SubsystemHealth(
            engine_health=round(composite, 1),
            thermal_health=round(thermal_h, 1),
            lubrication_health=round(lube_h, 1),
            combustion_health=round(comb_h, 1),
            vibration_health=round(vib_h, 1),
            electrical_health=round(elec_h, 1)
        )
