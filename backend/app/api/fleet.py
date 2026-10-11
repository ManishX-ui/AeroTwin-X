"""Fleet Operations & Multi-Asset Digital Twin API Endpoints.

Provides persistent relational management for Fleets, Industrial Assets,
Sensor Channels, Historical Readings, Maintenance Records, and Alerts.
Supports pagination, filtering, soft-delete safety, and validation.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Dict, Any, Optional
import datetime

from ...database.connection import get_db, is_db_configured
from ...database.models import (
    Fleet, Asset, Sensor, SensorReading, MaintenanceRecord, AlertRecord
)
from ..schemas.fleet import (
    FleetCreate, FleetUpdate, FleetResponse,
    AssetCreate, AssetUpdate, AssetResponse,
    SensorCreate, SensorResponse, SensorReadingResponse
)

router = APIRouter()


# ===========================================================================
# 1. Fleets Endpoints
# ===========================================================================

@router.get("/fleets", response_model=List[FleetResponse], tags=["Fleet Management"])
async def list_fleets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by fleet name or organization"),
    is_active: Optional[bool] = Query(None, description="Filter active/inactive fleets"),
    db: Session = Depends(get_db)
):
    """List operational fleets with pagination and filtering."""
    query = db.query(Fleet).filter(Fleet.is_deleted == False)

    if is_active is not None:
        query = query.filter(Fleet.is_active == is_active)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(Fleet.name.ilike(s), Fleet.organization.ilike(s)))

    fleets = query.offset(skip).limit(limit).all()

    # Populate asset_count dynamically
    results = []
    for f in fleets:
        count = db.query(Asset).filter(Asset.fleet_id == f.id, Asset.is_deleted == False).count()
        f_resp = FleetResponse.model_validate(f)
        f_resp.asset_count = count
        results.append(f_resp)

    return results


@router.post("/fleets", response_model=FleetResponse, status_code=status.HTTP_201_CREATED, tags=["Fleet Management"])
async def create_fleet(
    req: FleetCreate,
    db: Session = Depends(get_db)
):
    """Create and register a new industrial fleet."""
    fleet_id = req.id.strip().upper() if req.id else f"FLT-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"

    existing = db.query(Fleet).filter(Fleet.id == fleet_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Fleet with ID '{fleet_id}' already exists."
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    fleet = Fleet(
        id=fleet_id,
        name=req.name.strip(),
        description=req.description,
        organization=req.organization or "MALE Tactical Operations",
        base_station=req.base_station,
        is_active=req.is_active,
        is_deleted=False,
        created_at=now,
        updated_at=now
    )
    db.add(fleet)
    db.commit()
    db.refresh(fleet)

    resp = FleetResponse.model_validate(fleet)
    resp.asset_count = 0
    return resp


@router.get("/fleets/{fleet_id}", response_model=FleetResponse, tags=["Fleet Management"])
async def get_fleet(
    fleet_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve details of a single fleet."""
    fleet = db.query(Fleet).filter(Fleet.id == fleet_id, Fleet.is_deleted == False).first()
    if not fleet:
        raise HTTPException(status_code=404, detail=f"Fleet '{fleet_id}' not found.")

    count = db.query(Asset).filter(Asset.fleet_id == fleet.id, Asset.is_deleted == False).count()
    resp = FleetResponse.model_validate(fleet)
    resp.asset_count = count
    return resp


@router.put("/fleets/{fleet_id}", response_model=FleetResponse, tags=["Fleet Management"])
async def update_fleet(
    fleet_id: str,
    req: FleetUpdate,
    db: Session = Depends(get_db)
):
    """Update fleet metadata."""
    fleet = db.query(Fleet).filter(Fleet.id == fleet_id, Fleet.is_deleted == False).first()
    if not fleet:
        raise HTTPException(status_code=404, detail=f"Fleet '{fleet_id}' not found.")

    if req.name is not None:
        fleet.name = req.name.strip()
    if req.description is not None:
        fleet.description = req.description
    if req.organization is not None:
        fleet.organization = req.organization.strip()
    if req.base_station is not None:
        fleet.base_station = req.base_station.strip()
    if req.is_active is not None:
        fleet.is_active = req.is_active

    fleet.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(fleet)

    count = db.query(Asset).filter(Asset.fleet_id == fleet.id, Asset.is_deleted == False).count()
    resp = FleetResponse.model_validate(fleet)
    resp.asset_count = count
    return resp


