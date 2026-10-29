"""Canonical Sensor Data Contract and Ingestion Adapter Schemas.

Defines:
- Generic machine telemetry contract (supporting ESP32, Arduino, Raspberry Pi, IoT gateways)
- Physical boundary validation rules
- Mapping layer from generic sensor telemetry to AeroTwin-X canonical telemetry packet
"""
from typing import Dict, Any, Optional, Union, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator
import logging

from .telemetry import TelemetryPacket

logger = logging.getLogger("aerotwin.sensor_contract")

# Physical boundary specifications for Rotax 915 iS / MALE UAV aero-piston engines
PHYSICAL_LIMITS = {
    "rpm": {"min": 0.0, "max": 6500.0, "unit": "RPM", "nominal": 2550.0},
    "cht": {"min": -40.0, "max": 200.0, "unit": "°C", "nominal": 108.0},
    "egt": {"min": -40.0, "max": 1050.0, "unit": "°C", "nominal": 725.0},
    "oil_pressure": {"min": 0.0, "max": 10.0, "unit": "bar", "nominal": 4.2},
    "oil_temperature": {"min": -40.0, "max": 160.0, "unit": "°C", "nominal": 88.0},
    "fuel_flow": {"min": 0.0, "max": 60.0, "unit": "L/h", "nominal": 18.2},
    "vibration": {"min": 0.0, "max": 20.0, "unit": "g", "nominal": 1.15},
    "battery_voltage": {"min": 10.0, "max": 36.0, "unit": "V", "nominal": 28.2},
    "alternator_current": {"min": 0.0, "max": 100.0, "unit": "A", "nominal": 13.5},
    "manifold_pressure": {"min": 10.0, "max": 45.0, "unit": "inHg", "nominal": 31.5},
    "ambient_temp": {"min": -60.0, "max": 60.0, "unit": "°C", "nominal": 15.0},
    "pressure_altitude": {"min": -1000.0, "max": 35000.0, "unit": "ft", "nominal": 2500.0},
    "throttle_pos": {"min": 0.0, "max": 100.0, "unit": "%", "nominal": 75.0},
}

# Generic sensor name aliases
SENSOR_ALIASES = {
    # Temperature aliases -> CHT or Oil Temp
    "temperature": "cht",
    "temp": "cht",
    "engine_temp": "cht",
    "cylinder_temp": "cht",
    "cylinder_head_temperature": "cht",
    "cylinder_head_temp": "cht",
    "exhaust_temp": "egt",
    "exhaust_gas_temperature": "egt",
    "oil_temp": "oil_temperature",
    "engine_oil_temperature": "oil_temperature",
    # Pressure aliases
    "pressure": "oil_pressure",
    "oil_press": "oil_pressure",
    "engine_oil_pressure": "oil_pressure",
    "manifold_press": "manifold_pressure",
    "manifold_absolute_pressure": "manifold_pressure",
    "map": "manifold_pressure",
    # Vibration aliases
    "vib": "vibration",
    "accel": "vibration",
    "vibe": "vibration",
    "vib_sensor": "vibration",
    # Flow
    "fuel": "fuel_flow",
    "flow": "fuel_flow",
    "fuel_consumption": "fuel_flow",
    # Speed
    "speed": "rpm",
    "tachometer": "rpm",
    "engine_speed": "rpm",
    # Throttle
    "throttle": "throttle_pos",
    "tps": "throttle_pos",
    # Environmental / Electrical
    "oat": "ambient_temp",
    "outside_air_temp": "ambient_temp",
    "baro_alt": "pressure_altitude",
    "altitude": "pressure_altitude",
    "voltage": "battery_voltage",
    "batt_volt": "battery_voltage",
    "current": "alternator_current",

}


class GenericSensorPayload(BaseModel):
    """Generic machine telemetry payload for IoT hardware (ESP32, Raspberry Pi, etc.)."""
    device_id: str = Field(..., description="Device or Machine ID, e.g. ENGINE-001 or UAV-01")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
    source: str = Field("sensor", description="Source identifier: 'sensor', 'demo', 'LIVE_SENSOR', etc.")
    sensors: Dict[str, float] = Field(..., description="Key-value sensor readings dictionary")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Device metadata, firmware version, etc.")

    @field_validator("timestamp")
    @classmethod
    def validate_iso_timestamp(cls, v: str) -> str:
        try:
            # Parse to ensure valid ISO 8601 format
            clean_ts = v.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_ts)
            if dt.tzinfo is None:
                raise ValueError("Timestamp must include timezone (prefer UTC 'Z' or '+00:00')")
            return v
        except Exception as e:
            raise ValueError(f"Invalid ISO 8601 timestamp '{v}': {e}")

    @field_validator("sensors")
    @classmethod
    def validate_sensors_non_empty(cls, v: Dict[str, float]) -> Dict[str, float]:
        if not v:
            raise ValueError("Sensors map cannot be empty.")
        return v


class SensorValidationResult(BaseModel):
    is_valid: bool
    quality_status: str  # VALID, DEGRADED, OUT_OF_RANGE, SPIKE, FROZEN
    issues: List[str] = Field(default_factory=list)
    sanitized_values: Dict[str, float] = Field(default_factory=dict)


