"""AeroTwin-X Step 8 Phase 2 Comprehensive Test Suite.

Verifies:
1. Telemetry Freshness Tracking (TSK-04): 10 tests
2. Frozen-Sensor Detection (TSK-05): 10 tests
3. Sensor-Drift Monitoring (TSK-06): 8 tests
4. Concern A: Invalid-input fallback transparency: 2 tests
5. Concern B: Unknown health vs. zero health vs. critical fault: 2 tests
6. End-to-End Pipeline Quality Integration: 2 tests
Total: 34 tests
"""
import math
from datetime import datetime, timezone, timedelta
import pytest
import numpy as np

from backend.ml.data_quality import (
    TelemetryFreshnessTracker,
    FrozenSensorDetector,
    SensorDriftMonitor,
    DataQualityAssessor,
    DEFAULT_CHANNEL_FRESHNESS_CONFIG,
    SENSOR_RESOLUTION_THRESHOLDS
)
from backend.ml.inference import MLInferenceService
from backend.ml.health_model import HealthModel
from backend.ml.preprocessing import FeatureExtractor


# ==============================================================================
# SECTION 1: TSK-04 TELEMETRY FRESHNESS TESTS (10 TESTS)
# ==============================================================================

def test_freshness_01_newly_received_valid_telemetry():
    """Verify newly arrived valid channel is classified as PRESENT_AND_VALID."""
    tracker = TelemetryFreshnessTracker()
    now = datetime.now(timezone.utc)
    status, val, issue = tracker.evaluate_channel("cht", 132.5, device_timestamp=now, server_timestamp=now)
    assert status == "PRESENT_AND_VALID"
    assert val == 132.5
    assert issue is None


def test_freshness_02_missing_packets():
    """Verify missing channel (None) is classified as MISSING."""
    tracker = TelemetryFreshnessTracker()
    now = datetime.now(timezone.utc)
    status, val, issue = tracker.evaluate_channel("cht", None, device_timestamp=now, server_timestamp=now)
    assert status == "MISSING"
    assert val is None
    assert "MISSING" in issue


def test_freshness_03_expired_freshness_timeout():
    """Verify channel transitions to STALE when freshness timeout is exceeded."""
    tracker = TelemetryFreshnessTracker()
    t0 = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)
    # First packet valid
    status1, _, _ = tracker.evaluate_channel("rpm", 2550.0, device_timestamp=t0, server_timestamp=t0)
    assert status1 == "PRESENT_AND_VALID"

    # RPM stale threshold is 1.0s. Send next check 1.5s later with missing packet
    t1 = t0 + timedelta(seconds=1.5)
    status2, _, issue = tracker.evaluate_channel("rpm", None, device_timestamp=t1, server_timestamp=t1)
    assert status2 == "STALE"
    assert "STALE" in issue


def test_freshness_04_invalid_packets_nan_and_infinite():
    """Verify NaN and Inf values are classified as INVALID."""
    tracker = TelemetryFreshnessTracker()
    now = datetime.now(timezone.utc)
    status_nan, val_nan, issue_nan = tracker.evaluate_channel("egt", float("nan"), device_timestamp=now, server_timestamp=now)
    assert status_nan == "INVALID"
    assert val_nan is None
    assert "NaN or Inf" in issue_nan

    status_inf, val_inf, issue_inf = tracker.evaluate_channel("egt", float("inf"), device_timestamp=now, server_timestamp=now)
    assert status_inf == "INVALID"
    assert val_inf is None


def test_freshness_05_old_device_timestamps_buffered_log():
    """Verify packet with old device timestamp is marked STALE even if server received it just now."""
    tracker = TelemetryFreshnessTracker()
    server_now = datetime.now(timezone.utc)
    old_device_time = server_now - timedelta(seconds=45.0)  # 45s old buffered log

    status, val, issue = tracker.evaluate_channel("cht", 130.0, device_timestamp=old_device_time, server_timestamp=server_now)
    assert status == "STALE"
    assert "device timestamp divergence" in issue.lower() or "latency" in issue.lower()


