"""Telemetry and IoT Sensor Ingestion API Endpoints.

Handles live telemetry retrieval, edge observation ingestion, batch processing,
idempotency safeguards, and PostgreSQL time-series persistence.
"""
import hashlib
import json
import datetime
from fastapi import APIRouter, HTTPException, Query, Depends, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from ...database.connection import get_db, is_db_configured
from ...database.models import Asset, Sensor, SensorReading
from ..services.state_service import state_service
from ..schemas.telemetry import TelemetryPacket, TelemetryHistoryResponse
from ..schemas.fleet import IngestSensorPayload

router = APIRouter()


@router.get("/telemetry", response_model=TelemetryPacket)
async def get_current_telemetry():
    """Get most recent live telemetry packet."""
    if state_service.latest_telemetry:
        return state_service.latest_telemetry
    packet, _ = state_service.simulator.generate_step(0.1)
    return packet


@router.get("/telemetry/history", response_model=List[Dict[str, Any]])
async def get_telemetry_history(
    limit: int = Query(60, ge=1, le=600),
    asset_id: Optional[str] = Query(None, description="Optional asset filter")
):
    """Get moving window history of recent frames (from memory cache or DB)."""
    history_list = list(state_service.telemetry_history)
    if asset_id:
        aid = asset_id.strip().upper()
        history_list = [
            f for f in history_list
            if f.get("telemetry", {}).get("uav_id", "").upper() == aid
        ]
    return history_list[-limit:]


@router.post("/telemetry/ingest", status_code=status.HTTP_201_CREATED, tags=["IoT Ingestion"])
async def ingest_telemetry_packet(
    payload: TelemetryPacket,
    db: Session = Depends(get_db)
):
    """Ingest a live telemetry frame into PostgreSQL with idempotency safeguards."""
    asset_id = payload.uav_id.strip().upper()

    # 1. Ensure Asset exists in database
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.is_deleted == False).first()
    if not asset:
        # Create minimal asset record for newly discovered edge device
        now = datetime.datetime.now(datetime.timezone.utc)
        asset = Asset(
            id=asset_id,
            tail_number=f"Tail #{asset_id}",
            callsign=asset_id,
            airframe_model="Auto-Registered MALE UAV",
            engine_model=f"Rotax ({payload.engine_id})",
            base_station="Edge Ingestion Gateway",
            altitude_ft=payload.pressure_altitude,
            flight_hours_ttsn=0.0,
            health_index=100.0,
            operational_status="OPERATIONAL",
            active_mission="LIVE-INGEST",
            pilot_in_command="Autonomous Edge",
            is_deleted=False,
            created_at=now,
            updated_at=now
        )
        db.add(asset)
        db.flush()

    # 2. Parse Timestamp
    try:
        ts = datetime.datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
    except Exception:
        ts = datetime.datetime.now(datetime.timezone.utc)

    # 3. Compute Idempotency Hash (Asset + Timestamp + RPM + CHT)
    hash_str = f"{asset_id}_{payload.timestamp}_{payload.rpm:.2f}_{payload.cht:.2f}_{payload.egt:.2f}"
    idempotency_hash = hashlib.sha256(hash_str.encode("utf-8")).hexdigest()

    # Check for duplicate submission
    existing = db.query(SensorReading).filter(
        SensorReading.idempotency_hash == idempotency_hash
    ).first()

    if existing:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "DUPLICATE_IGNORED",
                "message": "Observation already persisted with identical timestamp and payload.",
                "reading_id": existing.id
            }
        )

    # 4. Map packet metrics to individual sensor channels
    metrics_map = {
        "RPM": (payload.rpm, "RPM"),
        "CHT": (payload.cht, "°C"),
        "EGT": (payload.egt, "°C"),
        "OIL_PRESS": (payload.oil_pressure, "bar"),
        "OIL_TEMP": (payload.oil_temperature, "°C"),
        "FUEL_FLOW": (payload.fuel_flow, "L/h"),
        "VIBRATION": (payload.vibration, "g"),
        "BATTERY_VOLT": (payload.battery_voltage, "V"),
        "MAP": (payload.manifold_pressure, "inHg"),
    }

    raw_json = json.dumps(payload.model_dump())
    created_readings = []

    for code, (val, unit) in metrics_map.items():
        sensor_id = f"{asset_id}-{code}"
        reading = SensorReading(
            asset_id=asset_id,
            sensor_id=sensor_id,
            timestamp=ts,
            sensor_code=code,
            reading_value=val,
            unit=unit,
            quality_flag=payload.quality or "VALID",
            raw_payload=raw_json,
            idempotency_hash=idempotency_hash if code == "RPM" else None,
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(reading)
        created_readings.append(reading)

    db.commit()

    return {
        "status": "SUCCESS",
        "asset_id": asset_id,
        "timestamp": ts.isoformat(),
        "channels_persisted": len(created_readings),
        "idempotency_hash": idempotency_hash
    }


@router.post("/telemetry/batch", status_code=status.HTTP_201_CREATED, tags=["IoT Ingestion"])
async def ingest_batch_observations(
    payload: IngestSensorPayload,
    db: Session = Depends(get_db)
):
    """Ingest key-value sensor observations from IoT edge concentrators."""
    asset_id = payload.asset_id.strip().upper()
    ts = payload.timestamp or datetime.datetime.now(datetime.timezone.utc)
    raw_json = json.dumps(payload.raw_packet) if payload.raw_packet else None

    inserted = 0
    for code, val in payload.readings.items():
        sensor_code = code.upper()
        sensor_id = f"{asset_id}-{sensor_code}"
        reading = SensorReading(
            asset_id=asset_id,
            sensor_id=sensor_id,
            timestamp=ts,
            sensor_code=sensor_code,
            reading_value=float(val),
            quality_flag=payload.quality_flag or "VALID",
            raw_payload=raw_json,
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(reading)
        inserted += 1

    db.commit()
    return {
        "status": "SUCCESS",
        "asset_id": asset_id,
        "observations_inserted": inserted,
        "timestamp": ts.isoformat()
    }
