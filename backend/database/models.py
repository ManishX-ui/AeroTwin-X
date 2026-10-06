"""Database SQLAlchemy Entities."""
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text
import datetime
import uuid
from .connection import Base

class TelemetryRecord(Base):
    __tablename__ = "telemetry_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(String, index=True)
    uav_id = Column(String, index=True, default="UAV-01")
    engine_id = Column(String, index=True, default="AE-03")
    rpm = Column(Float)
    cht = Column(Float)
    egt = Column(Float)
    oil_pressure = Column(Float)
    oil_temperature = Column(Float)
    fuel_flow = Column(Float)
    vibration = Column(Float)
    battery_voltage = Column(Float)
    alternator_current = Column(Float)
    injection_timing = Column(Float)
    throttle_pos = Column(Float)
    manifold_pressure = Column(Float)
    ambient_temp = Column(Float)
    pressure_altitude = Column(Float)
    mission_phase = Column(String, default="CRUISE")
    quality = Column(String, default="VALID")
    source = Column(String, default="SIM")

class PredictionRecord(Base):
    __tablename__ = "prediction_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(String, index=True)
    engine_id = Column(String, index=True, default="AE-03")
    predicted_fault = Column(String, default="NORMAL")
    confidence = Column(Float, default=95.0)
    anomaly_score = Column(Float, default=0.08)
    health_index = Column(Float, default=95.0)
    rul_hours = Column(Float, default=1284.0)
    model_version = Column(String, default="v2.1-aerotwin")
    evidence = Column(Text) # JSON string

class AlertRecord(Base):
    __tablename__ = "alert_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(String, index=True)
    engine_id = Column(String, index=True, default="AE-03")
    severity = Column(String) # CRITICAL, WARNING, INFORMATION
    title = Column(String)
    description = Column(String)
    evidence = Column(Text) # JSON or newline string
    acknowledged = Column(Boolean, default=False)
    source = Column(String, default="AI_FAULT_DETECTION")

class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_order = Column(String, unique=True, index=True)
    title = Column(String)
    subsystem = Column(String)
    priority = Column(String)
    advisory_text = Column(String)
    evidence_triggers = Column(Text)
    status = Column(String, default="OPEN") # OPEN, IN_PROGRESS, CLOSED
    created_at = Column(String)
    assigned_tech = Column(String, default="Powertrain Bay 4")
    easa_part_m_ref = Column(String, default="M.A.401")

class MissionRecord(Base):
    __tablename__ = "mission_records"

    id = Column(String, primary_key=True)
    name = Column(String)
    uav_id = Column(String, default="UAV-01")
    engine_id = Column(String, default="AE-03")
    phase = Column(String, default="CRUISE")
    status = Column(String, default="ACTIVE")
    start_time = Column(String)
    end_time = Column(String, nullable=True)

class ModelRegistryRecord(Base):
    __tablename__ = "model_registry_records"

    id = Column(String, primary_key=True)
    name = Column(String)
    model_type = Column(String)
    version = Column(String)
    training_date = Column(String)
    metrics = Column(Text) # JSON string
    status = Column(String, default="ACTIVE")
