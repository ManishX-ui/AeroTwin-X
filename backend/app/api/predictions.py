"""Predictions API Endpoints.

Retrieves current live ML predictions and queries historical AI prediction logs
from PostgreSQL (model version, predicted class, anomaly score, confidence, RUL, root cause).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import json

from ...database.connection import get_db, is_db_configured
from ...database.models import AIPredictionRecord
from ..services.state_service import state_service

router = APIRouter()


@router.get("/predictions")
async def get_all_predictions():
    """Get active prediction summary from current live telemetry frame."""
    if state_service.latest_prediction:
        return state_service.latest_prediction.model_dump()
    return {}


@router.get("/predictions/history", tags=["Predictions"])
async def get_predictions_history(
    asset_id: Optional[str] = Query(None, description="Filter by asset tail/ID"),
    predicted_class: Optional[str] = Query(None, description="Filter by fault class e.g. NORMAL, INJECTOR_CLOGGING"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Retrieve historical AI predictions and explainability logs from PostgreSQL."""
    query = db.query(AIPredictionRecord)

    if asset_id:
        query = query.filter(AIPredictionRecord.asset_id == asset_id.strip().upper())

    if predicted_class and predicted_class.upper() != "ALL":
        query = query.filter(AIPredictionRecord.predicted_class == predicted_class.upper())

    records = query.order_by(AIPredictionRecord.timestamp.desc()).limit(limit).all()

    results = []
    for r in records:
        features = {}
        if r.supporting_features:
            try:
                features = json.loads(r.supporting_features)
            except Exception:
                pass

        results.append({
            "id": r.id,
            "asset_id": r.asset_id,
            "engine_id": r.engine_id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "model_identifier": r.model_identifier,
            "model_version": r.model_version,
            "predicted_class": r.predicted_class,
            "confidence": r.confidence,
            "anomaly_score": r.anomaly_score,
            "health_index": r.health_index,
            "rul_hours": r.rul_hours,
            "root_cause_explanation": r.root_cause_explanation,
            "latency_ms": r.latency_ms,
            "supporting_features": features
        })

    return results
