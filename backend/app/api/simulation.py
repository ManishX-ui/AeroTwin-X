"""Simulation and Fault Injection API Endpoints."""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from ..services.state_service import state_service
from ..schemas.simulation import FaultInjectionRequest, MissionPhaseRequest, SimulationScenario

router = APIRouter()

SCENARIOS = [
    {
        "id": "NORMAL",
        "name": "Nominal Baseline Flight",
        "description": "Stable steady-state operation within nominal multi-sensor tolerances.",
        "target_subsystem": "All",
        "expected_symptoms": ["Zero exceedance", "High health >95%", "Low anomaly <0.20"]
    },
    {
        "id": "OVERHEATING",
        "name": "Thermal Runaway / Coolant Loss",
        "description": "Cylinder head temperature and oil temperature progressive divergence.",
        "target_subsystem": "Cooling & Thermal",
        "expected_symptoms": ["CHT increases +40°C", "EGT increases +50°C", "Thermal residual spike", "XGBoost predicts OVERHEATING"]
    },
    {
        "id": "INJECTOR_ANOMALY",
        "name": "Injector Clog / Spray Degradation",
        "description": "Cylinder #3 fuel restriction causing localized lean mis-fueling.",
        "target_subsystem": "Fuel Injection",
        "expected_symptoms": ["Cylinder 3 EGT delta deviation", "High-frequency torque ripple", "Negative fuel flow residual"]
    },
    {
        "id": "MISFIRE",
        "name": "Ignition Circuit Misfire",
        "description": "Intermittent spark dropout causing instantaneous RPM dips and vibration spikes.",
        "target_subsystem": "Dual FADEC Ignition",
        "expected_symptoms": ["Vibration > 2.5g", "RPM jitter", "Cold cylinder exhaust pulse"]
    },
    {
        "id": "LUBRICATION_ISSUE",
        "name": "Oil Pressure Relief Failure",
        "description": "Oil pump pressure drops below 2.0 bar with elevated crankcase friction.",
        "target_subsystem": "Lubrication Circuit",
        "expected_symptoms": ["Oil pressure collapse", "Oil temp rise", "Hydrodynamic film alarm"]
    },
    {
        "id": "ABNORMAL_VIBRATION",
        "name": "Propeller / Reduction Gearbox Imbalance",
        "description": "Excessive mechanical harmonic vibration exceeding 3.5g RMS.",
        "target_subsystem": "PRGB Reduction Gearbox",
        "expected_symptoms": ["Vibration residual spike", "Mechanical fatigue alert"]
    },
    {
        "id": "SENSOR_DRIFT",
        "name": "Thermocouple Calibration Drift",
        "description": "Type-K CHT thermocouple begins unilateral unphysical ramp.",
        "target_subsystem": "Avionics CAN Instrumentation",
        "expected_symptoms": ["Uncorrelated positive residual", "Cross-sensor contradiction"]
    },
    {
        "id": "SENSOR_DROPOUT",
        "name": "CAN Bus Sensor Dropout",
        "description": "Wire harness disconnect causing sensor output to drop to zero.",
        "target_subsystem": "CAN Bus Telemetry",
        "expected_symptoms": ["Null/Zero sensor frame", "Quality flag: DROPOUT", "Data integrity alarm"]
    },
    {
        "id": "ELECTRICAL_FAULT",
        "name": "Alternator Failure / Bus Depletion",
        "description": "Alternator current output drops to 0A, forcing 28V bus onto battery drain.",
        "target_subsystem": "Electrical Power Generation",
        "expected_symptoms": ["Current collapse", "Battery voltage degrades to 22V"]
    },
    {
        "id": "COMBUSTION_INSTABILITY",
        "name": "Turbocharger Wastegate Surge",
        "description": "Boost pressure oscillations and cyclic manifold air pressure surges.",
        "target_subsystem": "Turbocharger & Wastegate",
        "expected_symptoms": ["MAP oscillation", "RPM surge cycles", "Combustion instability"]
    }
]

@router.get("/simulation/scenarios")
async def list_scenarios():
    """List all available fault injection scenarios."""
    return SCENARIOS

@router.post("/simulation/start")
async def start_simulation():
    """Start or resume continuous simulation."""
    state_service.simulator.mission.is_running = True
    return {"status": "RUNNING", "message": "Simulation active"}

@router.post("/simulation/stop")
async def stop_simulation():
    """Pause continuous simulation."""
    state_service.simulator.mission.is_running = False
    return {"status": "PAUSED", "message": "Simulation paused"}

@router.post("/simulation/phase")
async def set_phase(req: MissionPhaseRequest):
    """Set the active simulated mission flight phase."""
    state_service.set_mission_phase(req.phase)
    return {
        "status": "PHASE_UPDATED",
        "new_phase": state_service.simulator.mission.phase,
        "altitude_ft": state_service.simulator.mission.altitude_ft,
        "throttle_pct": state_service.simulator.mission.throttle_pct
    }

@router.post("/faults/inject")
async def inject_fault(req: FaultInjectionRequest):
    """Inject a specific fault scenario with optional severity multiplier."""
    state_service.inject_fault(req.fault_type, req.severity)
    return {
        "status": "INJECTED",
        "fault_type": req.fault_type,
        "severity": req.severity,
        "message": f"Fault '{req.fault_type}' successfully applied to physics simulator."
    }

@router.post("/simulation/reset")
async def reset_simulation():
    """Reset simulator to nominal baseline."""
    state_service.reset_nominal()
    return {"status": "RESET", "active_fault": "NORMAL"}
