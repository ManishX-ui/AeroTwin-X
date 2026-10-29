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
    observability_status: str = "FULL_OBSERVABILITY"  # FULL_OBSERVABILITY, DEGRADED_OBSERVABILITY, UNAVAILABLE
    is_observable: bool = True  # Explicit availability indicator (Concern B: separates unobservable from zero health)
    health_status: str = "VALID_NUMERICAL_ESTIMATE"  # VALID_NUMERICAL_ESTIMATE, DEGRADED_PARTIAL_OBSERVABILITY, UNAVAILABLE_INSUFFICIENT_TELEMETRY, CRITICAL_FAULT_DETECTED
    subsystem_observability: Dict[str, str] = Field(default_factory=dict)
    missing_channels: List[str] = Field(default_factory=list)
    data_quality_issues: List[str] = Field(default_factory=list)
    status_message: str = "Subsystem health successfully evaluated from verified sensor observations."

# Type alias for backward compatibility
EngineHealthPrediction = SubsystemHealth


class ChannelQualityReport(BaseModel):
    channel_name: str
    freshness_status: str = "PRESENT_AND_VALID"  # PRESENT_AND_VALID, MISSING, INVALID, STALE, OFFLINE
    is_frozen: bool = False
    frozen_reason: Optional[str] = None
    drift_status: str = "NOMINAL"  # NOMINAL, TRANSIENT_SPIKE, SUSPECTED_DRIFT, PERSISTENT_BIAS
    drift_bias: float = 0.0
    drift_slope_per_sec: float = 0.0
    last_valid_timestamp: Optional[str] = None
    time_since_valid_sec: Optional[float] = None
    is_operating_fallback: bool = False


class DataQualityAssessment(BaseModel):
    overall_quality: str = "HEALTHY"  # HEALTHY, DEGRADED, CRITICAL, OFFLINE
    freshness_summary: Dict[str, str] = Field(default_factory=dict)
    frozen_channels: List[str] = Field(default_factory=list)
    drifting_channels: List[str] = Field(default_factory=list)
    stale_channels: List[str] = Field(default_factory=list)
    invalid_channels: List[str] = Field(default_factory=list)
    missing_channels: List[str] = Field(default_factory=list)
    operating_condition_fallbacks: List[str] = Field(default_factory=list)
    channel_reports: Dict[str, ChannelQualityReport] = Field(default_factory=dict)
    assessment_timestamp: str = ""


class RULPrediction(BaseModel):
    tbo_countdown_hours: float = 1284.0
    rul_hours: float = 1284.0  # Backward-compatible alias for tbo_countdown_hours
    confidence: Optional[float] = None  # None: not calibrated
    confidence_status: str = "NOT_CALIBRATED"  # NOT_CALIBRATED, HEURISTIC_ESTIMATE, STATISTICAL_CONFIDENCE, INVALID_INPUT
    estimate_method: str = "TBO_COUNTDOWN"  # TBO_COUNTDOWN, PARAMETRIC_SURVIVAL, WEIBULL_HAZARD
    degradation_trend: str = "NOMINAL_LINEAR"  # NOMINAL_LINEAR, ACCELERATING_THERMAL_WEAR, etc.
    tbo_limit_hours: float = 2500.0
    current_ttsn_hours: float = 1216.0
    estimated_wear_pct: float = 48.6
    is_valid: bool = True
    status_message: str = "Configured TBO interval countdown (heuristic adjustment; uncalibrated)"

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
    data_quality: Optional[DataQualityAssessment] = None

