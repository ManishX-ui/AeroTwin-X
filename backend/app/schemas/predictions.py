"""AI / ML Prediction & Health Schemas."""
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class AnomalyPrediction(BaseModel):
    anomaly_score: float # 0.0 to 1.0
    anomaly_status: str # NORMAL, ELEVATED, ANOMALOUS
    threshold: float = 0.35
    is_anomaly: bool = False

class FaultPrediction(BaseModel):
    fault: str # NORMAL, OVERHEATING, VIBRATION_ANOMALY, LUBRICATION_ISSUE, etc.
    probability: float # 0.0 to 1.0
    confidence: float # 0.0 to 100.0%
    model_name: str = "XGBoost Classifier / Ensemble"
    model_version: str = "v1.2-edge"

class SubsystemHealth(BaseModel):
    engine_health: float = 95.0
    thermal_health: float = 96.0
    lubrication_health: float = 98.0
    combustion_health: float = 94.0
    vibration_health: float = 97.0
    electrical_health: float = 99.0

class RULPrediction(BaseModel):
    rul_hours: float = 1284.0
    confidence: float = 94.2
    degradation_trend: str = "NOMINAL_LINEAR" # NOMINAL_LINEAR, ACCELERATING, SEVERE
    tbo_limit_hours: float = 2500.0
    estimated_wear_pct: float = 48.6

class ExplainabilityItem(BaseModel):
    feature: str
    impact: str # "+ Positive", "- Negative"
    contribution: float
    description: str

class AIPredictionSummary(BaseModel):
    timestamp: str
    anomaly: AnomalyPrediction
    fault: FaultPrediction
    health: SubsystemHealth
    rul: RULPrediction
    evidence: List[str]
    feature_attributions: List[ExplainabilityItem]
    root_cause_explanation: str
