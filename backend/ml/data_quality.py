"""AeroTwin-X Industrial Telemetry Freshness, Frozen-Sensor Detection, and Drift Monitoring.

Phase 2 Core Module:
- TelemetryFreshnessTracker: Granular per-channel configurable update intervals,
  device vs server timestamp divergence, out-of-order packet tracking, and recovery.
- FrozenSensorDetector: Context-aware temporal variance checking against operating-condition
  volatility (RPM/throttle delta) and sensor-specific quantization noise floors.
- SensorDriftMonitor: Sliding-window residual tracking distinguishing transient spikes,
  persistent bias, and monotonic sensor drift with cross-channel correlation.
- DataQualityAssessor: Unified quality aggregator.
"""
import math
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple, Union

from ..app.schemas.predictions import (
    ChannelQualityReport, DataQualityAssessment
)

logger = logging.getLogger("aerotwin.data_quality")

# Configurable sensor update intervals and freshness timeouts
# Derived from OEM specifications for Rotax 915 iSc and MALE UAV avionics:
# - High-frequency propulsion control channels (10-50 Hz) have short timeouts (1.0 - 1.5s)
# - Thermal channels have large physical inertia and slower updates (2-5 Hz) with 3.0s timeouts
# - Electrical and ambient channels update at 1-2 Hz with 4.0 - 5.0s timeouts
DEFAULT_CHANNEL_FRESHNESS_CONFIG: Dict[str, Dict[str, float]] = {
    "rpm": {"expected_hz": 10.0, "stale_sec": 1.0, "offline_sec": 5.0},
    "throttle_pos": {"expected_hz": 10.0, "stale_sec": 1.0, "offline_sec": 5.0},
    "manifold_pressure": {"expected_hz": 10.0, "stale_sec": 1.0, "offline_sec": 5.0},
    "cht": {"expected_hz": 2.0, "stale_sec": 3.0, "offline_sec": 10.0},
    "egt": {"expected_hz": 2.0, "stale_sec": 3.0, "offline_sec": 10.0},
    "oil_pressure": {"expected_hz": 5.0, "stale_sec": 2.0, "offline_sec": 8.0},
    "oil_temperature": {"expected_hz": 2.0, "stale_sec": 3.0, "offline_sec": 10.0},
    "fuel_flow": {"expected_hz": 5.0, "stale_sec": 2.0, "offline_sec": 8.0},
    "vibration": {"expected_hz": 10.0, "stale_sec": 1.5, "offline_sec": 6.0},
    "battery_voltage": {"expected_hz": 2.0, "stale_sec": 4.0, "offline_sec": 12.0},
    "alternator_current": {"expected_hz": 2.0, "stale_sec": 4.0, "offline_sec": 12.0},
    "ambient_temp": {"expected_hz": 1.0, "stale_sec": 5.0, "offline_sec": 15.0},
    "pressure_altitude": {"expected_hz": 1.0, "stale_sec": 5.0, "offline_sec": 15.0},
}

# Sensor resolution / quantization thresholds
SENSOR_RESOLUTION_THRESHOLDS: Dict[str, float] = {
    "rpm": 1.0,           # Hall-effect / tooth counter resolution
    "cht": 0.05,          # Thermocouple ADC quantization (°C)
    "egt": 0.2,           # EGT probe resolution (°C)
    "oil_pressure": 0.01, # Piezoresistive pressure transducer (bar)
    "oil_temperature": 0.05,
    "fuel_flow": 0.05,    # Turbine flowmeter pulse quantization (L/h)
    "vibration": 0.005,   # Piezoelectric accelerometer noise floor (g)
    "battery_voltage": 0.02, # ADC resolution (V)
    "alternator_current": 0.05,
    "manifold_pressure": 0.05,
    "throttle_pos": 0.1,
    "ambient_temp": 0.1,
    "pressure_altitude": 2.0,
}


def parse_utc_timestamp(ts: Optional[Union[str, datetime]]) -> Optional[datetime]:
    """Parse ISO timestamp to timezone-aware UTC datetime."""
    if ts is None:
        return None
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts.astimezone(timezone.utc)
    try:
        clean = str(ts).replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


