"""Comprehensive Verification Test Suite for STEP 8 Phase 1:
- TSK-01: Correct RUL/TBO Terminology & Uncalibrated Confidence Handling
- TSK-02: Defensive Input Handling (NaN, Inf, None, negative, malformed)
- TSK-03: Missing Sensor and Data-Quality Protection in Subsystem Health Model
"""
import math
import pytest
from backend.ml.rul_model import RULModel
from backend.ml.health_model import HealthModel
from backend.ml.preprocessing import FeatureExtractor
from backend.app.schemas.predictions import RULPrediction, SubsystemHealth, AIPredictionSummary


# ==============================================================================
# 1. TSK-01: TBO COUNTDOWN & INPUT VALIDATION TESTS
# ==============================================================================

def test_tbo_valid_nominal_countdown():
    """1. Valid inputs return the expected nominal countdown (2500 - 1216 = 1284.0)."""
    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=1216.0)
    assert model.is_config_valid is True
    res = model.estimate_tbo_countdown(health_score=100.0, fault_type="NORMAL", anomaly_score=0.0)

    assert res.is_valid is True
    assert res.tbo_countdown_hours == 1284.0
    assert res.rul_hours == 1284.0  # Backward-compatible alias
    assert res.confidence is None   # No hardcoded confidence percentage
    assert res.confidence_status == "NOT_CALIBRATED"
    assert res.estimate_method == "TBO_COUNTDOWN"
    assert res.degradation_trend == "NOMINAL_LINEAR"
    assert res.current_ttsn_hours == 1216.0
    assert res.tbo_limit_hours == 2500.0


def test_tbo_zero_accumulated_time():
    """2. Zero accumulated operating time (TTSN = 0 -> full TBO remaining)."""
    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=0.0)
    res = model.estimate_tbo_countdown(health_score=100.0, fault_type="NORMAL", anomaly_score=0.0)
    assert res.is_valid is True
    assert res.tbo_countdown_hours == 2500.0
    assert res.rul_hours == 2500.0
    assert res.estimated_wear_pct == 0.0


def test_tbo_countdown_at_maintenance_interval():
    """3. Countdown exactly at the maintenance interval (TTSN = TBO -> 0.0 remaining)."""
    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=2500.0)
    res = model.estimate_tbo_countdown(health_score=100.0, fault_type="NORMAL", anomaly_score=0.0)
    assert res.is_valid is True
    assert res.tbo_countdown_hours == 0.0
    assert res.rul_hours == 0.0
    assert res.estimated_wear_pct == 100.0
    assert res.degradation_trend == "TBO_EXCEEDED"


def test_tbo_operating_time_exceeding_interval():
    """4. Operating time exceeding interval (TTSN > TBO -> 0.0 remaining, overhaul due)."""
    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=2650.0)
    res = model.estimate_tbo_countdown(health_score=95.0, fault_type="NORMAL", anomaly_score=0.05)
    assert res.is_valid is True
    assert res.tbo_countdown_hours == 0.0
    assert res.estimated_wear_pct == 100.0
    assert res.degradation_trend == "TBO_EXCEEDED"


def test_tbo_missing_accumulated_time_none():
    """5. Missing accumulated operating time (None)."""
    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=None)
    assert model.is_config_valid is False
    res = model.estimate_tbo_countdown()
    assert res.is_valid is False
    assert res.confidence_status == "INVALID_INPUT"
    assert res.tbo_countdown_hours == 0.0


def test_tbo_missing_maintenance_interval_none():
    """6. Missing maintenance interval (None)."""
    model = RULModel(tbo_hours=None, current_ttsn_hours=1216.0)
    assert model.is_config_valid is False
    res = model.estimate_tbo_countdown()
    assert res.is_valid is False
    assert res.confidence_status == "INVALID_INPUT"


