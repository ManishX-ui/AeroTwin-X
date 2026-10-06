"""Automated Verification Tests for AeroTwin-X."""
import sys
import os

# Add backend to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.digital_twin.engine_model import AeroPistonDigitalTwin
from backend.digital_twin.residuals import ResidualAnalyzer
from backend.simulation.engine_simulator import EngineSimulator
from backend.ml.preprocessing import FeatureExtractor
from backend.ml.anomaly_detector import AnomalyDetector
from backend.ml.fault_classifier import FaultClassifier
from backend.ml.health_model import HealthModel
from backend.ml.rul_model import RULModel
from backend.ml.explainability import ExplainabilityEngine

def test_digital_twin_nominal_execution():
    print("Test 1: Digital Twin Nominal State Execution...")
    twin = AeroPistonDigitalTwin()
    expected = twin.compute_expected_state(
        rpm=2550.0,
        throttle_pct=75.0,
        altitude_ft=14500.0,
        ambient_temp_c=-13.7,
        mission_phase="CRUISE"
    )
    assert "cht" in expected and expected["cht"] > 70.0, "CHT should be calculated"
    assert "egt" in expected and expected["egt"] > 500.0, "EGT should be calculated"
    assert "oil_pressure" in expected and expected["oil_pressure"] > 2.0, "Oil pressure expected"
    print(f" -> PASSED (Expected CHT: {expected['cht']}°C, EGT: {expected['egt']}°C, Oil P: {expected['oil_pressure']} bar)")

def test_residual_analysis():
    print("\nTest 2: Residual Analysis...")
    analyzer = ResidualAnalyzer()
    actual = {"cht": 145.0, "egt": 780.0, "oil_pressure": 4.1, "oil_temperature": 92.0, "fuel_flow": 18.0, "vibration": 1.1}
    expected = {"cht": 108.0, "egt": 725.0, "oil_pressure": 4.2, "oil_temperature": 88.0, "fuel_flow": 18.2, "vibration": 1.15}
    twin_state = analyzer.compute_residuals(actual, expected, "2026-10-06T12:00:00Z")

    assert "cht" in twin_state.channels
    cht_res = twin_state.channels["cht"]
    assert cht_res.residual == 37.0, f"CHT residual should be 37.0, got {cht_res.residual}"
    assert cht_res.status in ["WARNING", "CRITICAL"], f"CHT status should trigger, got {cht_res.status}"
    print(f" -> PASSED (CHT norm residual: {cht_res.normalized_residual}σ, Status: {cht_res.status})")

def test_fault_injection_and_ml_detection():
    print("\nTest 3: Fault Injection -> ML Detection End-to-End...")
    sim = EngineSimulator()
    twin = AeroPistonDigitalTwin()
    analyzer = ResidualAnalyzer()
    extractor = FeatureExtractor()
    anom_det = AnomalyDetector()
    classifier = FaultClassifier()
    health_model = HealthModel()
    rul_model = RULModel()
    xai = ExplainabilityEngine()

    # Step 1: Nominal baseline check
    sim.fault_injector.reset()
    packet, m = sim.generate_step(0.5)
    exp = twin.compute_expected_state(packet.rpm, packet.throttle_pos, packet.pressure_altitude, packet.ambient_temp, packet.mission_phase)
    res = analyzer.compute_residuals(packet.model_dump(), exp, packet.timestamp)
    feats = extractor.extract_features(packet.model_dump(), res.model_dump())
    anom_norm = anom_det.predict(feats)
    flt_norm = classifier.predict(feats)
    health_norm = health_model.compute_health(feats, anom_norm.anomaly_score)

    print(f" [Nominal] Anomaly: {anom_norm.anomaly_score} ({anom_norm.anomaly_status}), Fault: {flt_norm.fault}, Health: {health_norm.engine_health}")
    assert not anom_norm.is_anomaly, "Nominal baseline should NOT trigger false anomaly"
    assert health_norm.engine_health > 85.0, "Nominal health should be high"

    # Step 2: Inject OVERHEATING
    print(" Injecting OVERHEATING fault...")
    sim.fault_injector.set_fault("OVERHEATING", severity=1.5)
    # Advance 8 seconds into fault
    for _ in range(16):
        packet, m = sim.generate_step(0.5)
        exp = twin.compute_expected_state(packet.rpm, packet.throttle_pos, packet.pressure_altitude, packet.ambient_temp, packet.mission_phase)
        res = analyzer.compute_residuals(packet.model_dump(), exp, packet.timestamp)
        feats = extractor.extract_features(packet.model_dump(), res.model_dump())

    anom_fault = anom_det.predict(feats)
    flt_fault = classifier.predict(feats)
    health_fault = health_model.compute_health(feats, anom_fault.anomaly_score)
    rul_fault = rul_model.estimate_rul(health_fault.engine_health, flt_fault.fault, anom_fault.anomaly_score)
    evidence, attributions, root_cause = xai.explain(flt_fault.fault, feats)

    print(f" [Fault State] Anomaly: {anom_fault.anomaly_score} ({anom_fault.anomaly_status})")
    print(f" [Fault State] Classification: {flt_fault.fault} (Confidence: {flt_fault.confidence}%)")
    print(f" [Fault State] Engine Health: {health_fault.engine_health} / 100")
    print(f" [Fault State] RUL: {rul_fault.rul_hours}h (Trend: {rul_fault.degradation_trend})")
    print(f" [Fault State] Root Cause: {root_cause}")
    print(f" [Fault State] Evidence Triggers: {evidence[:2]}")

    assert anom_fault.is_anomaly, "Anomaly MUST be detected during overheating"
    assert flt_fault.fault == "OVERHEATING", f"Fault classifier should detect OVERHEATING, got {flt_fault.fault}"
    assert health_fault.engine_health < health_norm.engine_health, "Health MUST degrade under overheating"
    print(" -> PASSED: End-to-end simulation, twin, and ML pipeline validated!")

if __name__ == "__main__":
    test_digital_twin_nominal_execution()
    test_residual_analysis()
    test_fault_injection_and_ml_detection()
    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
