"""API Endpoint Integration Tests using FastAPI TestClient."""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app

def test_api_endpoints():
    client = TestClient(app)

    print("Testing Engine State endpoint...")
    r = client.get("/api/v1/engine/AE-03/state")
    assert r.status_code == 200, f"Engine state failed: {r.text}"
    data = r.json()
    assert "telemetry" in data and "digital_twin" in data

    print("Testing Engine Health & 3D Components...")
    r = client.get("/api/v1/engine/AE-03/health")
    assert r.status_code == 200
    h_data = r.json()
    assert "components_3d" in h_data

    print("Testing Simulation Scenarios...")
    r = client.get("/api/v1/simulation/scenarios")
    assert r.status_code == 200
    scenarios = r.json()
    assert len(scenarios) == 10

    print("Testing Fault Injection...")
    r = client.post("/api/v1/faults/inject", json={"fault_type": "OVERHEATING", "severity": 1.2})
    assert r.status_code == 200
    assert r.json()["status"] == "INJECTED"

    print("Testing Reset Simulation...")
    r = client.post("/api/v1/simulation/reset")
    assert r.status_code == 200
    assert r.json()["status"] == "RESET"

    print("Testing Alerts...")
    r = client.get("/api/v1/alerts")
    assert r.status_code == 200
    alerts = r.json()
    assert len(alerts) >= 1
    first_id = alerts[0]["id"]
    r_ack = client.post(f"/api/v1/alerts/{first_id}/ack")
    assert r_ack.status_code == 200

    print("Testing Maintenance...")
    r = client.get("/api/v1/maintenance")
    assert r.status_code == 200

    print("Testing Models Registry...")
    r = client.get("/api/v1/models")
    assert r.status_code == 200
    assert len(r.json()) == 4

    print("Testing Missions Replay...")
    r = client.get("/api/v1/missions/MSN-ISR-0814/replay")
    assert r.status_code == 200

    print("\nALL API ENDPOINTS VALIDATED SUCCESSFULLY!")

if __name__ == "__main__":
    test_api_endpoints()
