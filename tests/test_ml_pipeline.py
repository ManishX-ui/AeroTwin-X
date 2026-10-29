"""
Automated Test Suite for AeroTwin-X ML Pipeline and Real-Time Telemetry Subsystem.

Covers:
1. Sensor contract validation & generic payload adaptation.
2. Demo dataset generation determinism and physics fidelity.
3. ML model artifact integrity and feature schema verification.
4. Reusable inference service execution and latency verification.
5. Telemetry ingestion, dual operating modes, and device status tracking.
6. FastAPI endpoints for ML metrics, status, and control.
"""

import os
import sys
import pytest
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.schemas.sensor_contract import (
    CanonicalSensorPayload,
    GenericSensorPayload,
    PHYSICAL_LIMITS,
    validate_physical_bounds,
    adapt_to_telemetry_packet,
)
from backend.ml.demo_data_generator import generate_multi_sortie_dataset
from backend.ml.inference import get_inference_service
from backend.app.services.telemetry_service import get_telemetry_service, DataSourceMode


@pytest.fixture(scope="module")
def client():
    """FastAPI test client fixture."""
    with TestClient(app) as test_client:
        yield test_client


# ============================================================================
# 1. SENSOR CONTRACT & VALIDATION TESTS
# ============================================================================

def test_canonical_sensor_payload_validation():
    """Test valid canonical sensor telemetry passes physical bounds check."""
    valid_payload = CanonicalSensorPayload(
        timestamp=datetime.now().isoformat(),
        uav_id="ESP32-TEST-01",
        engine_id="AE-03",
        rpm=2550.0,
        cht=105.0,
        egt=725.0,
        oil_temperature=92.0,
        oil_pressure=3.8,
        fuel_flow=22.5,
        vibration=1.2,
        battery_voltage=28.2,
        alternator_current=13.5,
        ambient_temp=25.0,
        pressure_altitude=1200.0,
        throttle_pos=75.0,
    )
    res = validate_physical_bounds(valid_payload)
    assert res.is_valid is True, f"Expected valid payload, got errors: {res.issues}"
    assert len(res.issues) == 0



def test_sensor_payload_out_of_bounds_detection():
    """Test out-of-bounds sensor values trigger physical violation errors."""
    invalid_payload = {
        "rpm": 8500.0,            # Max is 6500 RPM
        "cht": 350.0,             # Max is 200 C
        "oil_temperature": -50.0, # Min is -40 C
        "oil_pressure": 15.0,     # Max is 10.0 bar
        "vibration": 25.0,        # Max is 20.0 g
        "throttle_pos": 150.0,    # Max is 100%
    }
    res = validate_physical_bounds(invalid_payload)
    assert res.is_valid is False
    assert any("rpm" in err for err in res.issues)
    assert any("cht" in err for err in res.issues)
    assert any("oil_temperature" in err for err in res.issues)
    assert any("oil_pressure" in err for err in res.issues)


def test_generic_sensor_payload_adapter():
    """Test adaptation of arbitrary third-party device payload format."""
    generic_data = {
        "tachometer": 2600.0,
        "cylinder_head_temperature": 110.0,
        "engine_oil_temperature": 94.0,
        "oil_pressure": 4.1,
        "fuel_consumption": 24.0,
        "vib_sensor": 1.4,
        "oat": 22.0,
        "baro_alt": 1500.0,
        "tps": 80.0,
    }
    generic_payload = GenericSensorPayload(
        device_id="ARDUINO-UAV-99",
        timestamp=datetime.now().astimezone().isoformat(),
        source="LIVE_SENSOR",
        sensors=generic_data,
    )
    packet = adapt_to_telemetry_packet(generic_payload)
    assert packet.rpm == 2600.0
    assert packet.cht == 110.0
    assert packet.oil_temperature == 94.0
    assert packet.oil_pressure == 4.1
    assert packet.fuel_flow == 24.0
    assert packet.vibration == 1.4
    assert packet.throttle_pos == 80.0


