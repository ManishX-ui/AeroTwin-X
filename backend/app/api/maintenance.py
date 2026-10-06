"""Maintenance and CBM+ Advisory API Endpoints."""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import datetime
import uuid
from ..services.state_service import state_service
from ..schemas.alerts import MaintenanceTask

router = APIRouter()

@router.get("/maintenance", response_model=List[MaintenanceTask])
async def list_maintenance_tasks():
    """List predictive maintenance advisories and active work orders."""
    return state_service.maintenance_tasks

@router.post("/maintenance", response_model=MaintenanceTask)
async def create_maintenance_task(data: Dict[str, Any]):
    """Create a new maintenance task or work order."""
    iso_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_task = MaintenanceTask(
        id=str(uuid.uuid4())[:8],
        task_order=f"WO-2026-{len(state_service.maintenance_tasks) + 101}",
        title=data.get("title", "Ad-hoc Engine Turnaround Inspection"),
        subsystem=data.get("subsystem", "Propulsion Core"),
        priority=data.get("priority", "HIGH"),
        advisory_text=data.get("advisory_text", "AI-assisted maintenance recommendation based on telemetric condition monitoring."),
        evidence_triggers=data.get("evidence_triggers", ["Operator created work order"]),
        status="OPEN",
        created_at=iso_now,
        assigned_tech=data.get("assigned_tech", "MALE Flight Line Team"),
        easa_part_m_ref=data.get("easa_part_m_ref", "M.A.401")
    )
    state_service.maintenance_tasks.insert(0, new_task)
    return new_task