# ==============================================================================
# 1. TSK-04: TELEMETRY FRESHNESS TRACKER
# ==============================================================================

class ChannelFreshnessRecord:
    def __init__(self, channel: str, config: Dict[str, float]):
        self.channel = channel
        self.stale_sec = config.get("stale_sec", 2.0)
        self.offline_sec = config.get("offline_sec", 8.0)
        self.expected_hz = config.get("expected_hz", 2.0)

        self.status = "MISSING"  # PRESENT_AND_VALID, MISSING, INVALID, STALE, OFFLINE
        self.last_valid_val: Optional[float] = None
        self.last_valid_device_ts: Optional[datetime] = None
        self.last_valid_server_ts: Optional[datetime] = None
        self.latest_arrival_server_ts: Optional[datetime] = None
        self.consecutive_valid_count: int = 0
        self.consecutive_invalid_count: int = 0
        self.consecutive_missing_count: int = 0


class TelemetryFreshnessTracker:
    def __init__(self, channel_configs: Optional[Dict[str, Dict[str, float]]] = None):
        self.configs = channel_configs or dict(DEFAULT_CHANNEL_FRESHNESS_CONFIG)
        self.records: Dict[str, ChannelFreshnessRecord] = {
            ch: ChannelFreshnessRecord(ch, cfg) for ch, cfg in self.configs.items()
        }
        self.last_seen_device_ts: Optional[datetime] = None
        self.out_of_order_packets: int = 0
        self.total_packets_processed: int = 0

    def evaluate_channel(
        self,
        channel: str,
        value: Any,
        device_timestamp: Optional[Union[str, datetime]],
        server_timestamp: Optional[datetime] = None
    ) -> Tuple[str, Optional[float], Optional[str]]:
        """Evaluate freshness state for a single channel.
        
        Returns: (status, valid_float_value, issue_description)
        """
        now_server = server_timestamp or datetime.now(timezone.utc)
        if channel not in self.records:
            cfg = self.configs.get(channel, {"stale_sec": 2.0, "offline_sec": 8.0, "expected_hz": 2.0})
            self.records[channel] = ChannelFreshnessRecord(channel, cfg)

        rec = self.records[channel]
        rec.latest_arrival_server_ts = now_server

        # 1. Missing check
        if value is None:
            rec.consecutive_missing_count += 1
            rec.consecutive_valid_count = 0
            # If was previously valid, determine if now STALE or OFFLINE based on elapsed time
            if rec.last_valid_server_ts:
                elapsed = (now_server - rec.last_valid_server_ts).total_seconds()
                if elapsed > rec.offline_sec:
                    rec.status = "OFFLINE"
                    return "OFFLINE", None, f"Channel {channel} is OFFLINE: missing for {elapsed:.1f}s (> {rec.offline_sec}s offline limit)"
                elif elapsed > rec.stale_sec:
                    rec.status = "STALE"
                    return "STALE", None, f"Channel {channel} is STALE: missing for {elapsed:.1f}s (> {rec.stale_sec}s stale limit)"
            rec.status = "MISSING"
            return "MISSING", None, f"Channel {channel} measurement is MISSING"

        # 2. Numeric / Invalidity check
        try:
            val_float = float(value)
            if math.isnan(val_float) or math.isinf(val_float):
                rec.consecutive_invalid_count += 1
                rec.consecutive_valid_count = 0
                rec.status = "INVALID"
                return "INVALID", None, f"Channel {channel} value is INVALID: NaN or Inf"
        except (ValueError, TypeError):
            rec.consecutive_invalid_count += 1
            rec.consecutive_valid_count = 0
            rec.status = "INVALID"
            return "INVALID", None, f"Channel {channel} value is INVALID non-numeric: {value}"

        # 3. Timestamp verification
        dt_device = parse_utc_timestamp(device_timestamp)
        issue = None

        if dt_device is not None:
            # Latency / Historical log check: if device timestamp is far in the past (> 30s)
            latency_sec = (now_server - dt_device).total_seconds()
            if latency_sec > 30.0:
                rec.status = "STALE"
                return "STALE", val_float, f"Channel {channel} device timestamp is STALE ({latency_sec:.1f}s behind server receipt; device timestamp divergence and latency)"

            # Out-of-order check
            if self.last_seen_device_ts and dt_device < (self.last_seen_device_ts - datetime.resolution):
                time_diff = (self.last_seen_device_ts - dt_device).total_seconds()
                if time_diff > 0.05:  # Tolerate minor sub-tick jitter
                    self.out_of_order_packets += 1
                    rec.status = "INVALID"
                    return "INVALID", None, f"Packet device timestamp is OUT-OF-ORDER by {time_diff:.2f}s"
            elif self.last_seen_device_ts is None or dt_device > self.last_seen_device_ts:
                self.last_seen_device_ts = dt_device

        # 4. Valid observation accepted
        rec.status = "PRESENT_AND_VALID"
        rec.last_valid_val = val_float
        rec.last_valid_device_ts = dt_device or now_server
        rec.last_valid_server_ts = now_server
        rec.consecutive_valid_count += 1
        rec.consecutive_invalid_count = 0
        rec.consecutive_missing_count = 0

        return "PRESENT_AND_VALID", val_float, issue

    def check_elapsed_freshness(self, current_server_ts: Optional[datetime] = None) -> Dict[str, str]:
        """Perform periodic time-based scan for stale or offline channels without incoming packets."""
        now_server = current_server_ts or datetime.now(timezone.utc)
        statuses = {}

        for ch, rec in self.records.items():
            if rec.last_valid_server_ts:
                elapsed = (now_server - rec.last_valid_server_ts).total_seconds()
                if elapsed > rec.offline_sec:
                    rec.status = "OFFLINE"
                elif elapsed > rec.stale_sec:
                    rec.status = "STALE"
            elif rec.status not in ("INVALID", "OFFLINE"):
                rec.status = "MISSING"
            statuses[ch] = rec.status

        return statuses