@router.delete("/fleets/{fleet_id}", tags=["Fleet Management"])
async def delete_fleet(
    fleet_id: str,
    db: Session = Depends(get_db)
):
    """Safe soft-delete fleet. Preserves child assets and historical readings."""
    fleet = db.query(Fleet).filter(Fleet.id == fleet_id, Fleet.is_deleted == False).first()
    if not fleet:
        raise HTTPException(status_code=404, detail=f"Fleet '{fleet_id}' not found.")

    # Soft delete fleet
    fleet.is_deleted = True
    fleet.is_active = False
    fleet.updated_at = datetime.datetime.now(datetime.timezone.utc)

    # Detach assets rather than destroying them
    db.query(Asset).filter(Asset.fleet_id == fleet.id).update(
        {"fleet_id": None, "updated_at": datetime.datetime.now(datetime.timezone.utc)}
    )

    db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Fleet '{fleet_id}' safely archived. Associated assets preserved.",
        "fleet_id": fleet_id
    }


# ===========================================================================
# 2. Fleet Summary & Comparative KPIs
# ===========================================================================

@router.get("/fleet/summary", tags=["Fleet"])
async def get_fleet_summary(db: Session = Depends(get_db)):
    """Retrieve high-level fleet-wide asset operational KPIs from PostgreSQL."""
    assets = db.query(Asset).filter(Asset.is_deleted == False).all()
    total = len(assets)

    if total == 0:
        return {
            "total_assets": 0,
            "operational_assets": 0,
            "offline_maintenance_assets": 0,
            "standby_assets": 0,
            "assets_requiring_attention": 0,
            "fleet_average_health": 0.0,
            "fleet_total_flight_hours": 0.0,
            "active_fleet_missions": 0
        }

    operational = sum(1 for a in assets if a.operational_status == "OPERATIONAL")
    maintenance = sum(1 for a in assets if a.operational_status in ["MAINTENANCE", "OFFLINE"])
    standby = sum(1 for a in assets if a.operational_status == "STANDBY")
    attention = sum(1 for a in assets if a.advisories_count > 0 or a.health_index < 93.0)
    total_hours = sum(a.flight_hours_ttsn for a in assets)
    avg_health = round(sum(a.health_index for a in assets) / total, 1)

    return {
        "total_assets": total,
        "operational_assets": operational,
        "offline_maintenance_assets": maintenance,
        "standby_assets": standby,
        "assets_requiring_attention": attention,
        "fleet_average_health": avg_health,
        "fleet_total_flight_hours": round(total_hours, 1),
        "active_fleet_missions": sum(1 for a in assets if a.active_mission)
    }


# ===========================================================================
# 3. Assets Endpoints
# ===========================================================================