def test_freshness_06_server_vs_device_timestamp_divergence():
    """Verify divergence between server arrival time and sensor timestamp is tracked and flagged."""
    tracker = TelemetryFreshnessTracker()
    server_now = datetime.now(timezone.utc)
    divergent_time = server_now - timedelta(seconds=35.0)

    status, _, issue = tracker.evaluate_channel("fuel_flow", 28.5, device_timestamp=divergent_time, server_timestamp=server_now)
    assert status == "STALE"
    assert "divergence" in issue.lower() or "latency" in issue.lower()


def test_freshness_07_recovery_after_outage():
    """Verify sensor recovers from STALE or OFFLINE when valid telemetry resumes."""
    tracker = TelemetryFreshnessTracker()
    t0 = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)
    tracker.evaluate_channel("oil_pressure", 4.2, device_timestamp=t0, server_timestamp=t0)

    # 10s gap -> transitions to OFFLINE
    t_outage = t0 + timedelta(seconds=10.0)
    status_outage, _, _ = tracker.evaluate_channel("oil_pressure", None, device_timestamp=t_outage, server_timestamp=t_outage)
    assert status_outage in ("STALE", "OFFLINE")

    # Recovery with valid packet
    t_rec = t_outage + timedelta(seconds=1.0)
    status_rec, val_rec, issue_rec = tracker.evaluate_channel("oil_pressure", 4.15, device_timestamp=t_rec, server_timestamp=t_rec)
    assert status_rec == "PRESENT_AND_VALID"
    assert val_rec == 4.15
    assert issue_rec is None


def test_freshness_08_channel_specific_timeouts():
    """Verify fast propulsion control channels have shorter timeouts than thermal channels."""
    tracker = TelemetryFreshnessTracker()
    t0 = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)
    tracker.evaluate_channel("rpm", 2500.0, device_timestamp=t0, server_timestamp=t0)
    tracker.evaluate_channel("cht", 130.0, device_timestamp=t0, server_timestamp=t0)

    # After 1.2s: RPM (stale_sec=1.0) should be STALE, but CHT (stale_sec=3.0) should remain valid/fresh
    t1 = t0 + timedelta(seconds=1.2)
    rpm_status, _, _ = tracker.evaluate_channel("rpm", None, device_timestamp=t1, server_timestamp=t1)
    cht_status, _, _ = tracker.evaluate_channel("cht", None, device_timestamp=t1, server_timestamp=t1)

    assert rpm_status == "STALE"
    # CHT last valid observation was at t0 (1.2s ago), so it is not yet stale (stale threshold 3.0s)
    # When None is passed, evaluate_channel checks whether time since last valid exceeds timeout:
    # 1.2s < 3.0s -> returned as MISSING for this packet, not STALE
    assert cht_status == "MISSING"

    # After 3.5s: CHT also transitions to STALE
    t2 = t0 + timedelta(seconds=3.5)
    cht_status_stale, _, _ = tracker.evaluate_channel("cht", None, device_timestamp=t2, server_timestamp=t2)
    assert cht_status_stale == "STALE"


def test_freshness_09_out_of_order_packets():
    """Verify out-of-order packets (older timestamp received after newer timestamp) are rejected."""
    tracker = TelemetryFreshnessTracker()
    t_newer = datetime(2026, 10, 23, 10, 0, 2, tzinfo=timezone.utc)
    t_older = datetime(2026, 10, 23, 10, 0, 1, tzinfo=timezone.utc)

    # Process newer packet first
    tracker.evaluate_channel("vibration", 0.12, device_timestamp=t_newer, server_timestamp=t_newer)

    # Process older packet second
    status, val, issue = tracker.evaluate_channel("vibration", 0.11, device_timestamp=t_older, server_timestamp=t_newer + timedelta(milliseconds=100))
    assert status == "INVALID"
    assert "out-of-order" in issue.lower()


