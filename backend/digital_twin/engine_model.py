"""Physics-Informed Aero-Piston Digital Twin Engine Model.

Estimates expected steady-state and dynamic thermodynamic response of
a turbocharged aero-piston engine (Rotax 915iSc class) for MALE UAVs.
"""
import math
from typing import Dict, Any, Optional
from .performance_map import (
    ROTAX_915ISC_BASELINES,
    ISA_SEA_LEVEL_TEMP_C,
    ISA_TEMP_LAPSE_RATE,
    ISA_SEA_LEVEL_PRESSURE_HPA
)

class AeroPistonDigitalTwin:
    def __init__(self):
        self.previous_expected: Optional[Dict[str, float]] = None

    def compute_expected_state(
        self,
        rpm: float,
        throttle_pct: float,
        altitude_ft: float,
        ambient_temp_c: float,
        mission_phase: str = "CRUISE",
        dt_seconds: float = 0.5
    ) -> Dict[str, float]:
        """Compute expected thermodynamic engine state based on physical inputs."""
        # 1. ISA ambient atmospheric temperature at altitude
        isa_expected_temp = ISA_SEA_LEVEL_TEMP_C - (ISA_TEMP_LAPSE_RATE * altitude_ft)
        temp_deviation = ambient_temp_c - isa_expected_temp # ISA delta

        # 2. Atmospheric density ratio sigma
        density_ratio = math.exp(-altitude_ft / 29000.0)

        # 3. Base lookup from phase, fallback to cruise
        base = ROTAX_915ISC_BASELINES.get(mission_phase, ROTAX_915ISC_BASELINES["CRUISE"])
        # Normalized ratios relative to nominal phase setpoint
        base_throttle = max(10.0, base.get("throttle", 75.0))
        base_rpm = max(1000.0, base.get("rpm", 2550.0))
        throttle_ratio = max(0.2, min(1.5, throttle_pct / base_throttle))
        rpm_ratio = max(0.4, min(1.4, rpm / base_rpm))

        # Expected Manifold Air Pressure (MAP) and Fuel Flow
        exp_map = base["map_inhg"] * (0.85 * throttle_ratio + 0.15 * rpm_ratio)
        exp_fuel_flow = base["fuel_flow_lph"] * (0.80 * throttle_ratio + 0.20 * rpm_ratio)

        # Expected CHT: calibrated to base nominal
        throttle_delta = throttle_ratio - 1.0
        rpm_delta = rpm_ratio - 1.0
        exp_cht = base["cht_nominal_c"] + (throttle_delta * 18.0) + (rpm_delta * 8.0) + (temp_deviation * 0.35)

        # Expected EGT: calibrated to base nominal
        exp_egt = base["egt_nominal_c"] + (throttle_delta * 28.0) + (rpm_delta * 14.0) + (temp_deviation * 0.2)

        # Expected Oil Pressure and Temperature: calibrated to base nominal
        exp_oil_temp = base["oil_temp_c"] + (throttle_delta * 18.0) + (rpm_delta * 8.0) + (temp_deviation * 0.25)
        viscosity_factor = max(0.9, 1.0 - ((exp_oil_temp - base["oil_temp_c"]) * 0.005))
        exp_oil_press = (base["oil_press_bar"] + (rpm_delta * 1.5)) * viscosity_factor

        # Expected Vibration: calibrated to base nominal
        exp_vibration = base["vibration_g"] * (0.5 + 0.5 * math.pow(rpm_ratio, 1.2))

        # Expected Electrical
        exp_batt_voltage = base["battery_v"]
        exp_alt_current = base["alternator_a"] * (0.7 + 0.3 * throttle_ratio)

        expected_state = {
            "rpm": round(rpm, 1),
            "cht": round(exp_cht, 1),
            "egt": round(exp_egt, 1),
            "oil_pressure": round(exp_oil_press, 2),
            "oil_temperature": round(exp_oil_temp, 1),
            "fuel_flow": round(exp_fuel_flow, 2),
            "vibration": round(exp_vibration, 2),
            "battery_voltage": round(exp_batt_voltage, 2),
            "alternator_current": round(exp_alt_current, 1),
            "manifold_pressure": round(exp_map, 1)
        }

        # Apply 1st order lag filter (thermal inertia) if previous state exists
        if self.previous_expected is not None:
            alpha_thermal = min(1.0, dt_seconds / 4.0) # 4 sec thermal time constant
            alpha_fast = min(1.0, dt_seconds / 1.0)
            expected_state["cht"] = round(self.previous_expected["cht"] * (1 - alpha_thermal) + exp_cht * alpha_thermal, 1)
            expected_state["egt"] = round(self.previous_expected["egt"] * (1 - alpha_fast) + exp_egt * alpha_fast, 1)
            expected_state["oil_temperature"] = round(self.previous_expected["oil_temperature"] * (1 - alpha_thermal) + exp_oil_temp * alpha_thermal, 1)

        self.previous_expected = expected_state
        return expected_state
