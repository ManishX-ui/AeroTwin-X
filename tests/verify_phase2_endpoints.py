"""Verify every endpoint in Phase 2 backend skeleton."""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app

def run_phase2_endpoint_verification():
    client = TestClient(app)
    results = []

    tests = [
        ("GET", "/health", None, 200),
        ("GET", "/api/v1/health", None, 200),
        ("GET", "/api/v1/telemetry", None, 200),
        ("GET", "/api/v1/telemetry/history?limit=10", None, 200),
        ("GET", "/api/v1/engine/AE-03/state", None, 200),
        ("GET", "/api/v1/engine/AE-03/telemetry", None, 200),
        ("GET", "/api/v1/engine/AE-03/health", None, 200),
        ("GET", "/api/v1/engine/AE-03/predictions", None, 200),
        ("GET", "/api/v1/predictions", None, 200),
        ("GET", "/api/v1/alerts", None, 200),
        ("POST", "/api/v1/alerts/ALT-084/ack", None, 200),
        ("GET", "/api/v1/missions", None, 200),
        ("POST", "/api/v1/missions", {"name": "Test Mission"}, 200),
        ("GET", "/api/v1/missions/MSN-ISR-0814/replay", None, 200),
        ("GET", "/api/v1/simulation/scenarios", None, 200),
        ("POST", "/api/v1/simulation/start", None, 200),
        ("POST", "/api/v1/simulation/stop", None, 200),
        ("POST", "/api/v1/simulation/phase", {"phase": "CLIMB"}, 200),
        ("POST", "/api/v1/faults/inject", {"fault_type": "OVERHEATING", "severity": 1.2}, 200),
        ("POST", "/api/v1/simulation/reset", None, 200),
        ("GET", "/api/v1/maintenance", None, 200),
        ("POST", "/api/v1/maintenance", {"title": "Test Work Order", "subsystem": "Cooling"}, 200),
        ("GET", "/api/v1/models", None, 200),
    ]

    print(f"{'METHOD':<7} | {'ENDPOINT':<45} | {'STATUS':<6} | {'RESULT'}")
    print("-" * 75)

    all_passed = True
    for method, path, json_data, expected_status in tests:
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(path, json=json_data)
        
        passed = resp.status_code == expected_status
        if not passed:
            all_passed = False
        res_str = "PASS" if passed else f"FAIL ({resp.status_code})"
        print(f"{method:<7} | {path:<45} | {resp.status_code:<6} | {res_str}")
        results.append((method, path, resp.status_code, passed))

    # Test WebSocket connection
    print("\nTesting WebSocket /ws/telemetry...")
    try:
        with client.websocket_connect("/ws/telemetry") as ws:
            ws.send_text('{"action": "RESET"}')
            print(f"{'WS':<7} | {'/ws/telemetry':<45} | {'101':<6} | PASS")
            results.append(("WS", "/ws/telemetry", 101, True))
    except Exception as e:
        print(f"WebSocket verification failed: {e}")
        all_passed = False

    print("\n" + "=" * 75)
    if all_passed:
        print("ALL 24 PHASE 2 ENDPOINTS & WEBSOCKET VERIFIED: 100% PASS RATE")
    else:
        print("SOME ENDPOINTS FAILED")
    print("=" * 75)

if __name__ == "__main__":
    run_phase2_endpoint_verification()
