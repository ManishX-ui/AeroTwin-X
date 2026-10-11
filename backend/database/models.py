"""Database SQLAlchemy Entities for AeroTwin-X Industrial Digital Twin.

Includes relational schema for Fleets, Assets, Sensors, Historical Readings,
Maintenance Work Orders, Alerts, Edge Devices, AI Predictions, and Data Quality Events.
"""
import uuid
import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, Float, String, Boolean, DateTime,
    Text, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .connection import Base


# ---------------------------------------------------------------------------
# 1. Users and Application Roles
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(120), nullable=True)
    role = Column(String(50), default="OPERATOR", index=True)  # ADMIN, ENGINEER, OPERATOR, ANALYST
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)


# ---------------------------------------------------------------------------
# 2. Fleets
# ---------------------------------------------------------------------------
class Fleet(Base):
    __tablename__ = "fleets"

    id = Column(String(50), primary_key=True, default=lambda: f"FLT-{uuid.uuid4().hex[:8].upper()}")
    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    organization = Column(String(120), default="MALE Tactical Operations")
    base_station = Column(String(150), nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    is_deleted = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    assets = relationship("Asset", back_populates="fleet", foreign_keys="Asset.fleet_id")


# ---------------------------------------------------------------------------
# 3. Assets (UAVs / Industrial Machines)
# ---------------------------------------------------------------------------
class Asset(Base):
    __tablename__ = "assets"

    id = Column(String(50), primary_key=True)  # e.g. "UAV-01", "UAV-07"
    fleet_id = Column(String(50), ForeignKey("fleets.id", ondelete="SET NULL"), nullable=True, index=True)
    tail_number = Column(String(50), nullable=False, index=True)
    callsign = Column(String(80), nullable=False, index=True)
    airframe_model = Column(String(100), nullable=False)
    engine_model = Column(String(100), nullable=False)
    base_station = Column(String(150), nullable=False)
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    altitude_ft = Column(Float, default=0.0)
    flight_hours_ttsn = Column(Float, default=0.0)
    health_index = Column(Float, default=100.0)
    operational_status = Column(String(30), default="OPERATIONAL", index=True)  # OPERATIONAL, MAINTENANCE, STANDBY, OFFLINE
    active_mission = Column(String(100), nullable=True)
    pilot_in_command = Column(String(120), default="Unassigned")
    last_inspection = Column(String(50), nullable=True)
    next_due_hours = Column(Float, default=100.0)
    advisories_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    fleet = relationship("Fleet", back_populates="assets")
    sensors = relationship("Sensor", back_populates="asset", cascade="all, delete-orphan")
    readings = relationship("SensorReading", back_populates="asset")
    maintenance_records = relationship("MaintenanceRecord", back_populates="asset")
    alerts = relationship("AlertRecord", back_populates="asset")
    predictions = relationship("AIPredictionRecord", back_populates="asset")
    edge_devices = relationship("EdgeDevice", back_populates="asset")
    data_quality_events = relationship("DataQualityEvent", back_populates="asset")


# ---------------------------------------------------------------------------
# 4. Sensors
# ---------------------------------------------------------------------------
class Sensor(Base):
    __tablename__ = "sensors"

    id = Column(String(80), primary_key=True)  # e.g. "UAV-01-RPM", "UAV-07-CHT3"
    asset_id = Column(String(50), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    sensor_code = Column(String(50), nullable=False, index=True)  # RPM, CHT, EGT, OIL_PRESS, VIBRATION, FUEL_FLOW
    channel_name = Column(String(100), nullable=False)
    subsystem = Column(String(80), default="Core Propulsion")
    measurement_type = Column(String(50), nullable=False)  # TEMPERATURE, PRESSURE, SPEED, FLOW, ACCELERATION, VOLTAGE
    unit = Column(String(30), nullable=False)  # °C, RPM, bar, L/h, g, V, A, inHg
    nominal_min = Column(Float, nullable=True)
    nominal_max = Column(Float, nullable=True)
    sample_rate_hz = Column(Float, default=50.0)
    noise_sigma = Column(Float, default=0.1)
    quality_score = Column(Float, default=100.0)
    status = Column(String(30), default="HEALTHY", index=True)  # HEALTHY, STALE, DRIFTING, FLAGGED
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    asset = relationship("Asset", back_populates="sensors")
    readings = relationship("SensorReading", back_populates="sensor")

    __table_args__ = (
        UniqueConstraint("asset_id", "sensor_code", name="uq_asset_sensor_code"),
    )


# ---------------------------------------------------------------------------
# 5. Sensor Readings (Time-series observations)
# ---------------------------------------------------------------------------
class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    asset_id = Column(String(50), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    sensor_id = Column(String(80), ForeignKey("sensors.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    sensor_code = Column(String(50), nullable=True, index=True)
    reading_value = Column(Float, nullable=True)
    unit = Column(String(30), nullable=True)
    quality_flag = Column(String(20), default="VALID", index=True)  # VALID, DEGRADED, DROPOUT, DRIFT
    raw_payload = Column(Text, nullable=True)  # JSON representation of full packet
    idempotency_hash = Column(String(64), index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    asset = relationship("Asset", back_populates="readings")
    sensor = relationship("Sensor", back_populates="readings")

    __table_args__ = (
        Index("ix_readings_asset_time", "asset_id", "timestamp"),
        Index("ix_readings_sensor_time", "sensor_id", "timestamp"),
        Index("ix_readings_asset_code_time", "asset_id", "sensor_code", "timestamp"),
    )


# ---------------------------------------------------------------------------
# 6. Maintenance Records and Work Orders
# ---------------------------------------------------------------------------
class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(String(50), primary_key=True, default=lambda: f"TSK-{uuid.uuid4().hex[:6].upper()}")
    asset_id = Column(String(50), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True)
    task_order = Column(String(80), unique=True, index=True, nullable=False)
    title = Column(String(150), nullable=False)
    subsystem = Column(String(80), default="Propulsion Core")
    priority = Column(String(30), default="MEDIUM", index=True)  # CRITICAL, HIGH, MEDIUM, LOW
    advisory_text = Column(Text, nullable=True)
    evidence_triggers = Column(Text, nullable=True)  # JSON string array
    status = Column(String(30), default="OPEN", index=True)  # OPEN, IN_PROGRESS, CLOSED
    assigned_tech = Column(String(100), default="MALE Flight Line Team")
    easa_part_m_ref = Column(String(80), default="M.A.401")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    asset = relationship("Asset", back_populates="maintenance_records")


# ---------------------------------------------------------------------------
# 7. Alerts and Anomaly Records
# ---------------------------------------------------------------------------
class AlertRecord(Base):
    __tablename__ = "alert_records"

    id = Column(String(50), primary_key=True, default=lambda: f"ALT-{uuid.uuid4().hex[:6].upper()}")
    asset_id = Column(String(50), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True)
    engine_id = Column(String(50), default="AE-03", index=True)
    severity = Column(String(30), nullable=False, index=True)  # CRITICAL, WARNING, INFO
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    evidence = Column(Text, nullable=True)  # JSON or newline string
    acknowledged = Column(Boolean, default=False, index=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(100), nullable=True)
    source = Column(String(50), default="AI_FAULT_DETECTION")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationship
    asset = relationship("Asset", back_populates="alerts")


# ---------------------------------------------------------------------------
# 8. Edge AI Devices
# ---------------------------------------------------------------------------
class EdgeDevice(Base):
    __tablename__ = "edge_devices"

    id = Column(String(50), primary_key=True)  # e.g. "EDGE-NODE-01"
    asset_id = Column(String(50), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    ip_address = Column(String(50), nullable=True)
    can_node_id = Column(String(30), nullable=True)
    hardware = Column(String(100), default="NVIDIA Jetson Orin Nano (8GB)")
    status = Column(String(30), default="ONLINE", index=True)  # ONLINE, OFFLINE, ATTENTION
    cpu_util_pct = Column(Float, default=0.0)
    memory_used_gb = Column(Float, default=0.0)
    memory_total_gb = Column(Float, default=8.0)
    temperature_c = Column(Float, default=45.0)
    power_mode = Column(String(30), default="15W")
    telemetry_hz = Column(Integer, default=50)
    inference_batch_size = Column(Integer, default=1)
    anomaly_threshold = Column(Float, default=0.35)
    offline_buffer_hours = Column(Integer, default=24)
    active_models = Column(Text, nullable=True)  # JSON string array
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)
    uptime_hours = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationship
    asset = relationship("Asset", back_populates="edge_devices")


# ---------------------------------------------------------------------------
# 9. AI Predictions
# ---------------------------------------------------------------------------
class AIPredictionRecord(Base):
    __tablename__ = "ai_predictions"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    asset_id = Column(String(50), ForeignKey("assets.id", ondelete="CASCADE"), nullable=True, index=True)
    engine_id = Column(String(50), default="AE-03", index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    model_identifier = Column(String(80), default="AEROTWIN_X_CLASSIFIER", index=True)
    model_version = Column(String(50), default="v2.1-aerotwin")
    predicted_class = Column(String(60), default="NORMAL", index=True)
    confidence = Column(Float, default=95.0)
    anomaly_score = Column(Float, default=0.08)
    health_index = Column(Float, default=95.0)
    rul_hours = Column(Float, default=1284.0)
    supporting_features = Column(Text, nullable=True)  # JSON object
    root_cause_explanation = Column(Text, nullable=True)
    latency_ms = Column(Float, default=1.2)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship
    asset = relationship("Asset", back_populates="predictions")

    __table_args__ = (
        Index("ix_ai_pred_asset_time", "asset_id", "timestamp"),
    )


# ---------------------------------------------------------------------------
# 10. Data Quality Events & Incidents
# ---------------------------------------------------------------------------
class DataQualityEvent(Base):
    __tablename__ = "data_quality_events"

    id = Column(String(50), primary_key=True, default=lambda: f"INC-{uuid.uuid4().hex[:6].upper()}")
    asset_id = Column(String(50), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True)
    sensor_id = Column(String(80), ForeignKey("sensors.id", ondelete="SET NULL"), nullable=True, index=True)
    parameter = Column(String(80), nullable=False)
    severity = Column(String(30), default="WARNING", index=True)  # CRITICAL, WARNING, INFO
    rule_broken = Column(String(150), nullable=False)
    detected_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(30), default="OPEN", index=True)  # OPEN, INVESTIGATING, RESOLVED
    assigned_to = Column(String(100), default="Flight Systems Lead")
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationship
    asset = relationship("Asset", back_populates="data_quality_events")


# ---------------------------------------------------------------------------
# Legacy and Auxiliary Records for Backwards Compatibility
# ---------------------------------------------------------------------------
class MissionRecord(Base):
    __tablename__ = "mission_records"

    id = Column(String(50), primary_key=True)
    name = Column(String(120))
    uav_id = Column(String(50), default="UAV-01")
    engine_id = Column(String(50), default="AE-03")
    phase = Column(String(50), default="CRUISE")
    status = Column(String(50), default="ACTIVE")
    start_time = Column(String(50))
    end_time = Column(String(50), nullable=True)


class ModelRegistryRecord(Base):
    __tablename__ = "model_registry_records"

    id = Column(String(50), primary_key=True)
    name = Column(String(120))
    model_type = Column(String(80))
    version = Column(String(50))
    training_date = Column(String(50))
    metrics = Column(Text, nullable=True)  # JSON string
    status = Column(String(50), default="ACTIVE")


# Backward compatibility aliases
TelemetryRecord = SensorReading
PredictionRecord = AIPredictionRecord