# ==============================================================================
# 2. TSK-05: FROZEN-SENSOR DETECTOR
# ==============================================================================

class FrozenSensorDetector:
    def __init__(
        self,
        window_size: int = 20,
        min_observations: int = 5,
        min_window_samples: Optional[int] = None
    ):
        self.window_size = window_size
        self.min_observations = min_window_samples if min_window_samples is not None else min_observations
        self.histories: Dict[str, deque] = {}  # channel -> deque of (val, rpm, throttle, ts)
        self.frozen_durations: Dict[str, float] = {}

    def update(
        self,
        channel: str,
        value: Optional[float],
        operating_rpm: Optional[float],
        operating_throttle: Optional[float],
        timestamp: Optional[datetime] = None
    ) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """Update sensor reading and evaluate whether it is frozen in context.
        
        Returns: (is_frozen, reason, diagnostic_metrics)
        """
        now = timestamp or datetime.now(timezone.utc)
        if channel not in self.histories:
            self.histories[channel] = deque(maxlen=self.window_size)
            self.frozen_durations[channel] = 0.0

        history = self.histories[channel]

        # If value is None or NaN, don't contaminate frozen detection
        if value is None:
            return False, "No valid reading (MISSING)", {"sample_count": len(history), "variance": 0.0}
        if math.isnan(value) or math.isinf(value):
            return False, "Invalid reading (NaN or Inf)", {"sample_count": len(history), "variance": 0.0}

        rpm = operating_rpm if operating_rpm is not None and not math.isnan(operating_rpm) else 2550.0
        throttle = operating_throttle if operating_throttle is not None and not math.isnan(operating_throttle) else 75.0

        history.append((now, float(value), float(rpm), float(throttle)))

        # Warm-up check: insufficient observations
        if len(history) < self.min_observations:
            return False, "Insufficient observations for window baseline", {"sample_count": len(history), "variance": 0.0, "reason": "Insufficient observations"}

        values = [h[1] for h in history]
        rpms = [h[2] for h in history]
        throttles = [h[3] for h in history]
        timestamps = [h[0] for h in history]

        # Resolution quantization floor for this sensor type
        quant_eps = SENSOR_RESOLUTION_THRESHOLDS.get(channel, 0.01)

        val_spread = max(values) - min(values)
        val_mean = sum(values) / len(values)
        val_variance = sum((v - val_mean) ** 2 for v in values) / len(values)

        rpm_spread = max(rpms) - min(rpms)
        throttle_spread = max(throttles) - min(throttles)
        time_span = (timestamps[-1] - timestamps[0]).total_seconds() if len(timestamps) > 1 else 0.0

        is_operating_dynamic = (rpm_spread > 80.0) or (throttle_spread > 3.0)
        is_sensor_static = (val_spread <= quant_eps) or (val_variance <= (quant_eps ** 2))

        diagnostics = {
            "sample_count": len(history),
            "variance": round(val_variance, 6),
            "val_spread": round(val_spread, 4),
            "rpm_spread": round(rpm_spread, 1),
            "throttle_spread": round(throttle_spread, 1),
            "time_span_sec": round(time_span, 2),
            "quantization_eps": quant_eps
        }

        # Case A: Engine conditions are genuinely steady (e.g. constant cruise)
        # Identical readings are natural physics, NOT frozen failure!
        if not is_operating_dynamic:
            # Only declare frozen under steady cruise if stuck for excessive prolonged time (> 60s)
            if is_sensor_static and time_span > 60.0 and len(history) >= self.window_size:
                reason = f"Sensor {channel} bitwise constant for {time_span:.1f}s during steady cruise"
                return True, reason, diagnostics
            return False, None, diagnostics

        # Case B: Engine operating conditions are changing (RPM or Throttle varying),
        # but the sensor reading remains stubbornly flat below quantization floor!
        if is_operating_dynamic and is_sensor_static:
            reason = (
                f"Sensor {channel} FROZEN / STUCK constant (spread {val_spread:.3f} <= {quant_eps}) "
                f"despite engine dynamic variation (delta RPM={rpm_spread:.1f}, delta throttle={throttle_spread:.1f}%)"
            )
            return True, reason, diagnostics

        return False, None, diagnostics

    def reset_channel(self, channel: str):
        """Reset historical window for a sensor (e.g. upon recovery)."""
        if channel in self.histories:
            self.histories[channel].clear()
            self.frozen_durations[channel] = 0.0