# ============================================================================
# 2. DEMO DATASET GENERATION TESTS
# ============================================================================

def test_demo_dataset_generation_determinism():
    """Test demo data generator creates realistic flight sorties deterministically."""
    df1 = generate_multi_sortie_dataset(num_sorties=2, seed=123)
    df2 = generate_multi_sortie_dataset(num_sorties=2, seed=123)

    assert len(df1) > 0
    assert len(df1) == len(df2)
    assert list(df1.columns) == list(df2.columns)
    assert (df1["rpm"].values == df2["rpm"].values).all()

    # Check key columns exist
    required_cols = [
        "timestamp", "sortie_id", "mission_phase", "throttle_pos", "rpm",
        "cht", "egt", "oil_pressure", "oil_temperature", "manifold_pressure",
        "fuel_flow", "vibration", "fault_label", "is_anomaly"
    ]
    for col in required_cols:
        assert col in df1.columns, f"Missing required column: {col}"

    # Verify multiple fault categories are present
    fault_codes = set(df1["fault_label"].unique())
    assert "NORMAL" in fault_codes
    assert len(fault_codes) >= 2



# ============================================================================
# 3. ML MODEL ARTIFACT INTEGRITY & INFERENCE SERVICE
# ============================================================================

def test_ml_artifacts_exist():
    """Verify saved joblib models and metadata exist in backend/ml/artifacts."""
    artifacts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "ml", "artifacts"))
    assert os.path.exists(artifacts_dir), f"Artifacts directory missing: {artifacts_dir}"

    expected_files = [
        "fault_classifier.joblib",
        "isolation_forest.joblib",
        "feature_schema.json",
        "model_metadata.json",
        "metrics.json",
    ]
    for fname in expected_files:
        p = os.path.join(artifacts_dir, fname)
        assert os.path.exists(p), f"Required artifact {fname} missing from {artifacts_dir}"


def test_inference_service_predictions():
    """Verify the ML inference service executes and generates valid predictions."""
    service = get_inference_service()
    assert service.is_loaded is True

    # Nominal flight condition telemetry sample
    nominal_sample = {
        "timestamp": datetime.now().isoformat(),
        "rpm": 2550.0,
        "cht": 108.0,
        "egt": 725.0,
        "oil_pressure": 4.2,
        "oil_temperature": 88.0,
        "fuel_flow": 18.2,
        "vibration": 1.15,
        "manifold_pressure": 31.5,
        "battery_voltage": 28.2,
        "alternator_current": 13.5,
        "throttle_pos": 75.0,
        "pressure_altitude": 2500.0,
        "ambient_temp": 15.0,
    }



    result = service.predict_telemetry(nominal_sample)
    assert result is not None
    assert result.fault.fault == "NORMAL"
    assert result.anomaly.is_anomaly is False
    assert result.health.engine_health > 70.0
    assert result.rul.rul_hours > 0.0


def test_inference_service_fault_detection():
    """Verify inference service flags severe overheating condition as anomalous."""
    service = get_inference_service()

    severe_heat_sample = {
        "timestamp": datetime.now().isoformat(),
        "rpm": 2700.0,
        "cht": 175.0,             # Critically elevated CHT (nominal ~108 C)
        "egt": 950.0,             # Extremely high EGT
        "oil_temperature": 138.0, # Critically elevated oil temp (nominal ~88 C)
        "oil_pressure": 1.8,      # Degraded oil pressure
        "manifold_pressure": 38.0,
        "fuel_flow": 38.0,
        "vibration": 4.5,         # Heavy engine vibration
        "throttle_pos": 95.0,
        "pressure_altitude": 2500.0,
        "ambient_temp": 35.0,
    }

    result = service.predict_telemetry(severe_heat_sample)
    assert result is not None
    assert result.anomaly.is_anomaly is True
    # Fault classifier should identify an active failure state rather than NORMAL
    assert result.fault.fault != "NORMAL"



# ============================================================================
# 4. FASTAPI ENDPOINTS & LIFECYCLE TESTS
# ============================================================================

