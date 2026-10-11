"""Maintenance and CBM+ Advisory API Endpoints."""
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import datetime
import uuid
import io
import csv
from ..services.state_service import state_service
from ..schemas.alerts import MaintenanceTask

router = APIRouter()

class CreateMaintenanceTaskRequest(BaseModel):
    title: str = Field(..., description="Title of the work order")
    subsystem: str = Field("Propulsion Core", description="Target subsystem")
    priority: str = Field("HIGH", description="CRITICAL, HIGH, MEDIUM, LOW")
    advisory_text: Optional[str] = Field("Engineering advisory and maintenance inspection", description="Engineering advisory and task description")
    assigned_tech: Optional[str] = Field("MALE Flight Line Team", description="Assigned technician or crew")
    easa_part_m_ref: Optional[str] = Field("M.A.401 / SB-915-021", description="Regulatory compliance reference")
    evidence_triggers: Optional[List[str]] = Field(default_factory=lambda: ["Manual work order dispatch"])

class UpdateMaintenanceTaskRequest(BaseModel):
    title: Optional[str] = None
    subsystem: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_tech: Optional[str] = None
    advisory_text: Optional[str] = None
    easa_part_m_ref: Optional[str] = None

class AssignTechRequest(BaseModel):
    assigned_tech: str

class UpdateStatusRequest(BaseModel):
    status: str

# Seed initial tasks if empty
def _ensure_initial_tasks():
    if not state_service.maintenance_tasks:
        iso_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        state_service.maintenance_tasks = [
            MaintenanceTask(
                id="TSK-401",
                task_order="WO-2026-041",
                title="Borescope Inspection — Cyl #1 - #4 Valves",
                subsystem="Thermal & Combustion",
                priority="MEDIUM",
                advisory_text="Perform optical borescope inspection of exhaust valve seats at next turnaround.",
                evidence_triggers=["CBM+ predictive schedule trigger", "TTSN 1,216 flight hours milestone"],
                status="OPEN",
                created_at=iso_now,
                assigned_tech="Powertrain Bay 2",
                easa_part_m_ref="M.A.401 / SB-915-021"
            ),
            MaintenanceTask(
                id="TSK-402",
                task_order="WO-2026-042",
                title="Cylinder #3 Injector Ultrasonic Flush & Flow Check",
                subsystem="Fuel & Metering",
                priority="CRITICAL",
                advisory_text="Micro-orifice nozzle coking detected. Flow variation +2.7% (+0.50 L/h). Flush or replace injector S/N INJ-084.",
                evidence_triggers=["Fuel flow deviation +0.50 L/h", "EGT Cyl #3 residual +18.0°C"],
                status="OPEN",
                created_at=iso_now,
                assigned_tech="Avionics Bay 1 - Tech Lead",
                easa_part_m_ref="Rotax MM Ch. 73-10-00"
            ),
            MaintenanceTask(
                id="TSK-403",
                task_order="WO-2026-039",
                title="Turbocharger Wastegate Linkage Torque Check",
                subsystem="Propulsion Core",
                priority="LOW",
                advisory_text="Verify electronic wastegate spindle axial clearance (0.35mm nominal). Retorque pivot linkage.",
                evidence_triggers=["Depot cycle 1,842h milestone", "Scheduled interval inspection"],
                status="COMPLETED",
                created_at=iso_now,
                assigned_tech="Flight Line Team Alpha",
                easa_part_m_ref="SB-915-018"
            ),
            MaintenanceTask(
                id="TSK-404",
                task_order="WO-2026-038",
                title="SOAP Spectrometric Oil Sample Pull",
                subsystem="Lubrication & Gearbox",
                priority="MEDIUM",
                advisory_text="Extract 100ml gearbox lubricant for ICP-OES elemental wear analysis (Fe, Cu, Al ppm).",
                evidence_triggers=["Routine 50h turnaround inspection", "Oil filter change window"],
                status="COMPLETED",
                created_at=iso_now,
                assigned_tech="Spectro Lab Field Unit",
                easa_part_m_ref="M.A.401 / EASA-CS-E"
            )
        ]

