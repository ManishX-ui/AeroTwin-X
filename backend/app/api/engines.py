"""Engine State and Health API Endpoints."""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from ..services.state_service import state_service

router = APIRouter()

@router.get("/engine/{engine_id}/state")
async def get_engine_state(engine_id: str):
    """Retrieve full synchronized state: Telemetry, Physics Digital Twin, and Residuals."""
    if not state_service.latest_telemetry:
        packet, m_ctx = state_service.simulator.generate_step(0.1)
    else:
        packet = state_service.latest_telemetry

    return {
        "engine_id": engine_id,
        "uav_id": packet.uav_id,
        "timestamp": packet.timestamp,
        "status": "ONLINE",
        "telemetry": packet.model_dump(),
        "digital_twin": state_service.latest_twin.model_dump() if state_service.latest_twin else None,
        "divergence_score": state_service.latest_twin.overall_divergence if state_service.latest_twin else 0.04
    }

@router.get("/engine/{engine_id}/telemetry")
async def get_engine_telemetry(engine_id: str):
    """Retrieve latest telemetry snapshot for engine."""
    if state_service.latest_telemetry:
        return state_service.latest_telemetry.model_dump()
    packet, _ = state_service.simulator.generate_step(0.1)
    return packet.model_dump()

@router.get("/engine/{engine_id}/health")
async def get_engine_health(engine_id: str):
    """Retrieve 0-100 subsystem health scores and component statuses for 3D engine view."""
    pred = state_service.latest_prediction
    health_obj = pred.health if pred else None

    # Compute 3D Engine Component Statuses (NORMAL, WARNING, CRITICAL)
    components = {}
    if health_obj:
        components["cylinders"] = "CRITICAL" if health_obj.thermal_health < 50 else ("WARNING" if health_obj.thermal_health < 80 else "NORMAL")
        components["lubrication"] = "CRITICAL" if health_obj.lubrication_health < 50 else ("WARNING" if health_obj.lubrication_health < 80 else "NORMAL")
        components["cooling"] = "CRITICAL" if health_obj.thermal_health < 50 else ("WARNING" if health_obj.thermal_health < 80 else "NORMAL")
        components["combustion"] = "CRITICAL" if health_obj.combustion_health < 50 else ("WARNING" if health_obj.combustion_health < 80 else "NORMAL")
        components["gearbox_vibration"] = "CRITICAL" if health_obj.vibration_health < 50 else ("WARNING" if health_obj.vibration_health < 80 else "NORMAL")
        components["electrical"] = "CRITICAL" if health_obj.electrical_health < 50 else ("WARNING" if health_obj.electrical_health < 80 else "NORMAL")
    else:
        components = {k: "NORMAL" for k in ["cylinders", "lubrication", "cooling", "combustion", "gearbox_vibration", "electrical"]}

    return {
        "engine_id": engine_id,
        "health": health_obj.model_dump() if health_obj else {},
        "components_3d": components,
        "rul": pred.rul.model_dump() if pred else {},
        "timestamp": pred.timestamp if pred else ""
    }

@router.get("/engine/{engine_id}/predictions")
async def get_engine_predictions(engine_id: str):
    """Retrieve active AI predictions, confidence, anomaly score, and SHAP evidence."""
    if state_service.latest_prediction:
        return state_service.latest_prediction.model_dump()
    return {}
