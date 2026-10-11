"""Verification test for all new endpoints across Maintenance, Reports, Edge AI, Data Quality, and Fleet."""
import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_maintenance_crud():
    # List
    r = requests.get(f"{BASE_URL}/maintenance")
    assert r.status_code == 200
    initial_len = len(r.json())

    # Create
    create_payload = {
        "title": "Turbo Oil Seal Replacement",
        "subsystem": "Propulsion Core",
        "priority": "HIGH",
        "advisory_text": "Verify seal compression and replace dynamic O-ring.",
        "assigned_tech": "Specialist J. Miller"
    }
    r = requests.post(f"{BASE_URL}/maintenance", json=create_payload)
    assert r.status_code == 200
    task = r.json()
    task_id = task["id"]
    assert task["title"] == "Turbo Oil Seal Replacement"

    # Update
    r = requests.put(f"{BASE_URL}/maintenance/{task_id}", json={"priority": "CRITICAL"})
    assert r.status_code == 200
    assert r.json()["priority"] == "CRITICAL"

    # Assign
    r = requests.post(f"{BASE_URL}/maintenance/{task_id}/assign", json={"assigned_tech": "Chief Tech Alpha"})
    assert r.status_code == 200
    assert r.json()["assigned_tech"] == "Chief Tech Alpha"

    # Status
    r = requests.post(f"{BASE_URL}/maintenance/{task_id}/status", json={"status": "IN_PROGRESS"})
    assert r.status_code == 200
    assert r.json()["status"] == "IN_PROGRESS"

    # Delete
    r = requests.delete(f"{BASE_URL}/maintenance/{task_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "SUCCESS"

    print("[PASS] Maintenance CRUD validated successfully.")

def test_reports_flow():
    # List
    r = requests.get(f"{BASE_URL}/reports")
    assert r.status_code == 200

    # Generate
    gen_payload = {
        "title": "Automated Test Reliability Report",
        "report_type": "CBM_RELIABILITY",
        "asset_id": "UAV-07 (Hermes MALE)",
        "date_range": "LAST_30_DAYS",
        "format": "CSV",
        "metrics": ["CHT", "EGT", "Vibration"]
    }
    r = requests.post(f"{BASE_URL}/reports/generate", json=gen_payload)
    assert r.status_code == 200
    report = r.json()
    report_id = report["id"]

    # Download
    r = requests.get(f"{BASE_URL}/reports/{report_id}/download")
    assert r.status_code == 200
    assert "attachment" in r.headers.get("content-disposition", "")
    assert len(r.content) > 50

    # Delete
    r = requests.delete(f"{BASE_URL}/reports/{report_id}")
    assert r.status_code == 200

    print("[PASS] Reports generation and download validated successfully.")

def test_edge_ai_flow():
    # Summary
    r = requests.get(f"{BASE_URL}/edge-ai/summary")
    assert r.status_code == 200
    assert "online_devices" in r.json()

    # Devices
    r = requests.get(f"{BASE_URL}/edge-ai/devices")
    assert r.status_code == 200
    devices = r.json()
    assert len(devices) >= 4

    dev_id = devices[0]["id"]
    # Update Config
    r = requests.put(f"{BASE_URL}/edge-ai/devices/{dev_id}", json={"telemetry_hz": 60, "power_mode": "25W_MAX"})
    assert r.status_code == 200
    assert r.json()["telemetry_hz"] == 60

    # Logs
    r = requests.get(f"{BASE_URL}/edge-ai/devices/{dev_id}/logs")
    assert r.status_code == 200
    assert len(r.json()["logs"]) >= 3

    # Deploy Model
    r = requests.post(f"{BASE_URL}/edge-ai/deploy", json={
        "model_id": "ISO-FOREST-v1.4",
        "target_device_id": dev_id,
        "target_precision": "INT8"
    })
    assert r.status_code == 200
    assert r.json()["status"] == "DEPLOYED"

    print("[PASS] Edge AI operations and deployment validated successfully.")

def test_data_quality_flow():
    # Summary
    r = requests.get(f"{BASE_URL}/data-quality/summary")
    assert r.status_code == 200
    assert "completeness_score_pct" in r.json()

    # Sensor Matrix
    r = requests.get(f"{BASE_URL}/data-quality/sensors")
    assert r.status_code == 200
    assert len(r.json()) >= 6

    # Raw vs Validated Comparison
    r = requests.get(f"{BASE_URL}/data-quality/comparison?sensor_id=CHT-03")
    assert r.status_code == 200
    comp = r.json()
    assert "observations" in comp and len(comp["observations"]) > 10

    # Incidents
    r = requests.get(f"{BASE_URL}/data-quality/incidents")
    assert r.status_code == 200
    incidents = r.json()
    assert len(incidents) >= 2

    # Resolve Incident
    inc_id = incidents[0]["id"]
    r = requests.post(f"{BASE_URL}/data-quality/incidents/{inc_id}/resolve", json={
        "resolution_notes": "Recalibrated via field software patch.",
        "resolved_by": "Sensor QA Lead"
    })
    assert r.status_code == 200
    assert r.json()["status"] == "RESOLVED"

    print("[PASS] Data Quality matrix and incident resolution validated successfully.")

def test_fleet_flow():
    # Summary
    r = requests.get(f"{BASE_URL}/fleet/summary")
    assert r.status_code == 200
    assert "total_assets" in r.json()

    # Assets
    r = requests.get(f"{BASE_URL}/fleet/assets")
    assert r.status_code == 200
    assets = r.json()
    assert len(assets) == 8

    # Update Asset
    r = requests.put(f"{BASE_URL}/fleet/assets/UAV-01", json={"callsign": "Valkyrie-Leader", "pilot_in_command": "Col. J. Hayes"})
    assert r.status_code == 200
    assert r.json()["callsign"] == "Valkyrie-Leader"

    # Multi-Asset Comparison
    r = requests.get(f"{BASE_URL}/fleet/comparison?asset_ids=UAV-01,UAV-07")
    assert r.status_code == 200
    assert len(r.json()["comparison_metrics"]) >= 2

    # Acknowledge Alert
    r = requests.post(f"{BASE_URL}/fleet/alerts/ALT-FLT-101/acknowledge")
    assert r.status_code == 200
    assert r.json()["status"] == "SUCCESS"

    print("[PASS] Fleet operations, asset editing, and alerts validated successfully.")

if __name__ == "__main__":
    test_maintenance_crud()
    test_reports_flow()
    test_edge_ai_flow()
    test_data_quality_flow()
    test_fleet_flow()
    print("ALL MODULE BACKEND TESTS PASSED 100%!")
