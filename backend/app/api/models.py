"""Model Management and Edge AI Registry API Endpoints."""
from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter()

MODEL_REGISTRY = [
    {
        "id": "MOD-ANOM-01",
        "name": "Residual Anomaly Detector",
        "model_type": "Isolation Forest (Ensemble)",
        "version": "v1.2-edge",
        "training_date": "2026-09-15",
        "metrics": {
            "roc_auc": 0.984,
            "f1_score": 0.962,
            "latency_ms": 1.4,
            "false_positive_rate": "0.4%"
        },
        "features_count": 10,
        "status": "ACTIVE",
        "description": "Multi-dimensional residual density isolation across continuous flight regimes."
    },
    {
        "id": "MOD-FLT-02",
        "name": "Propulsion Fault Classifier",
        "model_type": "Gradient Boosted Multi-Class Tree",
        "version": "v2.1-aerotwin",
        "training_date": "2026-09-22",
        "metrics": {
            "accuracy": 0.978,
            "macro_f1": 0.971,
            "latency_ms": 3.2,
            "supported_classes": 10
        },
        "features_count": 12,
        "status": "ACTIVE",
        "description": "Classifies thermal runaway, misfire, injector blockages, and lube pressure collapse."
    },
    {
        "id": "MOD-RUL-03",
        "name": "Weibull Degradation & RUL Estimator",
        "model_type": "Nonlinear Physical Wear Regression",
        "version": "v1.0-certified",
        "training_date": "2026-08-30",
        "metrics": {
            "rmse_hours": 18.5,
            "mape": "3.1%",
            "confidence_band": "90% Interval"
        },
        "features_count": 6,
        "status": "ACTIVE",
        "description": "Forecasts remaining flight hours to TBO overhaul under cumulative thermomechanical fatigue."
    },
    {
        "id": "MOD-TWIN-04",
        "name": "Aero-Piston Physics-Informed Digital Twin",
        "model_type": "1st-Order Aerothermodynamic Lumped Parameter",
        "version": "v2.4-rotax",
        "training_date": "2026-08-01",
        "metrics": {
            "correlation": "99.7%",
            "max_steady_err": "1.2°C",
            "solver": "Realtime ODE / Euler / RK4"
        },
        "features_count": 8,
        "status": "ACTIVE",
        "description": "Calculates real-time expected steady-state thermodynamic response across atmospheric pressure altitudes."
    }
]

@router.get("/models")
async def list_models():
    """Retrieve edge model registry and verification metrics."""
    return MODEL_REGISTRY
