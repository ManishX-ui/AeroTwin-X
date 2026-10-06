"""Fault Injection System for Aero-Piston Simulator."""
import math
import random
from typing import Dict, Any, Tuple

class FaultInjector:
    def __init__(self):
        self.active_fault: str = "NORMAL"
        self.severity: float = 1.0
        self.fault_start_time: float = 0.0
        self.time_in_fault: float = 0.0
        self.drift_accum: float = 0.0

    def set_fault(self, fault_type: str, severity: float = 1.0):
        self.active_fault = fault_type.upper()
        self.severity = max(0.1, min(2.5, severity))
        self.time_in_fault = 0.0
        self.drift_accum = 0.0

    def reset(self):
        self.active_fault = "NORMAL"
        self.severity = 1.0
        self.time_in_fault = 0.0
        self.drift_accum = 0.0

    def apply_fault(self, nominal_telemetry: Dict[str, Any], dt: float) -> Tuple[Dict[str, Any], str]:
        """Apply selected fault dynamics to nominal telemetry parameters.
        Returns: (modified_telemetry, quality_status)
        """
        self.time_in_fault += dt
        t = self.time_in_fault
        s = self.severity
        data = dict(nominal_telemetry)
        quality = "VALID"

        if self.active_fault == "NORMAL":
            return data, quality

        elif self.active_fault == "OVERHEATING":
            # Coolant loss / restricted radiator duct: CHT and oil temp climb progressively
            thermal_ramp = min(1.0, t / 12.0)
            data["cht"] += (38.0 * s * thermal_ramp)
            # Cylinder 2 & 3 experience worst heat buildup
            cyls = list(data["cht_cylinders"])
            cyls[1] += (42.0 * s * thermal_ramp)
            cyls[2] += (40.0 * s * thermal_ramp)
            data["cht_cylinders"] = [round(c, 1) for c in cyls]

            data["egt"] += (48.0 * s * thermal_ramp)
            data["oil_temperature"] += (24.0 * s * thermal_ramp)
            data["oil_pressure"] -= (0.45 * s * thermal_ramp) # thermal thinning

        elif self.active_fault == "INJECTOR_ANOMALY":
            # Injector 3 partially clogged: lean mis-fueling in cyl 3
            cyls_egt = list(data["egt_cylinders"])
            cyls_cht = list(data["cht_cylinders"])
            # Lean burn initially raises EGT in cyl 3, then drops if heavily restricted
            cyls_egt[2] += (65.0 * s * (1.0 + 0.15 * math.sin(t * 3.0)))
            cyls_cht[2] += (18.0 * s)
            data["egt_cylinders"] = [round(e, 1) for e in cyls_egt]
            data["cht_cylinders"] = [round(c, 1) for c in cyls_cht]
            data["vibration"] += (0.45 * s)
            data["fuel_flow"] -= (1.8 * s)

        elif self.active_fault == "MISFIRE":
            # Intermittent ignition drop on dual-spark channel
            misfire_pulse = 1.0 if (int(t * 4.0) % 3 == 0) else 0.0
            data["rpm"] -= (140.0 * s * misfire_pulse)
            data["vibration"] += (1.6 * s * (0.8 + 0.4 * random.random()))
            data["egt"] -= (55.0 * s * misfire_pulse)
            data["manifold_pressure"] += (1.4 * s * misfire_pulse)

        elif self.active_fault == "LUBRICATION_ISSUE":
            # Oil scavenge pump cavitation / relief valve stuck: pressure drop
            press_loss = min(2.8, (0.8 + t * 0.15) * s)
            data["oil_pressure"] = max(0.9, data["oil_pressure"] - press_loss)
            data["oil_temperature"] += (28.0 * s * min(1.0, t / 15.0))
            data["vibration"] += (0.35 * s)

        elif self.active_fault == "ABNORMAL_VIBRATION":
            # Propeller pitch imbalance or PRGB gearbox bearing spalling
            freq_vib = 1.8 * s + (0.5 * math.sin(t * 8.0)) + (0.2 * random.random())
            data["vibration"] += freq_vib

        elif self.active_fault == "SENSOR_DRIFT":
            # Thermocouple calibration drift (+0.4°C / sec)
            self.drift_accum += (0.4 * s * dt)
            data["cht"] += self.drift_accum
            cyls = list(data["cht_cylinders"])
            cyls[0] += self.drift_accum
            data["cht_cylinders"] = [round(c, 1) for c in cyls]
            quality = "DRIFT"

        elif self.active_fault == "SENSOR_DROPOUT":
            # Sensor CAN frame loss / loose wire: reads 0.0 or frozen
            data["cht"] = 0.0
            data["oil_pressure"] = 0.0
            quality = "DROPOUT"

        elif self.active_fault == "ELECTRICAL_FAULT":
            # Alternator regulator burnout: voltage drops from 28V down to battery floor
            decay = min(1.0, t / 8.0)
            data["alternator_current"] = max(0.0, data["alternator_current"] * (1.0 - decay))
            data["battery_voltage"] = max(21.4, 28.2 - (5.8 * s * decay))

        elif self.active_fault == "COMBUSTION_INSTABILITY":
            # Turbo wastegate oscillation: surging MAP and fluctuating EGT
            surge = math.sin(t * 2.5) * 3.5 * s
            data["manifold_pressure"] += surge
            data["rpm"] += (surge * 25.0)
            data["fuel_flow"] += (surge * 0.4)
            data["vibration"] += (0.6 * s * abs(math.sin(t * 2.5)))

        return data, quality