@router.get("/maintenance", response_model=List[MaintenanceTask])
async def list_maintenance_tasks(
    status: Optional[str] = Query(None, description="Filter by status: OPEN, IN_PROGRESS, COMPLETED"),
    subsystem: Optional[str] = Query(None, description="Filter by subsystem"),
    priority: Optional[str] = Query(None, description="Filter by priority: CRITICAL, HIGH, MEDIUM, LOW")
):
    """List predictive maintenance advisories and active work orders with optional filtering."""
    _ensure_initial_tasks()
    tasks = list(state_service.maintenance_tasks)
    if status and status.upper() != "ALL":
        tasks = [t for t in tasks if t.status.upper() == status.upper()]
    if subsystem and subsystem.upper() != "ALL":
        tasks = [t for t in tasks if subsystem.lower() in t.subsystem.lower()]
    if priority and priority.upper() != "ALL":
        tasks = [t for t in tasks if t.priority.upper() == priority.upper()]
    return tasks

@router.get("/maintenance/summary")
async def get_maintenance_summary():
    """Retrieve maintenance KPI metrics, equipment risk breakdown, and timeline."""
    _ensure_initial_tasks()
    all_tasks = state_service.maintenance_tasks
    total = len(all_tasks)
    overdue = sum(1 for t in all_tasks if t.status == "OPEN" and t.priority in ["CRITICAL", "HIGH"])
    upcoming = sum(1 for t in all_tasks if t.status in ["OPEN", "IN_PROGRESS"])
    critical = sum(1 for t in all_tasks if t.priority == "CRITICAL" and t.status != "COMPLETED")
    
    risk_matrix = [
        {"subsystem": "Fuel & Metering", "risk_level": "CRITICAL", "health_score": 84, "component": "Cylinder #3 Injector", "action": "Turnaround Flush"},
        {"subsystem": "Thermal & Combustion", "risk_level": "HIGH", "health_score": 88, "component": "Exhaust Valves Cyl 1-4", "action": "Borescope Inspection"},
        {"subsystem": "Propulsion Core", "risk_level": "NOMINAL", "health_score": 94, "component": "Turbo Wastegate Actuator", "action": "Torque Check 1,950h"},
        {"subsystem": "Lubrication & Gearbox", "risk_level": "NOMINAL", "health_score": 96, "component": "Slipper Clutch & Oil Pump", "action": "SOAP Sample 50h"},
        {"subsystem": "Avionics & FADEC", "risk_level": "NOMINAL", "health_score": 99, "component": "Dual Lane ECU & CAN A/B", "action": "Continuous BIT"}
    ]

    timeline_events = [
        {"id": "EVT-01", "stage": "Turnaround 14", "timeframe": "Today (Immediate)", "hours": "1,842.6 h", "tasks": 2, "status": "ACTION_REQUIRED"},
        {"id": "EVT-02", "stage": "Turnaround 15", "timeframe": "+50 Flight Hours", "hours": "1,892.6 h", "tasks": 1, "status": "SCHEDULED"},
        {"id": "EVT-03", "stage": "Turnaround 16", "timeframe": "+100 Flight Hours", "hours": "1,942.6 h", "tasks": 2, "status": "SCHEDULED"},
        {"id": "EVT-04", "stage": "Depot Overhaul", "timeframe": "+158 Flight Hours", "hours": "2,000.0 h", "tasks": 4, "status": "PLANNING"}
    ]

    return {
        "total_tasks": total,
        "overdue_work_orders": overdue,
        "upcoming_maintenance": upcoming,
        "critical_alerts": critical,
        "propulsion_health": 92,
        "mtbur_hours": 4120,
        "risk_matrix": risk_matrix,
        "timeline_events": timeline_events
    }

@router.get("/maintenance/export")
async def export_maintenance_csv():
    """Export all maintenance work orders as a downloadable CSV."""
    _ensure_initial_tasks()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Work Order", "Title", "Subsystem", "Priority", "Status", "Assigned Tech", "EASA Part-M Ref", "Created At", "Advisory Text"])
    
    for t in state_service.maintenance_tasks:
        writer.writerow([
            t.id, t.task_order, t.title, t.subsystem, t.priority, t.status,
            t.assigned_tech or "Unassigned", t.easa_part_m_ref, t.created_at, t.advisory_text
        ])
    
    csv_content = output.getvalue()
    filename = f"AeroTwin_Maintenance_Report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/maintenance/{task_id}", response_model=MaintenanceTask)