def test_freshness_10_missing_timestamp_handling():
    """Verify packet with missing device timestamp falls back safely to server ingestion timestamp."""
    tracker = TelemetryFreshnessTracker()
    now_server = datetime.now(timezone.utc)
    status, val, issue = tracker.evaluate_channel("battery_voltage", 28.2, device_timestamp=None, server_timestamp=now_server)
    assert status == "PRESENT_AND_VALID"
    assert val == 28.2


# ==============================================================================
# SECTION 2: TSK-05 FROZEN-SENSOR DETECTION TESTS (10 TESTS)
# ==============================================================================

def test_frozen_01_constant_values_under_stable_cruise_not_frozen():
    """Verify constant sensor readings during steady cruise (no RPM/throttle delta) are NOT flagged frozen."""
    detector = FrozenSensorDetector(min_window_samples=5)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # Steady cruise: constant RPM 2500, constant Throttle 75%, constant CHT 135.0
    for i in range(12):
        t = base_time + timedelta(seconds=i * 0.5)
        is_frozen, reason, _ = detector.update(
            channel="cht",
            value=135.0,
            operating_rpm=2500.0,
            operating_throttle=75.0,
            timestamp=t
        )
        assert not is_frozen, f"Sample {i} falsely triggered frozen sensor during steady cruise: {reason}"


def test_frozen_02_constant_values_while_operating_conditions_change_detected():
    """Verify sensor stuck at constant value while RPM dynamically varies is detected as FROZEN."""
    detector = FrozenSensorDetector(min_window_samples=5)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    frozen_detected = False
    for i in range(12):
        t = base_time + timedelta(seconds=i * 0.5)
        # RPM ramping up dynamically by 30 RPM per step (delta > 200 RPM over window)
        rpm = 2200.0 + i * 30.0
        throttle = 60.0 + i * 2.0
        is_frozen, reason, _ = detector.update(
            channel="cht",
            value=135.0,  # Stuck constant
            operating_rpm=rpm,
            operating_throttle=throttle,
            timestamp=t
        )
        if is_frozen:
            frozen_detected = True
            assert "stuck" in reason.lower() or "frozen" in reason.lower()
            break

    assert frozen_detected, "Detector failed to identify frozen CHT sensor during dynamic RPM excursion"


def test_frozen_03_gradual_legitimate_temperature_changes_not_frozen():
    """Verify genuine gradual thermal changes are not falsely flagged as frozen."""
    detector = FrozenSensorDetector(min_window_samples=5)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    for i in range(15):
        t = base_time + timedelta(seconds=i * 0.5)
        # Genuine CHT rise of 0.2°C per second
        cht_val = 135.0 + (i * 0.1)
        is_frozen, reason, _ = detector.update(
            channel="cht",
            value=cht_val,
            operating_rpm=2600.0,
            operating_throttle=80.0,
            timestamp=t
        )
        assert not is_frozen, f"Gradual temperature climb falsely flagged: {reason}"


def test_frozen_04_small_quantized_changes_within_noise_floor():
    """Verify detector respects sensor resolution/quantization and does not trigger on physical noise."""
    detector = FrozenSensorDetector(min_window_samples=5)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # Accelerometer toggling between 0.100g and 0.105g (quantization noise floor)
    for i in range(10):
        t = base_time + timedelta(seconds=i * 0.5)
        vib_val = 0.100 if i % 2 == 0 else 0.105
        is_frozen, reason, _ = detector.update(
            channel="vibration",
            value=vib_val,
            operating_rpm=2400.0,
            operating_throttle=70.0,
            timestamp=t
        )
        assert not is_frozen


def test_frozen_05_missing_samples_handling():
    """Verify detector handles missing (None) samples safely without crashing."""
    detector = FrozenSensorDetector(min_window_samples=5)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    detector.update("rpm", 2500.0, 2500.0, 75.0, base_time)
    is_frozen, reason, _ = detector.update("rpm", None, 2500.0, 75.0, base_time + timedelta(seconds=0.5))
    assert not is_frozen
    assert "no valid" in reason.lower() or "missing" in reason.lower()


