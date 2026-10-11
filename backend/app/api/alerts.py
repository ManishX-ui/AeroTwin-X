"""Alerts Management API Endpoints.

Provides PostgreSQL persistence for system alerts and fault anomaly records.
"""
import datetime
import json
from fastapi import APIRouter, HTTPException, Path, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ...database.connection import get_db, is_db_configured
from ...database.models import AlertRecord
from ..schemas.alerts import AlertItem, AlertAckRequest
from ..services.state_service import state_service

router = APIRouter()


def _db_to_alert_item(rec: AlertRecord) -> AlertItem:
    evidence_list = []
    if rec.evidence:
        try:
            evidence_list = json.loads(rec.evidence)
        except Exception:
            evidence_list = [rec.evidence]

    return AlertItem(
        id=rec.id,
        timestamp=rec.created_at.isoformat() if rec.created_at else datetime.datetime.now(datetime.timezone.utc).isoformat(),
        engine_id=rec.engine_id or "AE-03",
        severity=rec.severity,
        title=rec.title,
        description=rec.description or "",
        evidence=evidence_list,
        acknowledged=rec.acknowledged
    )


@router.get("/alerts", response_model=List[AlertItem], tags=["Alerts"])
async def list_alerts(
    severity: Optional[str] = Query(None, description="CRITICAL, WARNING, INFO, INFORMATION"),
    acknowledged: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """List system alerts from PostgreSQL sorted by urgency."""
    query = db.query(AlertRecord)

    if severity and severity.upper() != "ALL":
        query = query.filter(AlertRecord.severity == severity.upper())

    if acknowledged is not None:
        query = query.filter(AlertRecord.acknowledged == acknowledged)

    records = query.order_by(AlertRecord.created_at.desc()).limit(limit).all()
    if not records and not severity and acknowledged is None:
        if state_service.alerts:
            for item in state_service.alerts:
                rec = AlertRecord(
                    id=item.id,
                    engine_id=item.engine_id,
                    severity=item.severity,
                    title=item.title,
                    description=item.description,
                    evidence=json.dumps(item.evidence) if isinstance(item.evidence, list) else item.evidence,
                    acknowledged=item.acknowledged,
                    created_at=datetime.datetime.now(datetime.timezone.utc),
                    updated_at=datetime.datetime.now(datetime.timezone.utc)
                )
                db.add(rec)
            db.commit()
            records = query.order_by(AlertRecord.created_at.desc()).limit(limit).all()

    return [_db_to_alert_item(r) for r in records]


@router.post("/alerts/{alert_id}/ack", tags=["Alerts"])
async def acknowledge_alert(
    alert_id: str = Path(...),
    db: Session = Depends(get_db)
):
    """Acknowledge an alert and persist acknowledgment to PostgreSQL."""
    rec = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Alert ID not found")

    rec.acknowledged = True
    rec.acknowledged_at = datetime.datetime.now(datetime.timezone.utc)
    rec.acknowledged_by = "Flight Systems Operator"
    rec.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    # Also update state_service in-memory copy if present
    state_service.acknowledge_alert(alert_id)

    return {"status": "SUCCESS", "alert_id": alert_id, "acknowledged": True}