def test_tbo_runtime_none_inputs():
    """7. Runtime health_score or anomaly_score is None."""
    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=1216.0)
    res_none_health = model.estimate_tbo_countdown(health_score=None)
    assert res_none_health.is_valid is False
    assert res_none_health.confidence_status == "INVALID_INPUT"

    res_none_anom = model.estimate_tbo_countdown(health_score=95.0, anomaly_score=None)
    assert res_none_anom.is_valid is False
    assert res_none_anom.confidence_status == "INVALID_INPUT"


def test_tbo_non_numeric_strings():
    """8. Non-numeric strings passed to constructor or runtime methods."""
    model_bad = RULModel(tbo_hours="invalid_tbo", current_ttsn_hours=1216.0)
    assert model_bad.is_config_valid is False
    res = model_bad.estimate_tbo_countdown()
    assert res.is_valid is False

    model_good = RULModel(tbo_hours=2500.0, current_ttsn_hours=1216.0)
    res_bad_runtime = model_good.estimate_tbo_countdown(health_score="not_a_number")
    assert res_bad_runtime.is_valid is False
    assert res_bad_runtime.confidence_status == "INVALID_INPUT"


def test_tbo_nan_inputs():
    """9. NaN inputs rejected defensively."""
    model_nan = RULModel(tbo_hours=float("nan"), current_ttsn_hours=1216.0)
    assert model_nan.is_config_valid is False

    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=1216.0)
    res_nan = model.estimate_tbo_countdown(health_score=float("nan"))
    assert res_nan.is_valid is False
    assert res_nan.confidence_status == "INVALID_INPUT"


def test_tbo_infinity_inputs():
    """10. Positive and negative infinity rejected defensively."""
    model_inf = RULModel(tbo_hours=float("inf"), current_ttsn_hours=1216.0)
    assert model_inf.is_config_valid is False

    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=1216.0)
    res_pos_inf = model.estimate_tbo_countdown(health_score=float("inf"))
    assert res_pos_inf.is_valid is False

    res_neg_inf = model.estimate_tbo_countdown(anomaly_score=float("-inf"))
    assert res_neg_inf.is_valid is False


def test_tbo_negative_accumulated_time():
    """11. Negative accumulated operating time rejected."""
    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=-100.0)
    assert model.is_config_valid is False
    res = model.estimate_tbo_countdown()
    assert res.is_valid is False
    assert res.tbo_countdown_hours == 0.0


def test_tbo_invalid_maintenance_interval_zero_or_negative():
    """12. Zero or negative maintenance interval rejected."""
    model_zero = RULModel(tbo_hours=0.0, current_ttsn_hours=1216.0)
    assert model_zero.is_config_valid is False

    model_neg = RULModel(tbo_hours=-2500.0, current_ttsn_hours=1216.0)
    assert model_neg.is_config_valid is False


def test_tbo_legacy_alias_estimate_rul():
    """Verify backward compatibility of estimate_rul alias."""
    model = RULModel(tbo_hours=2500.0, current_ttsn_hours=1216.0)
    res = model.estimate_rul(health_score=100.0, fault_type="NORMAL", anomaly_score=0.0)
    assert isinstance(res, RULPrediction)
    assert res.rul_hours == 1284.0
    assert res.tbo_countdown_hours == 1284.0


# ==============================================================================
# 2. TSK-02 & TSK-03: HEALTH MODEL & SENSOR DATA-QUALITY PROTECTION TESTS
# ==============================================================================

