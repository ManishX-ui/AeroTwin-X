"""Alerts Management API Endpoints."""
from fastapi import APIRouter, HTTPException, Path
from typing import List
from ..services.state_service import state_service
from ..schemas.alerts import AlertItem, AlertAckRequest

router = APIRouter()

@router.get("/alerts", response_model=List[AlertItem])
async def list_alerts():
    """List all system alerts sorted by urgency."""
    return state_service.alerts

@router.post("/alerts/{alert_id}/ack")
async def acknowledge_alert(alert_id: str = Path(...)):
    """Acknowledge an alert."""
    success = state_service.acknowledge_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert ID not found")
    return {"status": "SUCCESS", "alert_id": alert_id, "acknowledged": True}