def test_frozen_06_invalid_samples_handling():
    """Verify detector handles NaN/Inf values without corrupting rolling variance."""
    detector = FrozenSensorDetector(min_window_samples=5)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    detector.update("egt", 750.0, 2500.0, 75.0, base_time)
    is_frozen, reason, _ = detector.update("egt", float("nan"), 2500.0, 75.0, base_time + timedelta(seconds=0.5))
    assert not is_frozen


def test_frozen_07_sensor_recovery_after_frozen_state():
    """Verify sensor clears frozen state when variable readings resume under dynamic conditions."""
    detector = FrozenSensorDetector(min_window_samples=5)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # Force frozen condition
    for i in range(10):
        t = base_time + timedelta(seconds=i * 0.5)
        detector.update("manifold_pressure", 28.0, 2200.0 + i * 40.0, 60.0 + i * 3.0, t)

    is_frozen, _, _ = detector.update("manifold_pressure", 28.0, 2600.0, 85.0, base_time + timedelta(seconds=5.0))
    assert is_frozen

    # Dynamic readings resume
    for i in range(6):
        t = base_time + timedelta(seconds=5.5 + i * 0.5)
        is_frozen, reason, _ = detector.update("manifold_pressure", 28.0 + (i * 0.8), 2600.0 + (i * 20.0), 85.0, t)

    assert not is_frozen, "Sensor failed to clear frozen state after dynamic observations resumed"


def test_frozen_08_window_initialization_insufficient_observations():
    """Verify detector requires minimum window size before declaring frozen state."""
    detector = FrozenSensorDetector(min_window_samples=8)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # 3 samples with dynamic RPM
    for i in range(3):
        t = base_time + timedelta(seconds=i * 0.5)
        is_frozen, reason, _ = detector.update("oil_temperature", 90.0, 2000.0 + i * 100.0, 50.0 + i * 10.0, t)
        assert not is_frozen
        assert "insufficient" in reason.lower()


def test_frozen_09_different_sensor_precision_thresholds():
    """Verify channel-specific quantization thresholds (e.g. vibration vs rpm vs altitude)."""
    assert SENSOR_RESOLUTION_THRESHOLDS["vibration"] < SENSOR_RESOLUTION_THRESHOLDS["cht"]
    assert SENSOR_RESOLUTION_THRESHOLDS["cht"] < SENSOR_RESOLUTION_THRESHOLDS["rpm"]
    assert SENSOR_RESOLUTION_THRESHOLDS["oil_pressure"] == 0.01


def test_frozen_10_false_positive_and_detection_rate_evaluation():
    """Evaluate detector on a synthetic test dataset of 50 samples."""
    detector = FrozenSensorDetector(min_window_samples=5)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # Ground truth:
    # 0-20: Normal dynamic flight (expected 0 false alarms)
    # 20-35: Steady cruise (expected 0 false alarms)
    # 35-50: Frozen sensor during climb (expected detection)
    false_positives = 0
    detections = 0

    for i in range(50):
        t = base_time + timedelta(seconds=i * 0.5)
        if i < 20:
            # Dynamic flight: RPM fluctuating, sensor responding
            rpm = 2400.0 + np.sin(i * 0.5) * 150.0
            val = 130.0 + np.sin(i * 0.5) * 5.0
            is_frozen, _, _ = detector.update("cht", val, rpm, 70.0, t)
            if is_frozen:
                false_positives += 1
        elif i < 35:
            # Steady cruise: RPM constant, sensor constant
            is_frozen, _, _ = detector.update("cht", 135.0, 2500.0, 75.0, t)
            if is_frozen:
                false_positives += 1
        else:
            # Frozen during climb: RPM ramping, sensor stuck at 135.0
            rpm = 2500.0 + (i - 35) * 40.0
            is_frozen, _, _ = detector.update("cht", 135.0, rpm, 85.0, t)
            if is_frozen:
                detections += 1

    assert false_positives == 0, f"Expected 0 false positives during cruise/dynamic flight, got {false_positives}"
    assert detections >= 8, f"Expected >= 8 frozen detections during climb phase, got {detections}"