def test_health_all_sensors_present_and_valid():
    """1. All required sensors present and valid -> FULL_OBSERVABILITY."""
    extractor = FeatureExtractor()
    health_model = HealthModel()

    telemetry = {
        "rpm": 2550.0, "cht": 108.0, "egt": 725.0,
        "oil_pressure": 4.2, "oil_temperature": 88.0,
        "fuel_flow": 18.2, "vibration": 1.15,
        "battery_voltage": 28.2, "alternator_current": 13.5,
        "manifold_pressure": 31.5
    }
    residuals = {
        "channels": {
            k: {"normalized_residual": 0.02} for k in telemetry.keys()
        }
    }

    feats = extractor.extract_features(telemetry, residuals)
    health = health_model.compute_health(feats, anomaly_score=0.05)

    assert health.observability_status == "FULL_OBSERVABILITY"
    assert len(health.missing_channels) == 0
    assert health.engine_health > 90.0
    assert health.thermal_health > 90.0


def test_health_single_sensor_missing_degraded_observability():
    """2. One required sensor missing (CHT) -> DEGRADED_OBSERVABILITY."""
    extractor = FeatureExtractor()
    health_model = HealthModel()

    telemetry = {
        "rpm": 2550.0, "egt": 725.0,  # 'cht' deliberately omitted
        "oil_pressure": 4.2, "oil_temperature": 88.0,
        "fuel_flow": 18.2, "vibration": 1.15,
        "battery_voltage": 28.2, "alternator_current": 13.5,
        "manifold_pressure": 31.5
    }
    residuals = {
        "channels": {
            k: {"normalized_residual": 0.0} for k in telemetry.keys()
        }
    }

    feats = extractor.extract_features(telemetry, residuals)
    health = health_model.compute_health(feats, anomaly_score=0.05)

    assert health.observability_status == "DEGRADED_OBSERVABILITY"
    assert "cht" in health.missing_channels


def test_health_multiple_sensors_missing():
    """3. Multiple sensors missing (CHT and Oil Pressure) -> DEGRADED_OBSERVABILITY."""
    extractor = FeatureExtractor()
    health_model = HealthModel()

    telemetry = {
        "rpm": 2550.0, "egt": 725.0,
        "oil_temperature": 88.0, "fuel_flow": 18.2,
        "vibration": 1.15, "battery_voltage": 28.2
    }
    feats = extractor.extract_features(telemetry, residuals={})
    health = health_model.compute_health(feats, anomaly_score=0.05)

    assert health.observability_status == "DEGRADED_OBSERVABILITY"
    assert "cht" in health.missing_channels
    assert "oil_pressure" in health.missing_channels


def test_health_all_subsystem_sensors_missing_produces_zero_subsystem_health():
    """4. If both CHT and EGT are missing, thermal health must be 0.0 (NOT 99.0%)."""
    extractor = FeatureExtractor()
    health_model = HealthModel()

    telemetry = {
        "rpm": 2550.0,
        "oil_pressure": 4.2, "oil_temperature": 88.0,
        "fuel_flow": 18.2, "manifold_pressure": 31.5,
        "vibration": 1.15, "battery_voltage": 28.2
        # Both 'cht' and 'egt' missing
    }
    feats = extractor.extract_features(telemetry, residuals={})
    health = health_model.compute_health(feats, anomaly_score=0.05)

    assert health.thermal_health == 0.0  # NOT 99.0%!
    assert "cht" in health.missing_channels
    assert "egt" in health.missing_channels
    assert health.observability_status == "DEGRADED_OBSERVABILITY"


def test_health_completely_missing_telemetry_unavailable():
    """5. Empty or None telemetry produces UNAVAILABLE status with 0.0 health."""
    health_model = HealthModel()

    health_none = health_model.compute_health(features=None)
    assert health_none.observability_status == "UNAVAILABLE"
    assert health_none.engine_health == 0.0

    health_empty = health_model.compute_health(features={})
    assert health_empty.observability_status == "UNAVAILABLE"
    assert health_empty.engine_health == 0.0