# ==============================================================================
# 3. TSK-06: SENSOR DRIFT MONITOR
# ==============================================================================

class SensorDriftMonitor:
    def __init__(
        self,
        window_size: int = 30,
        min_observations: int = 8,
        min_samples: Optional[int] = None,
        bias_threshold: float = 1.5
    ):
        self.window_size = window_size
        self.min_observations = min_samples if min_samples is not None else min_observations
        self.bias_threshold = bias_threshold
        self.residual_histories: Dict[str, deque] = {}  # channel -> deque of (ts, norm_res)

    def update(
        self,
        channel: str,
        norm_residual: Optional[float],
        timestamp: Optional[datetime] = None,
        all_channels_residuals: Optional[Dict[str, float]] = None
    ) -> Tuple[str, float, float, Optional[str]]:
        """Evaluate residual trend to detect drift, bias, or transient disturbance.
        
        Returns: (drift_status, mean_bias, slope_per_sec, diagnostic_reason)
        Status values: NOMINAL, TRANSIENT_SPIKE, SUSPECTED_DRIFT, PERSISTENT_BIAS, PHYSICAL_THERMAL_DEGRADATION
        """
        now = timestamp or datetime.now(timezone.utc)
        if channel not in self.residual_histories:
            self.residual_histories[channel] = deque(maxlen=self.window_size)

        history = self.residual_histories[channel]

        if norm_residual is None or math.isnan(norm_residual) or math.isinf(norm_residual):
            return "NOMINAL", 0.0, 0.0, None

        history.append((now, float(norm_residual)))

        if len(history) < self.min_observations:
            return "NOMINAL", float(norm_residual), 0.0, "Insufficient observations for drift baseline"

        times = [(h[0] - history[0][0]).total_seconds() for h in history]
        residuals = [h[1] for h in history]
        n = len(residuals)

        mean_res = sum(residuals) / n
        abs_mean = abs(mean_res)
        latest_res = residuals[-1]

        # 1. Transient Spike Detection:
        # A single extreme reading while rolling historical mean was low
        recent_sub = residuals[:-1]
        prior_mean = sum(recent_sub) / len(recent_sub) if recent_sub else 0.0
        if abs(latest_res) > 2.5 and abs(prior_mean) < 1.0:
            return "TRANSIENT_SPIKE", round(mean_res, 3), 0.0, f"Single-sample transient divergence ({latest_res:.2f}σ)"

        # 2. Linear Drift Rate Estimation:
        # slope = Cov(t, r) / Var(t)
        t_span = times[-1] - times[0]
        if t_span > 1.0:
            t_mean = sum(times) / n
            var_t = sum((t - t_mean) ** 2 for t in times)
            cov_tr = sum((times[i] - t_mean) * (residuals[i] - mean_res) for i in range(n))
            slope = (cov_tr / var_t) if var_t > 1e-6 else 0.0
        else:
            slope = 0.0

        abs_slope = abs(slope)

        # 3. Cross-Sensor Thermal Confirmation:
        # If CHT is drifting up, check if EGT and Oil Temp are ALSO drifting up in sympathy.
        # If all thermal channels drift together, it's an engine physical thermal load, NOT an isolated sensor drift!
        is_isolated_sensor = True
        if channel in ("cht", "egt", "oil_temperature") and all_channels_residuals:
            thermal_keys = [k for k in ("cht", "egt", "oil_temperature") if k in all_channels_residuals and k != channel]
            correlated_count = 0
            for tk in thermal_keys:
                tk_res = all_channels_residuals.get(tk, 0.0)
                # If peer sensor has same polarity divergence > 1.5σ
                if (latest_res > 1.5 and tk_res > 1.5) or (latest_res < -1.5 and tk_res < -1.5):
                    correlated_count += 1
            if correlated_count >= len(thermal_keys) and len(thermal_keys) > 0:
                is_isolated_sensor = False

        # 4. Classification
        if not is_isolated_sensor and abs_mean > 2.0:
            # Physical multi-subsystem shift
            return "PHYSICAL_THERMAL_DEGRADATION", round(mean_res, 3), round(slope, 4), "Multi-sensor correlated physical thermal deviation"

        if abs_slope > 0.03 and abs_mean > 1.0:
            return "SUSPECTED_DRIFT", round(mean_res, 3), round(slope, 4), f"Monotonic sensor drift slope ({slope:+.3f}σ/s, bias={mean_res:+.2f}σ)"

        if abs_mean > self.bias_threshold:
            return "PERSISTENT_BIAS", round(mean_res, 3), round(slope, 4), f"Persistent calibration offset (mean bias={mean_res:+.2f}σ)"

        return "NOMINAL", round(mean_res, 3), round(slope, 4), "Residual within zero-mean stochastic bounds"

    def reset_channel(self, channel: str):
        """Reset historical window upon sensor recalibration."""
        if channel in self.residual_histories:
            self.residual_histories[channel].clear()