# ==============================================================================
# SECTION 3: TSK-06 SENSOR DRIFT MONITORING TESTS (8 TESTS)
# ==============================================================================

def test_drift_01_zero_mean_noise_is_nominal():
    """Verify zero-mean random measurement noise is classified as NOMINAL."""
    monitor = SensorDriftMonitor(window_size=15)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    np.random.seed(42)
    noise = np.random.normal(0.0, 0.25, 20)

    for i, res in enumerate(noise):
        t = base_time + timedelta(seconds=i)
        status, bias, slope, reason = monitor.update("cht", float(res), t)

    assert status == "NOMINAL"
    assert abs(bias) < 0.6
    assert "nominal" in reason.lower() or "within" in reason.lower()


def test_drift_02_short_lived_transient_deviation_suppressed():
    """Verify short transient spike does not trigger a drift alert."""
    monitor = SensorDriftMonitor(window_size=15)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # 10 nominal samples, 1 isolated 2.8 sigma spike, 4 nominal samples
    for i in range(15):
        t = base_time + timedelta(seconds=i)
        res = 2.8 if i == 10 else 0.1
        status, bias, slope, reason = monitor.update("egt", res, t)

    assert status in ("NOMINAL", "TRANSIENT_SPIKE")
    assert status != "SUSPECTED_DRIFT"


def test_drift_03_persistent_bias_detected():
    """Verify persistent residual offset is detected as PERSISTENT_BIAS."""
    monitor = SensorDriftMonitor(window_size=12, bias_threshold=1.5)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    status = "NOMINAL"
    for i in range(15):
        t = base_time + timedelta(seconds=i)
        # Constant bias of +2.2 sigma
        status, bias, slope, reason = monitor.update("oil_pressure", 2.2, t)

    assert status == "PERSISTENT_BIAS"
    assert bias > 1.8
    assert "bias" in reason.lower()


def test_drift_04_gradual_monotonic_drift_detected():
    """Verify slow gradual linear drift slope is detected as SUSPECTED_DRIFT."""
    monitor = SensorDriftMonitor(window_size=15, min_samples=8)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    status = "NOMINAL"
    for i in range(20):
        t = base_time + timedelta(seconds=i * 2.0)
        # Monotonic linear increase: 0.1 sigma per step
        res = 0.2 + (i * 0.12)
        status, bias, slope, reason = monitor.update("fuel_flow", res, t)

    assert status in ("SUSPECTED_DRIFT", "PERSISTENT_BIAS")
    assert slope > 0.0


def test_drift_05_cross_channel_thermal_correlation_identifies_physical_wear():
    """Verify multi-sensor thermal elevation (CHT, EGT, Oil Temp all rising) is marked PHYSICAL rather than single sensor drift."""
    monitor = SensorDriftMonitor(window_size=10)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # Multi-channel thermal event: all three thermal channels elevated
    all_res = {"cht": 2.2, "egt": 2.4, "oil_temperature": 2.1}

    status = "NOMINAL"
    for i in range(12):
        t = base_time + timedelta(seconds=i)
        status, bias, slope, reason = monitor.update(
            channel="cht",
            norm_residual=2.2,
            timestamp=t,
            all_channels_residuals=all_res
        )

    # Cross-sensor thermal correlation should recognize this as probable physical thermal shift
    assert "physical" in reason.lower() or "thermal" in reason.lower() or status == "PHYSICAL_THERMAL_DEGRADATION"


def test_drift_06_missing_reference_measurements_handled():
    """Verify monitor handles missing residual measurements gracefully."""
    monitor = SensorDriftMonitor()
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    status, bias, slope, reason = monitor.update("vibration", None, base_time)
    assert status == "NOMINAL"
    assert bias == 0.0
    assert slope == 0.0


