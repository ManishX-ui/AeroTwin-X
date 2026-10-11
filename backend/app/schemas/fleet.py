"""Pydantic schemas for Fleet, Asset, Sensor, and Reading models."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


# ---------------------------------------------------------------------------
# Fleet Schemas
# ---------------------------------------------------------------------------
class FleetBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, description="Name of the fleet")
    description: Optional[str] = Field(None, description="Operational description")
    organization: Optional[str] = Field("MALE Tactical Operations", max_length=120)
    base_station: Optional[str] = Field(None, max_length=150)
    is_active: bool = Field(True, description="Whether the fleet is active")


class FleetCreate(FleetBase):
    id: Optional[str] = Field(None, description="Optional custom ID (e.g. FLT-ALPHA)")


class FleetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    organization: Optional[str] = None
    base_station: Optional[str] = None
    is_active: Optional[bool] = None


class FleetResponse(FleetBase):
    id: str
    created_at: datetime
    updated_at: datetime
    asset_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Sensor Schemas
# ---------------------------------------------------------------------------
class SensorBase(BaseModel):
    sensor_code: str = Field(..., description="Unique code on asset e.g. RPM, CHT_1")
    channel_name: str = Field(..., description="Human readable name e.g. Cylinder 1 Head Temp")
    subsystem: str = Field("Core Propulsion", description="Target subsystem")
    measurement_type: str = Field(..., description="TEMPERATURE, PRESSURE, SPEED, FLOW, ACCELERATION, VOLTAGE")
    unit: str = Field(..., description="Measurement unit e.g. °C, RPM, bar")
    nominal_min: Optional[float] = None
    nominal_max: Optional[float] = None
    sample_rate_hz: float = Field(50.0, description="Acquisition rate in Hz")
    noise_sigma: float = Field(0.1, description="Expected measurement noise sigma")
    quality_score: float = Field(100.0, ge=0.0, le=100.0)
    status: str = Field("HEALTHY", description="HEALTHY, STALE, DRIFTING, FLAGGED")
    is_active: bool = True


class SensorCreate(SensorBase):
    pass


class SensorResponse(SensorBase):
    id: str
    asset_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Asset Schemas
# ---------------------------------------------------------------------------
class AssetBase(BaseModel):
    tail_number: str = Field(..., description="Official tail number")
    callsign: str = Field(..., description="Operational callsign")
    airframe_model: str = Field(..., description="Airframe model name")
    engine_model: str = Field(..., description="Engine model name")
    base_station: str = Field(..., description="Operating base or hangar")
    latitude: float = Field(0.0, ge=-90.0, le=90.0)
    longitude: float = Field(0.0, ge=-180.0, le=180.0)
    altitude_ft: float = Field(0.0, ge=0.0)
    flight_hours_ttsn: float = Field(0.0, ge=0.0)
    health_index: float = Field(100.0, ge=0.0, le=100.0)
    operational_status: str = Field("OPERATIONAL", description="OPERATIONAL, MAINTENANCE, STANDBY, OFFLINE")
    active_mission: Optional[str] = None
    pilot_in_command: str = Field("Unassigned")
    last_inspection: Optional[str] = None
    next_due_hours: float = Field(100.0, ge=0.0)
    advisories_count: int = Field(0, ge=0)
    notes: Optional[str] = None


class AssetCreate(AssetBase):
    id: str = Field(..., description="Asset identifier e.g. UAV-01, UAV-09")
    fleet_id: Optional[str] = Field(None, description="Optional parent fleet ID")


class AssetUpdate(BaseModel):
    callsign: Optional[str] = None
    fleet_id: Optional[str] = None
    base_station: Optional[str] = None
    pilot_in_command: Optional[str] = None
    operational_status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude_ft: Optional[float] = None
    flight_hours_ttsn: Optional[float] = None
    health_index: Optional[float] = None
    last_inspection: Optional[str] = None
    next_due_hours: Optional[float] = None
    notes: Optional[str] = None


class AssetResponse(AssetBase):
    id: str
    fleet_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Sensor Reading & Ingestion Schemas
# ---------------------------------------------------------------------------
class SensorReadingItem(BaseModel):
    timestamp: datetime = Field(..., description="ISO UTC timestamp")
    sensor_code: str = Field(..., description="Sensor code e.g. RPM, CHT")
    reading_value: float = Field(..., description="Numeric sensor measurement")
    unit: Optional[str] = None
    quality_flag: str = Field("VALID", description="VALID, DEGRADED, DROPOUT, DRIFT")
    raw_payload: Optional[str] = None


class SensorReadingResponse(SensorReadingItem):
    id: int
    asset_id: str
    sensor_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IngestSensorPayload(BaseModel):
    asset_id: str = Field(..., description="Target asset ID")
    timestamp: Optional[datetime] = None
    readings: Dict[str, float] = Field(..., description="Key-value mapping of sensor_code -> value")
    raw_packet: Optional[Dict[str, Any]] = None
    quality_flag: Optional[str] = "VALID"
