"""Continuous Telemetry Engine Simulator."""
import datetime
import random
import math
from typing import Dict, Any, Tuple
from .fault_injection import FaultInjector
from .mission_simulator import MissionSimulator
from ..app.schemas.telemetry import TelemetryPacket
from ..digital_twin.performance_map import ROTAX_915ISC_BASELINES

class EngineSimulator:
    def __init__(self):
        self.mission = MissionSimulator()
        self.fault_injector = FaultInjector()
        self.last_update = datetime.datetime.now(datetime.timezone.utc)
        self.mode = "SIMULATION" # SIMULATION, LIVE, REPLAY

    def generate_step(self, dt: float = 0.5) -> Tuple[TelemetryPacket, Dict[str, Any]]:
        """Generate one discrete telemetry step."""
        now = datetime.datetime.now(datetime.timezone.utc)
        iso_now = now.isoformat()

        # Step mission profile
        m_ctx = self.mission.step(dt)
        phase = m_ctx["phase"]
        base = ROTAX_915ISC_BASELINES.get(phase, ROTAX_915ISC_BASELINES["CRUISE"])

        # Base nominal physics values with realistic sensor noise (+-0.5% jitter)
        jitter = lambda scale: (random.random() - 0.5) * 2.0 * scale

        nominal_rpm = base["rpm"] + jitter(12.0)
        nominal_cht = base["cht_nominal_c"] + jitter(0.4)
        nominal_egt = base["egt_nominal_c"] + jitter(1.5)
        nominal_oil_p = base["oil_press_bar"] + jitter(0.04)
        nominal_oil_t = base["oil_temp_c"] + jitter(0.3)
        nominal_ff = base["fuel_flow_lph"] + jitter(0.15)
        nominal_vib = base["vibration_g"] + jitter(0.03)
        nominal_batt = base["battery_v"] + jitter(0.05)
        nominal_alt_i = base["alternator_a"] + jitter(0.2)
        nominal_map = base["map_inhg"] + jitter(0.1)

        # 4 individual cylinder distributions (slight natural balance deviation)
        cht_cyls = [
            nominal_cht - 0.8 + jitter(0.3),
            nominal_cht + 1.2 + jitter(0.3),
            nominal_cht - 0.5 + jitter(0.3),
            nominal_cht + 0.6 + jitter(0.3)
        ]
        egt_cyls = [
            nominal_egt - 4.0 + jitter(1.0),
            nominal_egt + 3.5 + jitter(1.0),
            nominal_egt - 1.5 + jitter(1.0),
            nominal_egt + 2.0 + jitter(1.0)
        ]

        nominal_dict = {
            "timestamp": iso_now,
            "uav_id": m_ctx["uav_id"],
            "engine_id": m_ctx["engine_id"],
            "rpm": round(nominal_rpm, 1),
            "cht": round(nominal_cht, 1),
            "cht_cylinders": [round(c, 1) for c in cht_cyls],
            "egt": round(nominal_egt, 1),
            "egt_cylinders": [round(e, 1) for e in egt_cyls],
            "oil_pressure": round(nominal_oil_p, 2),
            "oil_temperature": round(nominal_oil_t, 1),
            "fuel_flow": round(nominal_ff, 2),
            "vibration": round(nominal_vib, 2),
            "battery_voltage": round(nominal_batt, 2),
            "alternator_current": round(nominal_alt_i, 1),
            "injection_timing": 18.2 + jitter(0.1),
            "throttle_pos": m_ctx["throttle_pct"],
            "manifold_pressure": round(nominal_map, 1),
            "ambient_temp": m_ctx["ambient_temp_c"],
            "pressure_altitude": m_ctx["altitude_ft"],
            "mission_phase": phase,
            "quality": "VALID",
            "source": self.mode
        }

        # Apply fault injection if non-normal
        active_data, quality = self.fault_injector.apply_fault(nominal_dict, dt)
        active_data["quality"] = quality

        packet = TelemetryPacket(**active_data)
        return packet, m_ctx