def test_drift_07_insufficient_samples_nominal():
    """Verify monitor does not trigger drift before minimum sample history is accumulated."""
    monitor = SensorDriftMonitor(min_samples=8)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # 4 high samples (< min_samples 8)
    for i in range(4):
        t = base_time + timedelta(seconds=i)
        status, bias, slope, reason = monitor.update("rpm", 3.0, t)
        assert status == "NOMINAL"
        assert "insufficient" in reason.lower()


def test_drift_08_recovery_following_recalibration():
    """Verify monitor clears drift state when residuals return to nominal baseline."""
    monitor = SensorDriftMonitor(window_size=10)
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # 12 biased samples
    for i in range(12):
        t = base_time + timedelta(seconds=i)
        monitor.update("cht", 2.5, t)

    # Recalibration: 10 nominal samples near 0.0
    for i in range(10):
        t = base_time + timedelta(seconds=12 + i)
        status, bias, slope, reason = monitor.update("cht", 0.05, t)

    assert status == "NOMINAL"
    assert abs(bias) < 0.2


# ==============================================================================
# SECTION 4: CONCERN A & CONCERN B REGRESSION TESTS (4 TESTS)
# ==============================================================================

def test_concern_a_invalid_operating_inputs_flagged_as_fallbacks():
    """Concern A: Missing/invalid operating conditions (RPM, throttle, altitude) trigger ODE fallbacks
    but are explicitly recorded in operating_condition_fallbacks, degrading observability."""
    service = MLInferenceService()
    # Provide valid sensor channels but omit 'rpm' and 'ambient_temp'
    partial_telemetry = {
        "timestamp": "2026-10-23T10:00:00Z",
        "cht": 132.0, "egt": 760.0, "oil_pressure": 4.2, "oil_temperature": 92.0,
        "fuel_flow": 28.0, "vibration": 0.12, "battery_voltage": 28.2, "manifold_pressure": 28.5
        # 'rpm' and 'ambient_temp' missing!
    }

    pred = service.predict(partial_telemetry)
    assert pred.data_quality is not None
    assert "rpm" in pred.data_quality.operating_condition_fallbacks
    assert "ambient_temp" in pred.data_quality.operating_condition_fallbacks
    # Observability status must be DEGRADED, never FULL_OBSERVABILITY
    assert pred.health.observability_status == "DEGRADED_OBSERVABILITY"
    assert pred.health.health_status == "DEGRADED_PARTIAL_OBSERVABILITY"


def test_concern_a_nan_operating_input_flagged():
    """Concern A: NaN operating input is not silently treated as valid."""
    service = MLInferenceService()
    telemetry = {
        "timestamp": "2026-10-23T10:00:00Z",
        "rpm": float("nan"),
        "throttle_pos": 75.0,
        "cht": 132.0, "egt": 760.0, "oil_pressure": 4.2, "oil_temperature": 92.0,
        "fuel_flow": 28.0, "vibration": 0.12, "battery_voltage": 28.2, "manifold_pressure": 28.5
    }

    pred = service.predict(telemetry)
    assert pred.data_quality is not None
    assert "rpm" in pred.data_quality.operating_condition_fallbacks
    assert pred.health.observability_status == "DEGRADED_OBSERVABILITY"


def test_concern_b_unobservable_health_distinct_from_zero_health():
    """Concern B: Unobservable health has is_observable=False and status UNAVAILABLE_INSUFFICIENT_TELEMETRY,
    distinguishable from physical engine failure."""
    service = MLInferenceService()
    empty_telemetry = {
        "timestamp": "2026-10-23T10:00:00Z"
        # All sensors missing!
    }

    pred = service.predict(empty_telemetry)
    assert pred.health.is_observable is False
    assert pred.health.health_status == "UNAVAILABLE_INSUFFICIENT_TELEMETRY"
    assert pred.health.observability_status == "UNAVAILABLE"
    assert "zero subsystems observable" in pred.health.status_message.lower()


