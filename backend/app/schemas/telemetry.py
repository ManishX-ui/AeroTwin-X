"""Canonical Telemetry Data Schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class TelemetryPacket(BaseModel):
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
    uav_id: str = Field("UAV-01", description="UAV identification")
    engine_id: str = Field("AE-03", description="Engine identification")
    rpm: float = Field(..., description="Engine Revolutions Per Minute")
    cht: float = Field(..., description="Cylinder Head Temperature (°C)")
    cht_cylinders: List[float] = Field(default_factory=lambda: [178.4, 180.2, 177.9, 179.1])
    egt: float = Field(..., description="Exhaust Gas Temperature (°C)")
    egt_cylinders: List[float] = Field(default_factory=lambda: [724.2, 729.0, 722.5, 726.8])
    oil_pressure: float = Field(..., description="Oil Pressure (bar)")
    oil_temperature: float = Field(..., description="Oil Temperature (°C)")
    fuel_flow: float = Field(..., description="Fuel Flow rate (L/h)")
    vibration: float = Field(..., description="Engine overall vibration (g / mm/s RMS)")
    battery_voltage: float = Field(..., description="DC Bus Battery Voltage (V)")
    alternator_current: float = Field(..., description="Alternator Output Current (A)")
    injection_timing: float = Field(..., description="Injection Timing (° BTDC)")
    throttle_pos: float = Field(..., description="Throttle Lever Position (%)")
    manifold_pressure: float = Field(32.4, description="Manifold Air Pressure (inHg / kPa)")
    ambient_temp: float = Field(15.6, description="Outside Ambient Temperature (°C)")
    pressure_altitude: float = Field(2500.0, description="Pressure Altitude (ft)")
    mission_phase: str = Field("CRUISE", description="TAKEOFF, CLIMB, CRUISE, LOITER, DESCENT, LANDING")
    quality: str = Field("VALID", description="Data quality: VALID, DEGRADED, DROPOUT, DRIFT")
    source: str = Field("SIM", description="LIVE, SIM, REPLAY")

class TelemetryHistoryResponse(BaseModel):
    engine_id: str
    count: int
    data: List[TelemetryPacket]
