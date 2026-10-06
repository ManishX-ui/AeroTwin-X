"""Alerts & Maintenance Advisory Schemas."""
from pydantic import BaseModel, Field
from typing import List, Optional

class AlertItem(BaseModel):
    id: str
    timestamp: str
    engine_id: str = "AE-03"
    severity: str # CRITICAL, WARNING, INFORMATION
    title: str
    description: str
    evidence: List[str]
    acknowledged: bool = False
    source: str = "AI_FAULT_DETECTION"

class MaintenanceTask(BaseModel):
    id: str
    task_order: str
    title: str
    subsystem: str # Thermal, Lubrication, Combustion, Gearbox, Electrical
    priority: str # CRITICAL, HIGH, MEDIUM, LOW
    advisory_text: str
    evidence_triggers: List[str]
    status: str = "OPEN" # OPEN, IN_PROGRESS, CLOSED
    created_at: str
    assigned_tech: Optional[str] = "Avionics / Powertrain Bay"
    easa_part_m_ref: str = "M.A.401 / SB-915-021"

class AlertAckRequest(BaseModel):
    acknowledged_by: str = "Flight Engineer"
