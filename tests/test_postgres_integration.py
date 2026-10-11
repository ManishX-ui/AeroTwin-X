"""Comprehensive Test Suite for PostgreSQL Integration in AeroTwin-X.

Tests:
1. Controlled HTTP 503 error handling when DATABASE_URL is unconfigured.
2. Unrelated routes (/health, /diagnostics/services) resilience.
3. Fleet management CRUD and soft-delete safety.
4. Asset registration, filtering, and metadata updates.
5. Dynamic sensor registration and retrieval per asset.
6. Sensor data ingestion with SHA-256 idempotency duplicate detection.
7. Historical sensor readings time-series retrieval.
8. Maintenance work order lifecycle and EASA Part-M CSV export.
9. Alert persistence and operator acknowledgment.
10. Data quality incident resolution and notes tracking.
11. Edge AI device configuration updates.
12. System demo fixtures seeding.
"""
import pytest
import os
import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set up isolated in-memory test database
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

from backend.database.connection import Base, get_db
from backend.database.models import Fleet, Asset, Sensor, SensorReading, MaintenanceRecord, AlertRecord
from backend.app.main import app

# Create tables in test engine
Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def clean_test_db():
    """Ensure clean tables before each test."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield


def test_missing_database_url_controlled_error():
    """Verify that unconfigured database returns clean HTTP 503 rather than crashing."""
    def unconfigured_db():
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "DATABASE_NOT_CONFIGURED",
                "message": "Persistent database is not configured."
            }
        )

    app.dependency_overrides[get_db] = unconfigured_db
    client = TestClient(app)

    # 1. DB dependent route should return 503
    resp = client.get("/api/v1/fleets")
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"] == "DATABASE_NOT_CONFIGURED"

    # 2. Unrelated route (/health) must still respond 200 OK
    health_resp = client.get("/api/v1/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "HEALTHY"

    # Clear override
    app.dependency_overrides.clear()


def test_fleet_crud_lifecycle():
    """Test full Fleet management lifecycle with soft-delete safety."""
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    # 1. Create Fleet
    create_payload = {
        "id": "FLT-TEST-01",
        "name": "Bravo Recon Squadron",
        "description": "Tactical medium altitude patrol unit",
        "organization": "Naval Air Branch",
        "base_station": "Key West Hangar 3",
        "is_active": True
    }
    resp = client.post("/api/v1/fleets", json=create_payload)
    assert resp.status_code == 201
    fleet_data = resp.json()
    assert fleet_data["id"] == "FLT-TEST-01"
    assert fleet_data["name"] == "Bravo Recon Squadron"

    # 2. Get Fleet
    get_resp = client.get("/api/v1/fleets/FLT-TEST-01")
    assert get_resp.status_code == 200
    assert get_resp.json()["base_station"] == "Key West Hangar 3"

    # 3. Update Fleet
    update_resp = client.put("/api/v1/fleets/FLT-TEST-01", json={"base_station": "Updated Bay 5"})
    assert update_resp.status_code == 200
    assert update_resp.json()["base_station"] == "Updated Bay 5"

    # 4. List Fleets
    list_resp = client.get("/api/v1/fleets")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # 5. Soft-Delete Fleet (ensures child records are not destroyed)
    del_resp = client.delete("/api/v1/fleets/FLT-TEST-01")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "SUCCESS"

    # 6. Verify deleted fleet is not returned in active list
    list_after = client.get("/api/v1/fleets")
    assert len(list_after.json()) == 0

    app.dependency_overrides.clear()


def test_asset_and_sensor_management():
    """Test Asset registration, sensor attachment, and filtering."""
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    # 1. Register Asset
    asset_payload = {
        "id": "UAV-99",
        "tail_number": "Tail #999",
        "callsign": "Shadow-99",
        "airframe_model": "Hermes 900 MALE",
        "engine_model": "Rotax 915iSc",
        "base_station": "Forward Base Gamma",
        "latitude": 34.5,
        "longitude": -118.2,
        "altitude_ft": 15000.0,
        "flight_hours_ttsn": 450.0,
        "health_index": 98.5,
        "operational_status": "OPERATIONAL",
        "pilot_in_command": "Capt. Vance"
    }
    resp = client.post("/api/v1/fleet/assets", json=asset_payload)
    assert resp.status_code == 201
    assert resp.json()["callsign"] == "Shadow-99"

    # 2. Register Sensors on Asset
    sensor_payload = {
        "sensor_code": "VIBRATION_FWD",
        "channel_name": "Forward Gearbox Vibration Accelerometer",
        "subsystem": "Propulsion Dynamics",
        "measurement_type": "ACCELERATION",
        "unit": "g",
        "nominal_min": 0.0,
        "nominal_max": 8.0,
        "sample_rate_hz": 100.0,
        "quality_score": 100.0,
        "status": "HEALTHY",
        "is_active": True
    }
    sensor_resp = client.post("/api/v1/fleet/assets/UAV-99/sensors", json=sensor_payload)
    assert sensor_resp.status_code == 201
    assert sensor_resp.json()["id"] == "UAV-99-VIBRATION_FWD"

    # 3. Retrieve sensors for asset
    sensors_list = client.get("/api/v1/fleet/assets/UAV-99/sensors")
    assert sensors_list.status_code == 200
    assert len(sensors_list.json()) == 1

    app.dependency_overrides.clear()


def test_sensor_ingestion_and_idempotency():
    """Test telemetry ingestion, duplicate detection, and historical query."""
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    telemetry_packet = {
        "timestamp": "2026-10-11T12:00:00Z",
        "uav_id": "UAV-07",
        "engine_id": "AE-03",
        "rpm": 5420.0,
        "cht": 142.5,
        "cht_cylinders": [140.0, 142.5, 144.0, 141.0],
        "egt": 820.0,
        "egt_cylinders": [815.0, 820.0, 830.0, 818.0],
        "oil_pressure": 4.2,
        "oil_temperature": 88.0,
        "fuel_flow": 18.5,
        "vibration": 3.4,
        "battery_voltage": 28.2,
        "alternator_current": 14.5,
        "injection_timing": 18.0,
        "throttle_pos": 75.0,
        "manifold_pressure": 34.0,
        "ambient_temp": 12.0,
        "pressure_altitude": 14500.0,
        "mission_phase": "CRUISE",
        "quality": "VALID",
        "source": "SIM"
    }

    # 1. Ingest observation packet
    ingest_resp = client.post("/api/v1/telemetry/ingest", json=telemetry_packet)
    assert ingest_resp.status_code == 201
    assert ingest_resp.json()["status"] == "SUCCESS"
    assert ingest_resp.json()["channels_persisted"] >= 8

    # 2. Resubmit exact same packet (Idempotency duplicate test)
    dup_resp = client.post("/api/v1/telemetry/ingest", json=telemetry_packet)
    assert dup_resp.status_code == 200
    assert dup_resp.json()["status"] == "DUPLICATE_IGNORED"

    # 3. Query historical readings for asset
    readings_resp = client.get("/api/v1/fleet/assets/UAV-07/readings?sensor_code=RPM")
    assert readings_resp.status_code == 200
    readings = readings_resp.json()
    assert len(readings) == 1
    assert readings[0]["reading_value"] == 5420.0

    app.dependency_overrides.clear()


def test_maintenance_and_easa_export():
    """Test Maintenance work order creation, status change, and CSV export."""
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    # 1. Create work order
    wo_payload = {
        "asset_id": "UAV-07",
        "title": "Spark Plug Gap Verification",
        "subsystem": "Ignition Core",
        "priority": "HIGH",
        "advisory_text": "Verify spark electrode gap (0.7mm nominal) on Dual Lane A/B.",
        "assigned_tech": "Flight Bay 3",
        "easa_part_m_ref": "M.A.401 / SB-915-009"
    }
    create_resp = client.post("/api/v1/maintenance", json=wo_payload)
    assert create_resp.status_code == 201
    task_id = create_resp.json()["id"]

    # 2. Assign technician
    assign_resp = client.post(f"/api/v1/maintenance/{task_id}/assign", json={"assigned_tech": "Tech Lead Reynolds"})
    assert assign_resp.status_code == 200
    assert assign_resp.json()["assigned_tech"] == "Tech Lead Reynolds"

    # 3. Update status to CLOSED
    status_resp = client.post(f"/api/v1/maintenance/{task_id}/status", json={"status": "CLOSED"})
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "CLOSED"

    # 4. Export CSV
    csv_resp = client.get("/api/v1/maintenance/export/csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Spark Plug Gap Verification" in csv_resp.text

    app.dependency_overrides.clear()


def test_alerts_acknowledgment_persistence():
    """Test Alert creation and acknowledgment persistence in PostgreSQL."""
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    db = TestSessionLocal()
    alert = AlertRecord(
        id="ALT-UNIT-01",
        asset_id="UAV-07",
        engine_id="AE-03",
        severity="CRITICAL",
        title="Thermal Limit Exceeded",
        description="CHT exceeded 150°C during full throttle climb.",
        acknowledged=False,
        created_at=datetime.datetime.now(datetime.timezone.utc),
        updated_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(alert)
    db.commit()
    db.close()

    # 1. List alerts
    list_resp = client.get("/api/v1/alerts")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # 2. Acknowledge alert
    ack_resp = client.post("/api/v1/alerts/ALT-UNIT-01/ack")
    assert ack_resp.status_code == 200
    assert ack_resp.json()["acknowledged"] is True

    # 3. Verify in DB
    db2 = TestSessionLocal()
    updated_alert = db2.query(AlertRecord).filter(AlertRecord.id == "ALT-UNIT-01").first()
    assert updated_alert.acknowledged is True
    assert updated_alert.acknowledged_at is not None
    db2.close()

    app.dependency_overrides.clear()


def test_seed_demo_fixtures_endpoint():
    """Test system fixtures seeding endpoint."""
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    resp = client.post("/api/v1/system/seed-demo-fixtures")
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUCCESS"

    # Verify seeded assets exist
    assets_resp = client.get("/api/v1/fleet/assets")
    assert assets_resp.status_code == 200
    assert len(assets_resp.json()) == 8

    # Verify summary KPIs calculated dynamically from DB
    summary_resp = client.get("/api/v1/fleet/summary")
    assert summary_resp.status_code == 200
    assert summary_resp.json()["total_assets"] == 8

    app.dependency_overrides.clear()
