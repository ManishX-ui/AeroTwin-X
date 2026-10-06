"""Predictions API Endpoints."""
from fastapi import APIRouter
from typing import Dict, Any
from ..services.state_service import state_service

router = APIRouter()

@router.get("/predictions")
async def get_all_predictions():
    """Get active prediction summary."""
    if state_service.latest_prediction:
        return state_service.latest_prediction.model_dump()
    return {}
