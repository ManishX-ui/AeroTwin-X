"""Simulation & Mission Control Schemas."""
from pydantic import BaseModel, Field
from typing import List, Optional

class FaultInjectionRequest(BaseModel):
    fault_type: str # NORMAL, OVERHEATING, INJECTOR_ANOMALY, MISFIRE, LUBRICATION_ISSUE, ABNORMAL_VIBRATION, SENSOR_DRIFT, SENSOR_DROPOUT, ELECTRICAL_FAULT, COMBUSTION_INSTABILITY
    severity: float = Field(1.0, ge=0.0, le=2.0, description="Severity multiplier 0.0 to 2.0")
    duration_seconds: Optional[float] = Field(None, description="Optional auto-clear duration")

class MissionPhaseRequest(BaseModel):
    phase: str # TAKEOFF, CLIMB, CRUISE, LOITER, DESCENT, LANDING

class SimulationScenario(BaseModel):
    id: str
    name: str
    description: str
    target_subsystem: str
    expected_symptoms: List[str]

class SimulationStatus(BaseModel):
    mode: str # SIMULATION, LIVE, REPLAY
    is_running: bool
    mission_id: str
    uav_id: str
    engine_id: str
    active_phase: str
    active_fault: str
    fault_severity: float
    time_elapsed_seconds: float
