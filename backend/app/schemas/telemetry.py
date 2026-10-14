"""Canonical Telemetry Data Schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class TelemetryPacket(BaseModel):
    timestamp: str = Field(..., description="ISO 8601 UTC measurement timestamp from source device")
    uav_id: str = Field("UAV-01", description="Registered UAV identifier")
    engine_id: str = Field("AE-03", description="Engine identification")
    rpm: float = Field(..., ge=0.0, le=7500.0, description="Engine Revolutions Per Minute (0-7500)")
    cht: float = Field(..., ge=-50.0, le=250.0, description="Cylinder Head Temperature in °C (-50 to 250)")
    cht_cylinders: List[float] = Field(default_factory=lambda: [108.0, 108.5, 107.8, 108.2])
    egt: float = Field(..., ge=-50.0, le=1100.0, description="Exhaust Gas Temperature in °C (-50 to 1100)")
    egt_cylinders: List[float] = Field(default_factory=lambda: [725.0, 728.0, 723.0, 726.0])
    oil_pressure: float = Field(..., ge=0.0, le=15.0, description="Oil Pressure in bar (0-15)")
    oil_temperature: float = Field(..., ge=-50.0, le=200.0, description="Oil Temperature in °C (-50 to 200)")
    fuel_flow: float = Field(..., ge=0.0, le=100.0, description="Fuel Flow rate in L/h (0-100)")
    vibration: float = Field(..., ge=0.0, le=25.0, description="Engine overall vibration in g RMS (0-25)")
    battery_voltage: float = Field(..., ge=10.0, le=40.0, description="DC Bus Battery Voltage in V (10-40)")
    alternator_current: float = Field(..., ge=0.0, le=120.0, description="Alternator Current in A (0-120)")
    injection_timing: float = Field(18.2, description="Injection Timing in ° BTDC")
    throttle_pos: float = Field(..., ge=0.0, le=100.0, description="Throttle Lever Position % (0-100)")
    manifold_pressure: float = Field(31.5, ge=10.0, le=55.0, description="Manifold Air Pressure in inHg (10-55)")
    ambient_temp: float = Field(15.0, ge=-70.0, le=60.0, description="Outside Ambient Temperature in °C (-70 to 60)")
    pressure_altitude: float = Field(2500.0, ge=-1000.0, le=45000.0, description="Pressure Altitude in ft (-1000 to 45000)")
    mission_phase: str = Field("CRUISE", description="TAKEOFF, CLIMB, CRUISE, LOITER, DESCENT, LANDING")
    quality: str = Field("VALID", description="Data quality: VALID, DEGRADED, DROPOUT, DRIFT")
    source: str = Field("SIMULATION", description="Data source: LIVE_SENSOR, DATASET_REPLAY, SIMULATION")
    is_synthetic: bool = Field(True, description="Flag indicating if data is synthetic or from physical hardware")
    server_ingested_at: Optional[str] = Field(None, description="Server-side ingestion timestamp recorded upon receipt")
    device_token_hash: Optional[str] = Field(None, description="Hashed device token or signature for lineage verification")

class TelemetryHistoryResponse(BaseModel):
    engine_id: str
    count: int
    data: List[TelemetryPacket]