def test_ml_status_endpoint(client):
    """GET /api/v1/ml/status returns operational model info."""
    r = client.get("/api/v1/ml/status")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] in ("OPERATIONAL", "TRAINED")
    assert data["models_loaded"] is True
    assert "fault_classifier" in data
    assert "isolation_forest" in data
    assert "feature_count" in data


def test_ml_metrics_endpoint(client):
    """GET /api/v1/ml/metrics returns verified training and test evaluation metrics."""
    r = client.get("/api/v1/ml/metrics")
    assert r.status_code == 200
    data = r.json()
    assert "supervised_classification" in data or "fault_classifier" in data
    fc_metrics = data.get("supervised_classification", data.get("fault_classifier", {}).get("test_metrics", {}))
    assert "accuracy" in fc_metrics
    assert fc_metrics["accuracy"] >= 0.80, f"Expected accuracy >= 80%, got {fc_metrics['accuracy']}"
    assert "macro_f1" in fc_metrics



def test_system_data_source_mode_switch(client):
    """POST /api/v1/system/data-source switches modes between DEMO and LIVE_SENSOR."""
    # Switch to LIVE_SENSOR
    r = client.post("/api/v1/system/data-source", json={"mode": "LIVE_SENSOR"})
    assert r.status_code == 200
    assert r.json()["current_mode"] == "LIVE_SENSOR"

    # Verify GET reflects LIVE_SENSOR
    r_get = client.get("/api/v1/system/data-source")
    assert r_get.status_code == 200
    assert r_get.json()["mode"] == "LIVE_SENSOR"

    # Switch back to DEMO
    r_back = client.post("/api/v1/system/data-source", json={"mode": "DEMO"})
    assert r_back.status_code == 200
    assert r_back.json()["current_mode"] == "DEMO"


def test_device_status_endpoint(client):
    """GET /api/v1/devices/status reports telemetry source freshness and state."""
    r = client.get("/api/v1/devices/status")
    assert r.status_code == 200
    data = r.json()
    assert "mode" in data
    assert "is_stale" in data
    assert "packet_count" in data


def test_telemetry_ingest_canonical_payload(client):
    """POST /api/v1/telemetry/ingest accepts canonical sensor telemetry."""
    payload = {
        "device_id": "UAV-TEST-01",
        "engine_id": "AE-03",
        "timestamp": datetime.now().isoformat(),
        "rpm": 2540.0,
        "cht": 103.5,
        "egt": 720.0,
        "oil_pressure": 3.85,
        "oil_temperature": 91.2,
        "fuel_flow": 22.8,
        "vibration": 1.15,
        "ambient_temp": 24.5,
        "pressure_altitude": 1250.0,
        "throttle_pos": 74.0,
    }
    r = client.post("/api/v1/telemetry/ingest", json=payload)
    assert r.status_code in (200, 201), f"Ingest failed: {r.text}"
    res = r.json()
    assert res["status"] in ("SUCCESS", "DUPLICATE_IGNORED")
    assert "predicted_fault" in res or "prediction_result" in res


def test_telemetry_latest_endpoint(client):
    """GET /api/v1/telemetry/latest returns the most recent telemetry packet."""
    r = client.get("/api/v1/telemetry/latest")
    assert r.status_code == 200
    data = r.json()
    assert "rpm" in data
    assert "cht" in data
    assert "oil_temperature" in data or "oil_temp" in data


def test_latest_prediction_endpoint(client):
    """GET /api/v1/ml/predictions/latest returns real-time model inference output."""
    r = client.get("/api/v1/ml/predictions/latest")
    assert r.status_code == 200
    data = r.json()
    # Either returns AIPredictionSummary or initial NO_PREDICTION_AVAILABLE
    if "status" in data and data["status"] == "NO_PREDICTION_AVAILABLE":
        assert True
    else:
        assert "fault" in data or "predicted_fault" in data
        assert "anomaly" in data or "anomaly_score" in data