def test_concern_b_critical_fault_distinct_from_unobservable():
    """Concern B: Genuine physical critical degradation maintains is_observable=True
    with status CRITICAL_FAULT_DETECTED."""
    model = HealthModel()
    features = {
        "res_cht": 4.5, "res_egt": 4.2, "res_oil_pressure": 4.0, "res_oil_temperature": 3.8,
        "res_fuel_flow": 3.5, "res_manifold_pressure": 3.0, "res_vibration": 4.0,
        "raw_battery_voltage": 24.0,
        "is_present_cht": True, "is_present_egt": True, "is_present_oil_pressure": True,
        "is_present_oil_temperature": True, "is_present_fuel_flow": True,
        "is_present_manifold_pressure": True, "is_present_vibration": True,
        "is_present_battery_voltage": True,
        "_present_channels": ["cht", "egt", "oil_pressure", "oil_temperature", "fuel_flow", "vibration", "battery_voltage", "manifold_pressure"],
        "_missing_channels": [],
        "_invalid_channels": [],
        "_stale_channels": [],
        "_frozen_channels": [],
        "_fallback_operating_inputs": []
    }

    health = model.compute_health(features, anomaly_score=0.85)
    assert health.is_observable is True
    assert health.health_status == "CRITICAL_FAULT_DETECTED"
    assert health.engine_health < 65.0
    assert "critical physical engine degradation" in health.status_message.lower()


# ==============================================================================
# SECTION 5: END-TO-END DATA QUALITY PIPELINE INTEGRATION (2 TESTS)
# ==============================================================================

def test_pipeline_integration_frozen_channel_affects_health_and_prediction():
    """Verify end-to-end inference detects frozen channel and reflects it in health and data_quality."""
    service = MLInferenceService()
    base_time = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # Feed 12 frames where RPM is revving up but CHT is stuck at 135.0
    last_pred = None
    for i in range(12):
        t_iso = (base_time + timedelta(seconds=i * 0.5)).isoformat()
        frame = {
            "timestamp": t_iso,
            "rpm": 2200.0 + i * 40.0,
            "throttle_pos": 65.0 + i * 2.0,
            "pressure_altitude": 2500.0,
            "ambient_temp": 15.0,
            "cht": 135.0,  # Frozen!
            "egt": 750.0 + i * 5.0,
            "oil_pressure": 4.2,
            "oil_temperature": 90.0,
            "fuel_flow": 28.0 + i * 0.5,
            "vibration": 0.12,
            "battery_voltage": 28.2,
            "manifold_pressure": 28.5
        }
        last_pred = service.predict(frame)

    assert last_pred is not None
    assert last_pred.data_quality is not None
    assert "cht" in last_pred.data_quality.frozen_channels
    assert last_pred.health.observability_status == "DEGRADED_OBSERVABILITY"
    assert last_pred.data_quality.channel_reports["cht"].is_frozen is True


def test_pipeline_integration_stale_channel_drops_subsystem_health():
    """Verify stale channel cannot silently produce full observability health score."""
    service = MLInferenceService()
    t0 = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc)

    # Frame 1: valid
    frame1 = {
        "timestamp": t0.isoformat(),
        "rpm": 2500.0, "throttle_pos": 75.0, "pressure_altitude": 2500.0, "ambient_temp": 15.0,
        "cht": 135.0, "egt": 760.0, "oil_pressure": 4.2, "oil_temperature": 90.0,
        "fuel_flow": 28.0, "vibration": 0.12, "battery_voltage": 28.2, "manifold_pressure": 28.5,
        "alternator_current": 18.0
    }
    pred1 = service.predict(frame1)
    assert pred1.health.observability_status == "FULL_OBSERVABILITY"

    # Frame 2: 12 seconds later, CHT packet missing (exceeds CHT 3.0s timeout -> STALE)
    t2 = t0 + timedelta(seconds=12.0)
    frame2 = dict(frame1)
    frame2["timestamp"] = t2.isoformat()
    frame2["cht"] = None  # CHT missing for 12 seconds!

    pred2 = service.predict(frame2)
    assert "cht" in pred2.data_quality.stale_channels or "cht" in pred2.data_quality.missing_channels
    assert pred2.health.observability_status == "DEGRADED_OBSERVABILITY"
    assert "cht" in pred2.health.missing_channels