def test_health_nan_and_infinite_sensors_detected_as_invalid():
    """6. NaN or Infinite sensor values are flagged as invalid and do not crash."""
    extractor = FeatureExtractor()
    health_model = HealthModel()

    telemetry = {
        "rpm": 2550.0,
        "cht": float("nan"),
        "egt": float("inf"),
        "oil_pressure": 4.2, "oil_temperature": 88.0,
        "fuel_flow": 18.2, "vibration": 1.15,
        "battery_voltage": 28.2
    }
    feats = extractor.extract_features(telemetry, residuals={})
    health = health_model.compute_health(feats, anomaly_score=0.0)

    assert health.observability_status == "DEGRADED_OBSERVABILITY"
    assert "cht" in feats.get("_invalid_channels", [])
    assert "egt" in feats.get("_invalid_channels", [])
    assert health.thermal_health == 0.0


def test_health_missing_measurements_cannot_improve_health():
    """10. Ensure missing measurements cannot improve the health estimate."""
    extractor = FeatureExtractor()
    health_model = HealthModel()

    # Case A: Thermal sensor has a severe anomaly (residual = 4.5σ)
    telem_with_fault = {
        "rpm": 2550.0, "cht": 145.0, "egt": 890.0,
        "oil_pressure": 4.2, "oil_temperature": 88.0,
        "fuel_flow": 18.2, "vibration": 1.15,
        "battery_voltage": 28.2, "manifold_pressure": 31.5
    }
    res_fault = {
        "channels": {
            "cht": {"normalized_residual": 4.5},
            "egt": {"normalized_residual": 4.2}
        }
    }
    feats_fault = extractor.extract_features(telem_with_fault, res_fault)
    health_fault = health_model.compute_health(feats_fault, anomaly_score=0.85)

    # Thermal health degraded due to real high residual
    assert health_fault.thermal_health < 60.0

    # Case B: If sensor is disconnected / severed (missing), it must NOT evaluate to 99%
    telem_severed = {
        "rpm": 2550.0,
        "oil_pressure": 4.2, "oil_temperature": 88.0,
        "fuel_flow": 18.2, "vibration": 1.15,
        "battery_voltage": 28.2, "manifold_pressure": 31.5
    }
    feats_severed = extractor.extract_features(telem_severed, residuals={})
    health_severed = health_model.compute_health(feats_severed, anomaly_score=0.0)

    # The missing sensor cannot be treated as healthy 99%
    assert health_severed.thermal_health == 0.0
    assert health_severed.observability_status == "DEGRADED_OBSERVABILITY"


def test_health_sensor_recovery_after_outage():
    """9. Sensor recovery after an outage: normal evaluation restored once sensor is valid again."""
    extractor = FeatureExtractor()
    health_model = HealthModel()

    # Step 1: Outage (CHT missing)
    outage_telem = {
        "rpm": 2550.0, "egt": 725.0,
        "oil_pressure": 4.2, "oil_temperature": 88.0,
        "fuel_flow": 18.2, "vibration": 1.15,
        "battery_voltage": 28.2, "manifold_pressure": 31.5
    }
    feats_outage = extractor.extract_features(outage_telem, residuals={})
    health_outage = health_model.compute_health(feats_outage, anomaly_score=0.0)
    assert "cht" in health_outage.missing_channels

    # Step 2: Sensor restored with valid telemetry and nominal residual
    recovered_telem = {
        "rpm": 2550.0, "cht": 108.0, "egt": 725.0,
        "oil_pressure": 4.2, "oil_temperature": 88.0,
        "fuel_flow": 18.2, "vibration": 1.15,
        "battery_voltage": 28.2, "alternator_current": 13.5,
        "manifold_pressure": 31.5
    }
    res_recovered = {
        "channels": {k: {"normalized_residual": 0.05} for k in recovered_telem.keys()}
    }
    feats_recovered = extractor.extract_features(recovered_telem, res_recovered)
    health_recovered = health_model.compute_health(feats_recovered, anomaly_score=0.0)

    assert health_recovered.observability_status == "FULL_OBSERVABILITY"
    assert "cht" not in health_recovered.missing_channels
    assert health_recovered.thermal_health > 95.0