def validate_physical_ranges(sensor_values: Union[Dict[str, Any], Any]) -> SensorValidationResult:
    """Validate sensor measurements against documented physical boundary specifications."""
    issues = []
    sanitized = {}
    has_critical_error = False

    # Convert Pydantic models to dict if needed
    if hasattr(sensor_values, "model_dump"):
        data = sensor_values.model_dump()
        if "sensors" in data and isinstance(data["sensors"], dict):
            raw_dict = data["sensors"]
        else:
            raw_dict = data
    elif isinstance(sensor_values, dict):
        raw_dict = sensor_values.get("sensors", sensor_values)
    else:
        raw_dict = {}

    for key, value in raw_dict.items():
        if not isinstance(value, (int, float)):
            continue
        canonical_key = SENSOR_ALIASES.get(key.lower(), key.lower())
        if canonical_key in PHYSICAL_LIMITS:
            limits = PHYSICAL_LIMITS[canonical_key]
            if value < limits["min"] or value > limits["max"]:
                issues.append(
                    f"{canonical_key}={value} out of physical range [{limits['min']}, {limits['max']}] {limits['unit']}"
                )
                has_critical_error = True
            sanitized[canonical_key] = float(value)
        else:
            sanitized[key] = float(value)

    quality = "OUT_OF_RANGE" if has_critical_error else ("VALID" if not issues else "DEGRADED")
    return SensorValidationResult(
        is_valid=not has_critical_error,
        quality_status=quality,
        issues=issues,
        sanitized_values=sanitized
    )

# Canonical type alias and function alias for test & integration compatibility
CanonicalSensorPayload = TelemetryPacket
validate_physical_bounds = validate_physical_ranges



def adapt_to_telemetry_packet(
    payload: Union[GenericSensorPayload, TelemetryPacket, Dict[str, Any]],
    default_uav_id: str = "UAV-01",
    default_engine_id: str = "AE-03",
    source_override: Optional[str] = None
) -> TelemetryPacket:
    """Convert any supported sensor payload to canonical TelemetryPacket with physical boundary checks."""
    if isinstance(payload, TelemetryPacket):
        if source_override:
            payload.source = source_override
        return payload

    if isinstance(payload, GenericSensorPayload):
        data = payload.model_dump()
    elif isinstance(payload, dict):
        data = payload
    else:
        raise ValueError(f"Unsupported payload type: {type(payload)}")

    # Extract device / timestamp / source
    device_id = data.get("device_id") or data.get("uav_id") or default_uav_id
    timestamp = data.get("timestamp")
    if not timestamp:
        timestamp = datetime.now(timezone.utc).isoformat()

    raw_source = source_override or data.get("source", "sensor")
    # Normalize source
    source_str = "LIVE_SENSOR" if raw_source.lower() in ("sensor", "live_sensor", "hardware", "esp32") else (
        "DATASET_REPLAY" if "replay" in raw_source.lower() else "SIMULATION"
    )

    # Resolve sensor map
    sensors_dict = data.get("sensors")
    if not sensors_dict and "rpm" in data:
        # Already flat dictionary with sensor fields
        sensors_dict = data

    # Canonicalize sensor aliases
    resolved_sensors = {}
    for k, v in (sensors_dict or {}).items():
        if isinstance(v, (int, float)):
            canonical_name = SENSOR_ALIASES.get(k.lower(), k.lower())
            resolved_sensors[canonical_name] = float(v)

    # Validate physical boundaries
    val_result = validate_physical_ranges(resolved_sensors)

    # Defaults from physical nominals
    rpm = resolved_sensors.get("rpm", PHYSICAL_LIMITS["rpm"]["nominal"])
    cht = resolved_sensors.get("cht", PHYSICAL_LIMITS["cht"]["nominal"])
    egt = resolved_sensors.get("egt", PHYSICAL_LIMITS["egt"]["nominal"])
    oil_pressure = resolved_sensors.get("oil_pressure", PHYSICAL_LIMITS["oil_pressure"]["nominal"])
    oil_temperature = resolved_sensors.get("oil_temperature", PHYSICAL_LIMITS["oil_temperature"]["nominal"])
    fuel_flow = resolved_sensors.get("fuel_flow", PHYSICAL_LIMITS["fuel_flow"]["nominal"])
    vibration = resolved_sensors.get("vibration", PHYSICAL_LIMITS["vibration"]["nominal"])
    battery_voltage = resolved_sensors.get("battery_voltage", PHYSICAL_LIMITS["battery_voltage"]["nominal"])
    alternator_current = resolved_sensors.get("alternator_current", PHYSICAL_LIMITS["alternator_current"]["nominal"])
    manifold_pressure = resolved_sensors.get("manifold_pressure", PHYSICAL_LIMITS["manifold_pressure"]["nominal"])
    throttle_pos = resolved_sensors.get("throttle_pos", PHYSICAL_LIMITS["throttle_pos"]["nominal"])
    ambient_temp = resolved_sensors.get("ambient_temp", PHYSICAL_LIMITS["ambient_temp"]["nominal"])
    pressure_altitude = resolved_sensors.get("pressure_altitude", PHYSICAL_LIMITS["pressure_altitude"]["nominal"])

    packet = TelemetryPacket(
        timestamp=timestamp,
        uav_id=device_id,
        engine_id=default_engine_id,
        rpm=rpm,
        cht=cht,
        cht_cylinders=[cht, cht + 0.5, cht - 0.2, cht + 0.3],
        egt=egt,
        egt_cylinders=[egt, egt + 3.0, egt - 2.0, egt + 1.0],
        oil_pressure=oil_pressure,
        oil_temperature=oil_temperature,
        fuel_flow=fuel_flow,
        vibration=vibration,
        battery_voltage=battery_voltage,
        alternator_current=alternator_current,
        injection_timing=18.2,
        throttle_pos=throttle_pos,
        manifold_pressure=manifold_pressure,
        ambient_temp=ambient_temp,
        pressure_altitude=pressure_altitude,
        mission_phase=data.get("mission_phase", "CRUISE"),
        quality=val_result.quality_status,
        source=source_str,
        is_synthetic=(source_str != "LIVE_SENSOR"),
        server_ingested_at=datetime.now(timezone.utc).isoformat()
    )
    return packet