async def get_maintenance_task(task_id: str):
    """Retrieve details of a single maintenance task."""
    _ensure_initial_tasks()
    for task in state_service.maintenance_tasks:
        if task.id == task_id or task.task_order == task_id:
            return task
    raise HTTPException(status_code=404, detail="Maintenance task not found")

@router.post("/maintenance", response_model=MaintenanceTask)
async def create_maintenance_task(data: CreateMaintenanceTaskRequest):
    """Create a new maintenance task or work order with validation."""
    _ensure_initial_tasks()
    iso_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_task = MaintenanceTask(
        id=f"TSK-{uuid.uuid4().hex[:6].upper()}",
        task_order=f"WO-2026-{len(state_service.maintenance_tasks) + 101}",
        title=data.title.strip(),
        subsystem=data.subsystem.strip(),
        priority=data.priority.upper(),
        advisory_text=data.advisory_text.strip(),
        evidence_triggers=data.evidence_triggers or ["Operator created work order"],
        status="OPEN",
        created_at=iso_now,
        assigned_tech=data.assigned_tech or "MALE Flight Line Team",
        easa_part_m_ref=data.easa_part_m_ref or "M.A.401"
    )
    state_service.maintenance_tasks.insert(0, new_task)
    return new_task

@router.put("/maintenance/{task_id}", response_model=MaintenanceTask)
async def update_maintenance_task(task_id: str, data: UpdateMaintenanceTaskRequest):
    """Update details of an existing maintenance work order."""
    _ensure_initial_tasks()
    for task in state_service.maintenance_tasks:
        if task.id == task_id or task.task_order == task_id:
            if data.title is not None:
                task.title = data.title.strip()
            if data.subsystem is not None:
                task.subsystem = data.subsystem.strip()
            if data.priority is not None:
                task.priority = data.priority.upper()
            if data.status is not None:
                task.status = data.status.upper()
            if data.assigned_tech is not None:
                task.assigned_tech = data.assigned_tech.strip()
            if data.advisory_text is not None:
                task.advisory_text = data.advisory_text.strip()
            if data.easa_part_m_ref is not None:
                task.easa_part_m_ref = data.easa_part_m_ref.strip()
            return task
    raise HTTPException(status_code=404, detail="Maintenance task not found")

@router.post("/maintenance/{task_id}/assign", response_model=MaintenanceTask)
async def assign_maintenance_technician(task_id: str, data: AssignTechRequest):
    """Assign or reassign a technician to an existing maintenance task."""
    _ensure_initial_tasks()
    for task in state_service.maintenance_tasks:
        if task.id == task_id or task.task_order == task_id:
            task.assigned_tech = data.assigned_tech.strip()
            if task.status == "OPEN":
                task.status = "IN_PROGRESS"
            return task
    raise HTTPException(status_code=404, detail="Maintenance task not found")

@router.post("/maintenance/{task_id}/status", response_model=MaintenanceTask)
async def update_maintenance_status(task_id: str, data: UpdateStatusRequest):
    """Update work order lifecycle status (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)."""
    _ensure_initial_tasks()
    valid_statuses = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
    status_upper = data.status.upper()
    if status_upper not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
    for task in state_service.maintenance_tasks:
        if task.id == task_id or task.task_order == task_id:
            task.status = status_upper
            return task
    raise HTTPException(status_code=404, detail="Maintenance task not found")

@router.post("/maintenance/{task_id}/complete", response_model=MaintenanceTask)
async def complete_maintenance_task(task_id: str):
    """Mark an existing maintenance work order as completed."""
    _ensure_initial_tasks()
    for task in state_service.maintenance_tasks:
        if task.id == task_id or task.task_order == task_id:
            task.status = "COMPLETED"
            return task
    raise HTTPException(status_code=404, detail="Maintenance task not found")

@router.delete("/maintenance/{task_id}")
async def delete_maintenance_task(task_id: str):
    """Delete a maintenance task from the system."""
    _ensure_initial_tasks()
    for idx, task in enumerate(state_service.maintenance_tasks):
        if task.id == task_id or task.task_order == task_id:
            deleted = state_service.maintenance_tasks.pop(idx)
            return {"status": "SUCCESS", "message": f"Task {deleted.task_order} deleted successfully.", "deleted_id": deleted.id}
    raise HTTPException(status_code=404, detail="Maintenance task not found")