# ==============================================================================
# 4. DATA QUALITY ASSESSOR (PIPELINE AGGREGATOR)
# ==============================================================================

class DataQualityAssessor:
    """Unified telemetry quality assessor combining Freshness, Frozen, and Drift detectors."""
    def __init__(self):
        self.freshness_tracker = TelemetryFreshnessTracker()
        self.frozen_detector = FrozenSensorDetector()
        self.drift_monitor = SensorDriftMonitor()

    def assess_telemetry(
        self,
        telemetry: Dict[str, Any],
        residuals: Optional[Dict[str, Any]] = None,
        server_timestamp: Optional[datetime] = None
    ) -> DataQualityAssessment:
        """Execute full data quality assessment on incoming telemetry packet."""
        now_server = server_timestamp or datetime.now(timezone.utc)
        device_ts_raw = telemetry.get("timestamp")
        parsed_device_ts = parse_utc_timestamp(device_ts_raw)

        operating_rpm = telemetry.get("rpm")
        operating_throttle = telemetry.get("throttle_pos")

        res_dict = {}
        if residuals:
            if isinstance(residuals, dict):
                channels = residuals.get("channels", {})
                for k, v in channels.items():
                    res_dict[k] = v.get("normalized_residual", 0.0) if isinstance(v, dict) else getattr(v, "normalized_residual", 0.0)

        channel_reports: Dict[str, ChannelQualityReport] = {}
        freshness_summary: Dict[str, str] = {}
        frozen_channels: List[str] = []
        drifting_channels: List[str] = []
        stale_channels: List[str] = []
        invalid_channels: List[str] = []
        missing_channels: List[str] = []

        all_keys = list(DEFAULT_CHANNEL_FRESHNESS_CONFIG.keys())

        for ch in all_keys:
            raw_val = telemetry.get(ch)
            fresh_status, valid_float, fresh_issue = self.freshness_tracker.evaluate_channel(
                channel=ch,
                value=raw_val,
                device_timestamp=parsed_device_ts,
                server_timestamp=now_server
            )
            freshness_summary[ch] = fresh_status

            if fresh_status == "MISSING":
                missing_channels.append(ch)
            elif fresh_status == "INVALID":
                invalid_channels.append(ch)
            elif fresh_status == "STALE":
                stale_channels.append(ch)

            # Frozen sensor check
            is_frozen, frozen_reason, _ = self.frozen_detector.update(
                channel=ch,
                value=valid_float,
                operating_rpm=operating_rpm,
                operating_throttle=operating_throttle,
                timestamp=now_server
            )
            if is_frozen:
                frozen_channels.append(ch)

            # Drift monitor check
            ch_res = res_dict.get(ch)
            drift_status, drift_bias, drift_slope, _ = self.drift_monitor.update(
                channel=ch,
                norm_residual=ch_res,
                timestamp=now_server,
                all_channels_residuals=res_dict
            )
            if drift_status in ("SUSPECTED_DRIFT", "PERSISTENT_BIAS"):
                drifting_channels.append(ch)

            time_since_valid = None
            rec = self.freshness_tracker.records.get(ch)
            if rec and rec.last_valid_server_ts:
                time_since_valid = round((now_server - rec.last_valid_server_ts).total_seconds(), 2)

            channel_reports[ch] = ChannelQualityReport(
                channel_name=ch,
                freshness_status=fresh_status,
                is_frozen=is_frozen,
                frozen_reason=frozen_reason,
                drift_status=drift_status,
                drift_bias=drift_bias,
                drift_slope_per_sec=drift_slope,
                last_valid_timestamp=rec.last_valid_device_ts.isoformat() if rec and rec.last_valid_device_ts else None,
                time_since_valid_sec=time_since_valid,
                is_operating_fallback=False
            )

        # Overall quality roll-up
        if len(missing_channels) == len(all_keys):
            overall_quality = "OFFLINE"
        elif invalid_channels or frozen_channels or len(stale_channels) > 2:
            overall_quality = "CRITICAL"
        elif missing_channels or stale_channels or drifting_channels:
            overall_quality = "DEGRADED"
        else:
            overall_quality = "HEALTHY"

        return DataQualityAssessment(
            overall_quality=overall_quality,
            freshness_summary=freshness_summary,
            frozen_channels=sorted(list(set(frozen_channels))),
            drifting_channels=sorted(list(set(drifting_channels))),
            stale_channels=sorted(list(set(stale_channels))),
            invalid_channels=sorted(list(set(invalid_channels))),
            missing_channels=sorted(list(set(missing_channels))),
            operating_condition_fallbacks=[],
            channel_reports=channel_reports,
            assessment_timestamp=now_server.isoformat()
        )