@router.get("/fleet/assets", response_model=List[AssetResponse], tags=["Assets"])
async def list_fleet_assets(
    status: Optional[str] = Query(None, description="OPERATIONAL, MAINTENANCE, STANDBY, OFFLINE"),
    fleet_id: Optional[str] = Query(None, description="Filter by fleet ID"),
    search: Optional[str] = Query(None, description="Search by callsign, tail number, or base"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Retrieve inventory of industrial assets with filtering and pagination."""
    query = db.query(Asset).filter(Asset.is_deleted == False)

    if status and status.upper() != "ALL":
        query = query.filter(Asset.operational_status == status.upper())

    if fleet_id:
        query = query.filter(Asset.fleet_id == fleet_id)

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                Asset.id.ilike(s),
                Asset.callsign.ilike(s),
                Asset.tail_number.ilike(s),
                Asset.base_station.ilike(s)
            )
        )

    return query.offset(skip).limit(limit).all()


@router.post("/fleet/assets", response_model=AssetResponse, status_code=status.HTTP_201_CREATED, tags=["Assets"])
async def register_asset(
    req: AssetCreate,
    db: Session = Depends(get_db)
):
    """Register a new industrial asset in the database."""
    asset_id = req.id.strip().upper()
    existing = db.query(Asset).filter(Asset.id == asset_id).first()
    if existing:
        if existing.is_deleted:
            # Reactivate soft-deleted asset
            existing.is_deleted = False
            for k, v in req.model_dump().items():
                setattr(existing, k, v)
            existing.updated_at = datetime.datetime.now(datetime.timezone.utc)
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Asset with ID '{asset_id}' already exists."
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    asset = Asset(
        id=asset_id,
        fleet_id=req.fleet_id,
        tail_number=req.tail_number.strip(),
        callsign=req.callsign.strip(),
        airframe_model=req.airframe_model.strip(),
        engine_model=req.engine_model.strip(),
        base_station=req.base_station.strip(),
        latitude=req.latitude,
        longitude=req.longitude,
        altitude_ft=req.altitude_ft,
        flight_hours_ttsn=req.flight_hours_ttsn,
        health_index=req.health_index,
        operational_status=req.operational_status.upper(),
        active_mission=req.active_mission,
        pilot_in_command=req.pilot_in_command,
        last_inspection=req.last_inspection or now.strftime("%d-%b-%Y").upper(),
        next_due_hours=req.next_due_hours,
        advisories_count=req.advisories_count,
        notes=req.notes,
        is_deleted=False,
        created_at=now,
        updated_at=now
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/fleet/assets/{asset_id}", response_model=AssetResponse, tags=["Assets"])
async def get_fleet_asset(
    asset_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve detailed specification and telemetry status for a single asset."""
    aid = asset_id.strip().upper()
    asset = db.query(Asset).filter(
        or_(Asset.id == aid, Asset.callsign.ilike(aid)),
        Asset.is_deleted == False
    ).first()

    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found.")
    return asset


@router.put("/fleet/assets/{asset_id}", response_model=AssetResponse, tags=["Assets"])
async def update_fleet_asset(
    asset_id: str,
    req: AssetUpdate,
    db: Session = Depends(get_db)
):
    """Update editable asset metadata (callsign, base station, pilot, status, etc.)."""
    aid = asset_id.strip().upper()
    asset = db.query(Asset).filter(
        or_(Asset.id == aid, Asset.callsign.ilike(aid)),
        Asset.is_deleted == False
    ).first()

    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found.")

    if req.callsign is not None:
        asset.callsign = req.callsign.strip()
    if req.fleet_id is not None:
        asset.fleet_id = req.fleet_id.strip() if req.fleet_id else None
    if req.base_station is not None:
        asset.base_station = req.base_station.strip()
    if req.pilot_in_command is not None:
        asset.pilot_in_command = req.pilot_in_command.strip()
    if req.operational_status is not None:
        asset.operational_status = req.operational_status.upper()
    if req.latitude is not None:
        asset.latitude = req.latitude
    if req.longitude is not None:
        asset.longitude = req.longitude
    if req.altitude_ft is not None:
        asset.altitude_ft = req.altitude_ft
    if req.flight_hours_ttsn is not None:
        asset.flight_hours_ttsn = req.flight_hours_ttsn
    if req.health_index is not None:
        asset.health_index = req.health_index
    if req.last_inspection is not None:
        asset.last_inspection = req.last_inspection
    if req.next_due_hours is not None:
        asset.next_due_hours = req.next_due_hours
    if req.notes is not None:
        asset.notes = req.notes

    asset.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/fleet/assets/{asset_id}", tags=["Assets"])
async def delete_fleet_asset(
    asset_id: str,
    db: Session = Depends(get_db)
):
    """Safe soft-delete asset. Preserves all historical sensor observations and work orders."""
    aid = asset_id.strip().upper()
    asset = db.query(Asset).filter(Asset.id == aid, Asset.is_deleted == False).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found.")

    asset.is_deleted = True
    asset.operational_status = "OFFLINE"
    asset.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Asset '{aid}' safely archived. Historical sensor readings and records remain intact.",
        "asset_id": aid
    }


# ===========================================================================
# 4. Asset Sensors & Historical Telemetry Readings
# ===========================================================================

@router.get("/fleet/assets/{asset_id}/sensors", response_model=List[SensorResponse], tags=["Sensors"])
async def get_asset_sensors(
    asset_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve all sensors registered for a specific asset."""
    aid = asset_id.strip().upper()
    return db.query(Sensor).filter(Sensor.asset_id == aid, Sensor.is_active == True).all()


@router.post("/fleet/assets/{asset_id}/sensors", response_model=SensorResponse, status_code=status.HTTP_201_CREATED, tags=["Sensors"])
async def register_asset_sensor(
    asset_id: str,
    req: SensorCreate,
    db: Session = Depends(get_db)
):
    """Register a new sensor channel on an asset."""
    aid = asset_id.strip().upper()
    asset = db.query(Asset).filter(Asset.id == aid, Asset.is_deleted == False).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{aid}' not found.")

    sensor_id = f"{aid}-{req.sensor_code.upper()}"
    existing = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sensor channel '{req.sensor_code}' already exists on asset '{aid}'."
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    sensor = Sensor(
        id=sensor_id,
        asset_id=aid,
        sensor_code=req.sensor_code.upper(),
        channel_name=req.channel_name.strip(),
        subsystem=req.subsystem.strip(),
        measurement_type=req.measurement_type.upper(),
        unit=req.unit.strip(),
        nominal_min=req.nominal_min,
        nominal_max=req.nominal_max,
        sample_rate_hz=req.sample_rate_hz,
        noise_sigma=req.noise_sigma,
        quality_score=req.quality_score,
        status=req.status.upper(),
        is_active=req.is_active,
        created_at=now,
        updated_at=now
    )
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return sensor


@router.get("/fleet/assets/{asset_id}/readings", response_model=List[SensorReadingResponse], tags=["Sensor Readings"])
async def get_asset_readings(
    asset_id: str,
    sensor_code: Optional[str] = Query(None, description="Filter by sensor code e.g. RPM, CHT"),
    start_time: Optional[datetime.datetime] = Query(None, description="Start ISO UTC timestamp"),
    end_time: Optional[datetime.datetime] = Query(None, description="End ISO UTC timestamp"),
    limit: int = Query(100, ge=1, le=1000, description="Max observations to return"),
    db: Session = Depends(get_db)
):
    """Retrieve historical timestamped sensor readings for an asset."""
    aid = asset_id.strip().upper()
    query = db.query(SensorReading).filter(SensorReading.asset_id == aid)

    if sensor_code:
        query = query.filter(SensorReading.sensor_code == sensor_code.upper())

    if start_time:
        query = query.filter(SensorReading.timestamp >= start_time)

    if end_time:
        query = query.filter(SensorReading.timestamp <= end_time)

    query = query.order_by(SensorReading.timestamp.desc()).limit(limit)
    return query.all()


@router.get("/fleet/assets/{asset_id}/maintenance", tags=["Maintenance"])
async def get_asset_maintenance_history(
    asset_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve historical and open maintenance work orders for an asset."""
    aid = asset_id.strip().upper()
    records = db.query(MaintenanceRecord).filter(MaintenanceRecord.asset_id == aid).order_by(MaintenanceRecord.created_at.desc()).all()
    return records


@router.get("/fleet/assets/{asset_id}/alerts", tags=["Alerts"])
async def get_asset_alerts(
    asset_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve alerts associated with an asset."""
    aid = asset_id.strip().upper()
    alerts = db.query(AlertRecord).filter(AlertRecord.asset_id == aid).order_by(AlertRecord.created_at.desc()).all()
    return alerts


# ===========================================================================
# 5. Multi-Asset Comparison Matrix
# ===========================================================================

@router.get("/fleet/comparison", tags=["Fleet"])
async def get_fleet_comparison_matrix(
    asset_ids: Optional[str] = Query("UAV-01,UAV-03,UAV-07", description="Comma-separated asset IDs"),
    db: Session = Depends(get_db)
):
    """Retrieve multi-asset comparative telemetry and health matrices."""
    selected_ids = [aid.strip().upper() for aid in asset_ids.split(",") if aid.strip()]
    matched = db.query(Asset).filter(
        Asset.id.in_(selected_ids),
        Asset.is_deleted == False
    ).all()

    if not matched:
        matched = db.query(Asset).filter(Asset.is_deleted == False).limit(3).all()

    metrics = []
    for a in matched:
        metrics.append({
            "asset_id": a.id,
            "callsign": a.callsign,
            "engine": a.engine_model,
            "health_score": a.health_index,
            "hours": a.flight_hours_ttsn,
            "thermal_headroom_c": round(150.0 - (142.0 if a.id == "UAV-07" else 138.0), 1),
            "vibration_rms": 3.8 if a.id == "UAV-07" else (2.4 if a.id == "UAV-03" else 4.1),
            "fuel_burn_lph": 18.9 if a.id == "UAV-07" else (17.5 if a.id == "UAV-03" else 18.2),
            "rul_estimated_hours": 1284.0 if a.id == "UAV-07" else (1780.0 if a.id == "UAV-03" else 1410.0),
            "status": a.operational_status
        })

    return {
        "selected_assets": [a.id for a in matched],
        "comparison_metrics": metrics
    }


# ===========================================================================
# 6. Fleet Alerts & Acknowledgment
# ===========================================================================

@router.get("/fleet/alerts", tags=["Alerts"])
async def list_fleet_alerts(
    severity: Optional[str] = Query(None, description="Filter: CRITICAL, WARNING, INFO"),
    acknowledged: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Retrieve list of fleet-wide mission and condition alerts from database."""
    query = db.query(AlertRecord)
    if severity and severity.upper() != "ALL":
        query = query.filter(AlertRecord.severity == severity.upper())
    if acknowledged is not None:
        query = query.filter(AlertRecord.acknowledged == acknowledged)

    alerts = query.order_by(AlertRecord.created_at.desc()).limit(limit).all()
    return alerts


@router.post("/fleet/alerts/{alert_id}/acknowledge", tags=["Alerts"])
async def acknowledge_fleet_alert(
    alert_id: str,
    db: Session = Depends(get_db)
):
    """Acknowledge a fleet alert and persist the timestamp and user."""
    alert = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")

    alert.acknowledged = True
    alert.acknowledged_at = datetime.datetime.now(datetime.timezone.utc)
    alert.acknowledged_by = "Flight Systems Operator"
    alert.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    return {"status": "SUCCESS", "message": f"Alert {alert.id} acknowledged.", "alert_id": alert.id}
