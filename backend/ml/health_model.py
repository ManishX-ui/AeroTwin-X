"""Subsystem Health Evaluation Model.

Evaluates 0-100 health metrics for all aero-piston subsystems.
Separates physical subsystem health from sensor observability and data quality.
Protects against false-healthy default scores when sensor channels are missing or invalid.
"""
import math
from typing import Dict, Any, List, Optional
from ..app.schemas.predictions import SubsystemHealth


class HealthModel:
    ALL_CHANNELS = [
        "rpm", "cht", "egt", "oil_pressure", "oil_temperature",
        "fuel_flow", "vibration", "battery_voltage", "alternator_current", "manifold_pressure"
    ]

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
        features: Optional[Dict[str, Any]],
        anomaly_score: Optional[float] = 0.0
    ) -> SubsystemHealth:
        """Evaluate 0-100 health metrics with missing sensor protection and observability states."""
        # Defensive check for empty or None features
        if not features or not isinstance(features, dict):
            return SubsystemHealth(
                engine_health=0.0,
                thermal_health=0.0,
                lubrication_health=0.0,
                combustion_health=0.0,
                vibration_health=0.0,
                electrical_health=0.0,
                observability_status="UNAVAILABLE",
                is_observable=False,
                health_status="UNAVAILABLE_INSUFFICIENT_TELEMETRY",
                subsystem_observability={sub: "UNOBSERVED" for sub in self.weights},
                missing_channels=list(self.ALL_CHANNELS),
                data_quality_issues=["Missing or empty feature telemetry record"],
                status_message="Engine health is indeterminate: feature telemetry record is missing or empty."
            )

        # Extract quality tracking metadata if present
        missing_channels = list(features.get("_missing_channels", []))
        invalid_channels = list(features.get("_invalid_channels", []))
        stale_channels = list(features.get("_stale_channels", []))
        frozen_channels = list(features.get("_frozen_channels", []))
        fallback_inputs = list(features.get("_fallback_operating_inputs", []))
        data_issues = list(features.get("_data_quality_issues", []))

        # Check for missing channels if metadata was not populated (e.g. ad-hoc features dict)
        if "_missing_channels" not in features:
            for ch in self.ALL_CHANNELS:
                if f"res_{ch}" not in features and f"raw_{ch}" not in features and ch not in features:
                    missing_channels.append(ch)

        # Document stale, frozen, or fallback inputs in data issues
        for ch in stale_channels:
            if f"Channel {ch} is STALE" not in str(data_issues):
                data_issues.append(f"Channel {ch} is STALE (freshness timeout expired)")
        for ch in frozen_channels:
            if f"Channel {ch} is FROZEN" not in str(data_issues):
                data_issues.append(f"Channel {ch} is FROZEN (constant reading despite changing engine operating state)")
        for inp in fallback_inputs:
            if f"Fallback operating input: {inp}" not in str(data_issues):
                data_issues.append(f"Digital twin evaluation used fallback baseline for operating input: {inp}")

        # Helper to check if a channel is observed and valid
        def is_channel_observed(ch_name: str) -> bool:
            if (ch_name in missing_channels or
                ch_name in invalid_channels or
                ch_name in stale_channels or
                ch_name in frozen_channels):
                return False
            if f"is_present_{ch_name}" in features:
                return bool(features[f"is_present_{ch_name}"])
            # Fallback for manual or legacy feature dictionaries
            return f"res_{ch_name}" in features or f"raw_{ch_name}" in features or ch_name in features

        def safe_float(val, default: float = 0.0) -> float:
            if val is None:
                return default
            try:
                v = float(val)
                return default if (math.isnan(v) or math.isinf(v)) else v
            except (ValueError, TypeError):
                return default

        # Penalty function: each unit of normalized residual degrades health
        penalty = lambda norm_res, scale=8.0: min(65.0, abs(safe_float(norm_res)) * scale)

        subsystem_healths = {}
        subsystem_observed = {}

        # 1. Thermal Health (CHT & EGT)
        cht_obs = is_channel_observed("cht")
        egt_obs = is_channel_observed("egt")
        if not cht_obs and not egt_obs:
            subsystem_observed["thermal"] = False
            subsystem_healths["thermal"] = 0.0
            data_issues.append("Thermal subsystem unobservable: both CHT and EGT sensors missing, stale, or invalid")
        else:
            subsystem_observed["thermal"] = True
            therm_res_vals = []
            if cht_obs:
                therm_res_vals.append(abs(safe_float(features.get("res_cht"))))
            if egt_obs:
                therm_res_vals.append(abs(safe_float(features.get("res_egt"))))
            therm_res = max(therm_res_vals) if therm_res_vals else 0.0
            thermal_penalty = penalty(therm_res, 10.0) + (abs(safe_float(features.get("trend_cht", 0.0))) * 2.0)
            subsystem_healths["thermal"] = max(10.0, min(100.0, 99.0 - thermal_penalty))

        # 2. Lubrication Health (Oil pressure & Oil temperature)
        op_obs = is_channel_observed("oil_pressure")
        ot_obs = is_channel_observed("oil_temperature")
        if not op_obs and not ot_obs:
            subsystem_observed["lubrication"] = False
            subsystem_healths["lubrication"] = 0.0
            data_issues.append("Lubrication subsystem unobservable: oil pressure and oil temperature sensors missing, stale, or invalid")
        else:
            subsystem_observed["lubrication"] = True
            lube_res_vals = []
            if op_obs:
                lube_res_vals.append(abs(safe_float(features.get("res_oil_pressure"))))
            if ot_obs:
                lube_res_vals.append(abs(safe_float(features.get("res_oil_temperature"))))
            lube_res = max(lube_res_vals) if lube_res_vals else 0.0
            lube_penalty = penalty(lube_res, 11.0)
            subsystem_healths["lubrication"] = max(10.0, min(100.0, 99.0 - lube_penalty))

        # 3. Combustion Health (Fuel flow & Manifold pressure)
        ff_obs = is_channel_observed("fuel_flow")
        map_obs = is_channel_observed("manifold_pressure")
        if not ff_obs and not map_obs:
            subsystem_observed["combustion"] = False
            subsystem_healths["combustion"] = 0.0
            data_issues.append("Combustion subsystem unobservable: fuel flow and MAP sensors missing, stale, or invalid")
        else:
            subsystem_observed["combustion"] = True
            comb_res_vals = []
            if ff_obs:
                comb_res_vals.append(abs(safe_float(features.get("res_fuel_flow"))))
            if map_obs:
                comb_res_vals.append(abs(safe_float(features.get("res_manifold_pressure"))))
            comb_res = max(comb_res_vals) if comb_res_vals else 0.0
            comb_penalty = penalty(comb_res, 8.5)
            subsystem_healths["combustion"] = max(10.0, min(100.0, 98.0 - comb_penalty))

        # 4. Vibration Health (Vibration sensor)
        vib_obs = is_channel_observed("vibration")
        if not vib_obs:
            subsystem_observed["vibration"] = False
            subsystem_healths["vibration"] = 0.0
            data_issues.append("Vibration subsystem unobservable: vibration sensor missing, stale, or invalid")
        else:
            subsystem_observed["vibration"] = True
            vib_res = abs(safe_float(features.get("res_vibration", 0.0)))
            vib_penalty = penalty(vib_res, 12.0) + (safe_float(features.get("std_vibration", 0.0)) * 15.0)
            subsystem_healths["vibration"] = max(10.0, min(100.0, 99.0 - vib_penalty))

        # 5. Electrical Health (Battery voltage)
        batt_obs = is_channel_observed("battery_voltage")
        if not batt_obs:
            subsystem_observed["electrical"] = False
            subsystem_healths["electrical"] = 0.0
            data_issues.append("Electrical subsystem unobservable: battery voltage sensor missing, stale, or invalid")
        else:
            subsystem_observed["electrical"] = True
            batt_v = safe_float(features.get("raw_battery_voltage", 28.0), default=28.0)
            volt_delta = max(0.0, 28.0 - batt_v)
            elec_penalty = volt_delta * 12.0
            subsystem_healths["electrical"] = max(10.0, min(100.0, 100.0 - elec_penalty))

        # Overall composite Engine Health & Observability determination
        observed_subsystems = [sub for sub, is_obs in subsystem_observed.items() if is_obs]
        subsystem_observability = {sub: ("OBSERVED" if is_obs else "UNOBSERVED") for sub, is_obs in subsystem_observed.items()}

        safe_anomaly = safe_float(anomaly_score, 0.0)

        if not observed_subsystems:
            composite = 0.0
            observability_status = "UNAVAILABLE"
            is_observable = False
            health_status = "UNAVAILABLE_INSUFFICIENT_TELEMETRY"
            status_msg = "Engine health is indeterminate: zero subsystems observable due to missing/stale telemetry."
        else:
            is_observable = True
            total_obs_weight = sum(self.weights[sub] for sub in observed_subsystems)
            composite = sum(subsystem_healths[sub] * self.weights[sub] for sub in observed_subsystems) / total_obs_weight

            # Dampen composite slightly if high anomaly detected
            if safe_anomaly > 0.4:
                composite = min(composite, 100.0 - (safe_anomaly * 45.0))

            # Determine health_status (Concern B: explicit distinction between fault vs unobservable vs valid)
            if fallback_inputs:
                # Concern A: digital twin used fallback nominal operating point; cannot claim verified critical fault
                health_status = "DEGRADED_PARTIAL_OBSERVABILITY"
                status_msg = f"Engine health estimated with fallback operating baseline ({', '.join(fallback_inputs)}); physical fault confidence degraded."
            elif any(subsystem_healths[sub] < 65.0 for sub in observed_subsystems) or (composite < 65.0 and not (missing_channels or invalid_channels or stale_channels or frozen_channels)):
                health_status = "CRITICAL_FAULT_DETECTED"
                status_msg = f"Critical physical engine degradation detected (health index {composite:.1f}/100)."
            elif missing_channels or invalid_channels or stale_channels or frozen_channels or len(observed_subsystems) < len(self.weights):
                health_status = "DEGRADED_PARTIAL_OBSERVABILITY"
                status_msg = "Engine health estimated from partial observations; data quality or telemetry coverage degraded."
            else:
                health_status = "VALID_NUMERICAL_ESTIMATE"
                status_msg = "Subsystem health successfully evaluated from verified sensor observations."

            if missing_channels or invalid_channels or stale_channels or frozen_channels or fallback_inputs or len(observed_subsystems) < len(self.weights):
                observability_status = "DEGRADED_OBSERVABILITY"
            else:
                observability_status = "FULL_OBSERVABILITY"

        return SubsystemHealth(
            engine_health=round(composite, 1),
            thermal_health=round(subsystem_healths["thermal"], 1),
            lubrication_health=round(subsystem_healths["lubrication"], 1),
            combustion_health=round(subsystem_healths["combustion"], 1),
            vibration_health=round(subsystem_healths["vibration"], 1),
            electrical_health=round(subsystem_healths["electrical"], 1),
            observability_status=observability_status,
            is_observable=is_observable,
            health_status=health_status,
            subsystem_observability=subsystem_observability,
            missing_channels=sorted(list(set(missing_channels + stale_channels))),
            data_quality_issues=data_issues,
            status_message=status_msg
        )

