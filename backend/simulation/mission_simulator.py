"""Mission Profile and Flight Dynamics Simulator."""
from typing import Dict, Any

class MissionSimulator:
    def __init__(self):
        self.phase: str = "CRUISE"
        self.mission_id: str = "MSN-ISR-0814"
        self.uav_id: str = "UAV-01"
        self.engine_id: str = "AE-03"
        self.elapsed_seconds: float = 3840.0 # ~1h 4m into mission
        self.altitude_ft: float = 14500.0 # MALE UAV cruise ceiling
        self.ambient_temp_c: float = -13.7 # cold high-altitude ISA
        self.throttle_pct: float = 75.0
        self.is_running: bool = True

    def set_phase(self, new_phase: str):
        valid_phases = ["TAKEOFF", "CLIMB", "CRUISE", "LOITER", "DESCENT", "LANDING"]
        if new_phase.upper() in valid_phases:
            self.phase = new_phase.upper()
            if self.phase == "TAKEOFF":
                self.throttle_pct = 100.0
                self.altitude_ft = 800.0
                self.ambient_temp_c = 15.0
            elif self.phase == "CLIMB":
                self.throttle_pct = 85.0
                self.altitude_ft = 6500.0
                self.ambient_temp_c = 2.0
            elif self.phase == "CRUISE":
                self.throttle_pct = 75.0
                self.altitude_ft = 14500.0
                self.ambient_temp_c = -13.7
            elif self.phase == "LOITER":
                self.throttle_pct = 55.0
                self.altitude_ft = 12000.0
                self.ambient_temp_c = -8.5
            elif self.phase == "DESCENT":
                self.throttle_pct = 35.0
                self.altitude_ft = 4500.0
                self.ambient_temp_c = 6.0
            elif self.phase == "LANDING":
                self.throttle_pct = 25.0
                self.altitude_ft = 250.0
                self.ambient_temp_c = 14.5

    def step(self, dt: float) -> Dict[str, Any]:
        """Advance mission time and return atmospheric/operating context."""
        if self.is_running:
            self.elapsed_seconds += dt

        return {
            "mission_id": self.mission_id,
            "uav_id": self.uav_id,
            "engine_id": self.engine_id,
            "phase": self.phase,
            "elapsed_seconds": round(self.elapsed_seconds, 1),
            "altitude_ft": round(self.altitude_ft, 1),
            "ambient_temp_c": round(self.ambient_temp_c, 1),
            "throttle_pct": round(self.throttle_pct, 1)
        }
