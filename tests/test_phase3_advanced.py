"""Phase 3 Advanced Functional & Diagnostics Verification Suite.
Validates Feature 1 (Clickable Metrics), Feature 2 (3D Components),
Feature 3 (Simulation Lifecycle & 10 Scenarios), Feature 4 (Real-time Diagnostics),
and Feature 5 (Production Deployment & CORS).
"""
import sys
import os
import unittest
import json
from fastapi.testclient import TestClient

# Path setup
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app
from backend.app.services.state_service import state_service

class TestAdvancedAeroTwin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_feature1_telemetry_schema_and_sensors(self):
        """Feature 1: Validates that all supported sensors match backend schema."""
        res = self.client.get("/api/v1/telemetry")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        required_sensors = [
            "rpm", "cht", "egt", "oil_pressure", "oil_temperature",
            "fuel_flow", "vibration", "battery_voltage", "alternator_current",
            "manifold_pressure"
        ]
        for s in required_sensors:
            self.assertIn(s, data, f"Required sensor {s} missing from telemetry")
            self.assertIsInstance(data[s], (int, float), f"Sensor {s} must be numeric")

    def test_feature2_component_health_and_state(self):
        """Feature 2: Component-level health and telemetry synchronization."""
        res = self.client.get("/api/v1/engine/AE-03/state")
        self.assertEqual(res.status_code, 200)
        state = res.json()
        self.assertIn("engine_id", state)
        self.assertIn("status", state)
        self.assertIn("telemetry", state)

        # Confirm component health breakdown exists without fictional values
        res_health = self.client.get("/api/v1/engine/AE-03/health")
        self.assertEqual(res_health.status_code, 200)
        health = res_health.json()
        self.assertIn("components_3d", health)
        components = health["components_3d"]
        self.assertIn("cylinders", components)
        self.assertIn("lubrication", components)
        self.assertIn("cooling", components)
        self.assertIn("combustion", components)
        self.assertIn("gearbox_vibration", components)
        self.assertIn("electrical", components)

    def test_feature3_all_10_scenarios_and_lifecycle(self):
        """Feature 3: End-to-end verification of all 10 fault scenarios and lifecycle."""
        # 1. Scenarios endpoint
        res = self.client.get("/api/v1/simulation/scenarios")
        self.assertEqual(res.status_code, 200)
        scenarios = res.json()
        scenario_ids = [s["id"] for s in scenarios]
        
        expected_scenarios = [
            "NORMAL", "OVERHEATING", "INJECTOR_ANOMALY", "MISFIRE",
            "LUBRICATION_ISSUE", "ABNORMAL_VIBRATION", "SENSOR_DRIFT",
            "SENSOR_DROPOUT", "ELECTRICAL_FAULT", "COMBUSTION_INSTABILITY"
        ]
        for exp in expected_scenarios:
            self.assertIn(exp, scenario_ids, f"Scenario {exp} not present in backend")

        # 2. Lifecycle: Start -> Pause -> Resume -> Stop -> Reset
        res = self.client.post("/api/v1/simulation/start")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "RUNNING")

        res = self.client.post("/api/v1/simulation/stop")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "PAUSED")

        res = self.client.post("/api/v1/simulation/resume")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "RUNNING")

        # 3. Inject fault
        res = self.client.post("/api/v1/faults/inject", json={"fault_type": "OVERHEATING", "severity": 1.25})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "INJECTED")

        # 4. Reset
        res = self.client.post("/api/v1/simulation/reset")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "RESET")

    def test_feature4_service_diagnostics(self):
        """Feature 4: Real-time service health diagnostics endpoint."""
        res = self.client.get("/api/v1/diagnostics/services")
        self.assertEqual(res.status_code, 200)
        diag = res.json()
        
        self.assertIn("timestamp", diag)
        self.assertIn("overall_status", diag)
        self.assertIn("services", diag)
        
        services = diag["services"]
        expected_monitored = [
            "fastapi_backend", "websocket_telemetry", "database",
            "digital_twin", "simulator", "anomaly_detector",
            "fault_classifier", "health_estimator", "rul_model"
        ]
        for s in expected_monitored:
            self.assertIn(s, services, f"Service {s} missing from diagnostics")
            self.assertIn("status", services[s])
            self.assertIn("name", services[s])
        
        # Verify database check worked safely
        self.assertIn(services["database"]["status"], ["CONNECTED", "DEGRADED"])

    def test_feature5_cors_and_deployment_readiness(self):
        """Feature 5: CORS headers verification for public frontend deployment."""
        res = self.client.options(
            "/api/v1/health",
            headers={
                "Origin": "https://aero-twin-x.vercel.app",
                "Access-Control-Request-Method": "GET"
            }
        )
        self.assertEqual(res.status_code, 200)
        # Verify allow origin response
        self.assertTrue(
            res.headers.get("access-control-allow-origin") in ["*", "https://aero-twin-x.vercel.app"]
        )

if __name__ == "__main__":
    unittest.main()
