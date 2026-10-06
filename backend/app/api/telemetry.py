"""Telemetry API Endpoints."""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from ..services.state_service import state_service
from ..schemas.telemetry import TelemetryPacket, TelemetryHistoryResponse

router = APIRouter()

@router.get("/telemetry", response_model=TelemetryPacket)
async def get_current_telemetry():
    """Get most recent live telemetry packet."""
    if state_service.latest_telemetry:
        return state_service.latest_telemetry
    packet, _ = state_service.simulator.generate_step(0.1)
    return packet

@router.get("/telemetry/history", response_model=List[Dict[str, Any]])
async def get_telemetry_history(limit: int = Query(60, ge=1, le=600)):
    """Get moving window history of recent frames."""
    history_list = list(state_service.telemetry_history)
    return history_list[-limit:]
