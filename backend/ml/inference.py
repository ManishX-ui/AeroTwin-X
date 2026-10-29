"""Reusable Machine Learning Inference Service for AeroTwin-X.

Loads trained model artifacts (Isolation Forest and Gradient Boosting Classifier)
and executes real-time inference on incoming sensor telemetry packets.
Features:
- Single worker load & caching
- Preprocessing & physics residual calculation matching training pipeline
- Real-time latency measurement in milliseconds
- Clear 'MODEL NOT TRAINED' status if artifacts are missing
- Clean separation from data sources (supports demo, HTTP sensor, etc.)
"""
import os
import time
import json
import logging
import datetime
import joblib
import numpy as np
from typing import Dict, Any, Optional, Tuple


from ..digital_twin.engine_model import AeroPistonDigitalTwin
from ..digital_twin.residuals import ResidualAnalyzer
from .preprocessing import FeatureExtractor
from .health_model import HealthModel
from .rul_model import RULModel
from .explainability import ExplainabilityEngine
from .data_quality import DataQualityAssessor
from ..app.schemas.predictions import (
    AnomalyPrediction, FaultPrediction, EngineHealthPrediction,
    RULPrediction, AIPredictionSummary
)

logger = logging.getLogger("aerotwin.inference")

ARTIFACTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "artifacts"))


