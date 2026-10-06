"""Digital Twin Schemas."""
from pydantic import BaseModel, Field
from typing import Dict, Any

class ChannelResidual(BaseModel):
    actual: float
    expected: float
    residual: float
    normalized_residual: float # residual / expected_scale
    unit: str
    status: str = "NORMAL" # NORMAL, WARNING, CRITICAL

class DigitalTwinState(BaseModel):
    timestamp: str
    twin_sync_percent: float = 99.7
    overall_divergence: float = 0.04
    channels: Dict[str, ChannelResidual]
    model_mode: str = "PHYSICS_INFORMED_POLYNOMIAL_MAP"