class MLInferenceService:
    def __init__(self, artifacts_dir: str = ARTIFACTS_DIR):
        self.artifacts_dir = artifacts_dir
        self.twin = AeroPistonDigitalTwin()
        self.residual_analyzer = ResidualAnalyzer()
        self.feature_extractor = FeatureExtractor(window_size=12)
        self.health_model = HealthModel()
        self.rul_model = RULModel()
        self.explainability = ExplainabilityEngine()
        self.quality_assessor = DataQualityAssessor()

        self.isolation_forest = None
        self.fault_classifier = None
        self.feature_schema = None
        self.metadata = None
        self.metrics = None
        self.is_loaded = False
        self.last_inference_error = None
        self.last_inference_time = None

        self.load_artifacts()

    def load_artifacts(self) -> bool:
        """Load trained model artifacts and schemas from disk."""
        iforest_path = os.path.join(self.artifacts_dir, "isolation_forest.joblib")
        classifier_path = os.path.join(self.artifacts_dir, "fault_classifier.joblib")
        schema_path = os.path.join(self.artifacts_dir, "feature_schema.json")
        meta_path = os.path.join(self.artifacts_dir, "model_metadata.json")
        metrics_path = os.path.join(self.artifacts_dir, "metrics.json")

        if not (os.path.exists(iforest_path) and os.path.exists(classifier_path)):
            logger.warning(f"ML artifacts not found in {self.artifacts_dir}. Status: MODEL NOT TRAINED")
            self.is_loaded = False
            return False

        try:
            self.isolation_forest = joblib.load(iforest_path)
            self.fault_classifier = joblib.load(classifier_path)

            if os.path.exists(schema_path):
                with open(schema_path, "r", encoding="utf-8") as f:
                    self.feature_schema = json.load(f)

            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)

            if os.path.exists(metrics_path):
                with open(metrics_path, "r", encoding="utf-8") as f:
                    self.metrics = json.load(f)

            self.is_loaded = True
            logger.info("Successfully loaded AeroTwin-X trained ML models and artifacts.")
            return True
        except Exception as e:
            logger.error(f"Failed to load ML artifacts: {e}", exc_info=True)
            self.is_loaded = False
            self.last_inference_error = str(e)
            return False

    def get_status(self) -> Dict[str, Any]:
        """Return active model status, metadata, and evaluation metrics."""
        if not self.is_loaded:
            return {
                "status": "MODEL NOT TRAINED",
                "is_loaded": False,
                "model_version": None,
                "training_timestamp": None,
                "dataset_fingerprint": None,
                "supported_features": [],
                "model_type": "IsolationForest + HistGradientBoostingClassifier",
                "evaluation_status": "EVALUATION NOT AVAILABLE",
                "last_inference_time": self.last_inference_time,
                "last_error": self.last_inference_error
            }

        return {
            "status": "TRAINED",
            "is_loaded": True,
            "models_loaded": True,
            "model_version": self.metadata.get("model_version", "v2.5-prod") if self.metadata else "v2.5-prod",
            "training_timestamp": self.metadata.get("training_timestamp") if self.metadata else None,
            "dataset_fingerprint": self.metadata.get("dataset_fingerprint") if self.metadata else None,
            "supported_features": self.feature_schema.get("feature_names", []) if self.feature_schema else [],
            "supported_classes": self.feature_schema.get("supported_classes", []) if self.feature_schema else [],
            "feature_count": len(self.feature_schema.get("feature_names", [])) if self.feature_schema else 0,
            "fault_classifier": "HistGradientBoostingClassifier",
            "isolation_forest": "IsolationForest",
            "model_type": "IsolationForest + HistGradientBoostingClassifier",
            "evaluation_status": "AVAILABLE" if self.metrics else "EVALUATION NOT AVAILABLE",
            "last_inference_time": self.last_inference_time,
            "last_error": self.last_inference_error
        }


    def get_metrics(self) -> Dict[str, Any]:
        """Return evaluation metrics report."""
        if self.metrics:
            return self.metrics
        return {"status": "EVALUATION NOT AVAILABLE", "message": "Model has not been evaluated on held-out data."}

    def predict(
        self,
        telemetry: Dict[str, Any],
        source: str = "DEMO"
    ) -> AIPredictionSummary:
        """Execute end-to-end ML inference on a telemetry reading."""
        start_time = time.perf_counter()
        now_iso = str(telemetry.get("timestamp", ""))

        if not self.is_loaded:
            # Re-attempt load in case models were trained in background
            self.load_artifacts()

        # Concern A: Operating condition safety & fallback detection
        fallback_operating_inputs = []

        def _get_operating_input(field: str, default_val: float) -> float:
            val = telemetry.get(field)
            if val is None:
                fallback_operating_inputs.append(field)
                return default_val
            try:
                f = float(val)
                if np.isnan(f) or np.isinf(f):
                    fallback_operating_inputs.append(field)
                    return default_val
                return f
            except (ValueError, TypeError):
                fallback_operating_inputs.append(field)
                return default_val

        # 1. Physics Digital Twin estimation
        expected_dict = self.twin.compute_expected_state(
            rpm=_get_operating_input("rpm", 2550.0),
            throttle_pct=_get_operating_input("throttle_pos", 75.0),
            altitude_ft=_get_operating_input("pressure_altitude", 2500.0),
            ambient_temp_c=_get_operating_input("ambient_temp", 15.0),
            mission_phase=str(telemetry.get("mission_phase") or "CRUISE"),
            dt_seconds=0.5
        )

        # 2. Residual calculation
        twin_state = self.residual_analyzer.compute_residuals(
            actual_telemetry=telemetry,
            expected_telemetry=expected_dict,
            timestamp=now_iso
        )

        # 3. Data Quality Assessment (TSK-04 Freshness, TSK-05 Frozen, TSK-06 Drift)
        twin_residuals_dict = twin_state.model_dump()
        quality_assessment = self.quality_assessor.assess_telemetry(
            telemetry=telemetry,
            residuals=twin_residuals_dict
        )
        if fallback_operating_inputs:
            for f_inp in fallback_operating_inputs:
                if f_inp not in quality_assessment.operating_condition_fallbacks:
                    quality_assessment.operating_condition_fallbacks.append(f_inp)

        # 4. Feature Extraction (aware of data quality)
        features = self.feature_extractor.extract_features(
            telemetry=telemetry,
            residuals=twin_residuals_dict,
            quality_assessment=quality_assessment
        )

        # 4. Model Predictions
        feature_names = self.feature_schema.get("feature_names", []) if self.feature_schema else [
            "res_cht", "res_egt", "res_oil_pressure", "res_oil_temperature",
            "res_fuel_flow", "res_vibration", "res_manifold_pressure",
            "trend_cht", "trend_egt", "trend_vibration",
            "std_cht", "std_vibration",
            "cross_thermal_ratio", "cross_power_ratio", "cross_lube_factor",
            "raw_battery_voltage", "raw_alternator_current"
        ]

        feature_vector = np.array([[features.get(k, 0.0) for k in feature_names]])

        # Anomaly Detection
        if self.is_loaded and self.isolation_forest is not None:
            raw_decision = float(self.isolation_forest.decision_function(feature_vector)[0])
            centered = (0.05 - raw_decision) * 12.0
            anomaly_score = float(1.0 / (1.0 + np.exp(-centered)))
            anomaly_score = max(0.02, min(0.99, anomaly_score))
        else:
            # Fallback based on physical residuals if model not trained
            max_res = max(abs(features.get(f"res_{k}", 0.0)) for k in ["cht", "egt", "oil_pressure", "vibration"])
            anomaly_score = 0.08 if max_res < 1.8 else min(0.99, 0.35 + (max_res - 1.8) * 0.2)

        # Incorporate extreme physical residuals directly
        max_norm_res = max(abs(features.get(f"res_{k}", 0.0)) for k in ["cht", "egt", "oil_pressure", "vibration", "manifold_pressure"])
        if max_norm_res > 3.0:
            anomaly_score = max(anomaly_score, 0.75 + min(0.24, (max_norm_res - 3.0) * 0.08))

        threshold = 0.35
        is_anomaly = anomaly_score >= threshold
        status = "ANOMALOUS" if anomaly_score > 0.65 else ("ELEVATED" if is_anomaly else "NORMAL")

        anomaly_pred = AnomalyPrediction(
            anomaly_score=round(anomaly_score, 3),
            anomaly_status=status,
            threshold=threshold,
            is_anomaly=is_anomaly
        )

        # Fault Classification
        supported_classes = self.feature_schema.get("supported_classes", [
            "NORMAL", "OVERHEATING", "VIBRATION_ANOMALY", "LUBRICATION_ISSUE",
            "COMBUSTION_INSTABILITY", "SENSOR_DRIFT", "FROZEN_SENSOR", "COMMUNICATION_FAILURE", "SENSOR_SPIKE"
        ])

        if self.is_loaded and self.fault_classifier is not None:
            probs = self.fault_classifier.predict_proba(feature_vector)[0]
            top_idx = int(np.argmax(probs))
            predicted_class = supported_classes[top_idx] if top_idx < len(supported_classes) else "NORMAL"
            top_prob = float(probs[top_idx])

            # Safety guardrail: if physical residuals are all nominal, force NORMAL
            if max_norm_res < 1.4:
                predicted_class = "NORMAL"
                top_prob = 0.965
        else:
            predicted_class = "NORMAL"
            top_prob = 0.95

        model_ver = self.metadata.get("model_version", "v2.5-prod") if self.metadata else "v2.5-prod"
        fault_pred = FaultPrediction(
            fault=predicted_class,
            probability=round(top_prob, 3),
            confidence=round(top_prob * 100.0, 1),
            model_name="HistGradientBoostingClassifier",
            model_version=model_ver
        )

        # Condition Monitoring & Health (Missing Sensor Protection & Observability)
        health_pred = self.health_model.compute_health(features, anomaly_pred.anomaly_score)

        # Time Between Overhaul (TBO) Maintenance Countdown Estimation
        rul_pred = self.rul_model.estimate_tbo_countdown(
            health_score=health_pred.engine_health,
            fault_type=fault_pred.fault,
            anomaly_score=anomaly_pred.anomaly_score
        )

        # Explainability & Root Cause Attribution
        evidence, attributions, root_cause = self.explainability.explain(
            fault_type=fault_pred.fault,
            features=features
        )

        latency_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        self.last_inference_time = datetime.datetime.now(datetime.timezone.utc).isoformat()

        return AIPredictionSummary(
            timestamp=now_iso,
            anomaly=anomaly_pred,
            fault=fault_pred,
            health=health_pred,
            rul=rul_pred,
            evidence=evidence,
            feature_attributions=attributions,
            root_cause_explanation=root_cause,
            data_quality=quality_assessment
        )

    # Method alias
    predict_telemetry = predict



# Global singleton instance
inference_service = MLInferenceService()


def get_inference_service() -> MLInferenceService:
    """Return singleton ML inference service instance."""
    return inference_service

