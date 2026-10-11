"""Fleet Operations & Multi-Asset Digital Twin API Endpoints."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import datetime

router = APIRouter()

class UpdateAssetMetadataRequest(BaseModel):
    callsign: Optional[str] = None
    base_station: Optional[str] = None
    pilot_in_command: Optional[str] = None
    operational_status: Optional[str] = Field(None, description="OPERATIONAL, MAINTENANCE, STANDBY, OFFLINE")
    notes: Optional[str] = None

class FleetAsset(BaseModel):
    id: str
    tail_number: str
    callsign: str
    airframe_model: str
    engine_model: str
    base_station: str
    latitude: float
    longitude: float
    altitude_ft: float
    flight_hours_ttsn: float
    health_index: float
    operational_status: str # OPERATIONAL, MAINTENANCE, STANDBY, OFFLINE
    active_mission: Optional[str] = None
    pilot_in_command: str
    last_inspection: str
    next_due_hours: float
    advisories_count: int

class FleetAlertItem(BaseModel):
    id: str
    asset_id: str
    severity: str # CRITICAL, WARNING, INFO
    title: str
    message: str
    timestamp: str
    acknowledged: bool

FLEET_ASSETS: List[FleetAsset] = [
    FleetAsset(
        id="UAV-01",
        tail_number="Tail #601",
        callsign="Valkyrie-1",
        airframe_model="Hermes 900 MALE",
        engine_model="Rotax 914 Turbo",
        base_station="Forward Operating Base Alpha (Nevada)",
        latitude=36.241,
        longitude=-115.052,
        altitude_ft=18500.0,
        flight_hours_ttsn=2140.0,
        health_index=95.4,
        operational_status="OPERATIONAL",
        active_mission="MSN-2026-ALPHA",
        pilot_in_command="Capt. M. Larson",
        last_inspection="12-SEP-2024",
        next_due_hours=60.0,
        advisories_count=0
    ),
    FleetAsset(
        id="UAV-02",
        tail_number="Tail #602",
        callsign="Valkyrie-2",
        airframe_model="Hermes 900 MALE",
        engine_model="Rotax 914 Turbo",
        base_station="Forward Operating Base Alpha (Nevada)",
        latitude=36.512,
        longitude=-114.920,
        altitude_ft=16200.0,
        flight_hours_ttsn=1980.0,
        health_index=93.8,
        operational_status="OPERATIONAL",
        active_mission="MSN-2026-BRAVO",
        pilot_in_command="1st Lt. D. Rossi",
        last_inspection="28-AUG-2024",
        next_due_hours=120.0,
        advisories_count=0
    ),
    FleetAsset(
        id="UAV-03",
        tail_number="Tail #701",
        callsign="Spectre-1",
        airframe_model="Bayraktar TB2 Spec",
        engine_model="Rotax 915iSc Turbo",
        base_station="Hangar Bay 4 (Texas Depot)",
        latitude=31.182,
        longitude=-97.743,
        altitude_ft=0.0,
        flight_hours_ttsn=890.0,
        health_index=98.1,
        operational_status="STANDBY",
        active_mission=None,
        pilot_in_command="Maj. T. Henderson",
        last_inspection="04-OCT-2024",
        next_due_hours=210.0,
        advisories_count=0
    ),
    FleetAsset(
        id="UAV-04",
        tail_number="Tail #702",
        callsign="Spectre-2",
        airframe_model="Bayraktar TB2 Spec",
        engine_model="Rotax 915iSc Turbo",
        base_station="Naval Air Station Key West",
        latitude=24.555,
        longitude=-81.782,
        altitude_ft=12400.0,
        flight_hours_ttsn=1420.0,
        health_index=96.5,
        operational_status="OPERATIONAL",
        active_mission="MSN-COASTAL-SURV",
        pilot_in_command="Lt. Cdr. S. O'Connor",
        last_inspection="19-SEP-2024",
        next_due_hours=80.0,
        advisories_count=0
    ),
    FleetAsset(
        id="UAV-05",
        tail_number="Tail #801",
        callsign="Aegis-1",
        airframe_model="Hermes MALE Tactical",
        engine_model="Rotax 915iSc Turbo",
        base_station="Al Dhafra Air Base (Sector 4)",
        latitude=24.248,
        longitude=54.547,
        altitude_ft=21000.0,
        flight_hours_ttsn=620.0,
        health_index=99.0,
        operational_status="OPERATIONAL",
        active_mission="MSN-BORDER-RECON",
        pilot_in_command="Capt. H. Al-Maktoum",
        last_inspection="02-OCT-2024",
        next_due_hours=380.0,
        advisories_count=0
    ),
    FleetAsset(
        id="UAV-06",
        tail_number="Tail #503",
        callsign="Odin-3",
        airframe_model="MQ-1 Predator Spec",
        engine_model="Rotax 914 Turbo",
        base_station="Hangar Bay 2 (Depot Overhaul)",
        latitude=32.899,
        longitude=-97.040,
        altitude_ft=0.0,
        flight_hours_ttsn=2450.0,
        health_index=90.2,
        operational_status="MAINTENANCE",
        active_mission=None,
        pilot_in_command="Unassigned (Depot Bay)",
        last_inspection="08-OCT-2024",
        next_due_hours=0.0,
        advisories_count=2
    ),
    FleetAsset(
        id="UAV-07",
        tail_number="Tail #601-A",
        callsign="Hermes-Prime",
        airframe_model="Hermes MALE (High-Alt)",
        engine_model="Rotax 915iSc Turbo (AE-03)",
        base_station="GCS Central Command (Live Telemetry)",
        latitude=34.821,
        longitude=-116.892,
        altitude_ft=14500.0,
        flight_hours_ttsn=1842.6,
        health_index=92.0,
        operational_status="OPERATIONAL",
        active_mission="MSN-SIM-LIVE",
        pilot_in_command="GCS Autonomous Pilot",
        last_inspection="14-OCT-2024",
        next_due_hours=45.0,
        advisories_count=1
    ),
    FleetAsset(
        id="UAV-08",
        tail_number="Tail #802",
        callsign="Aegis-2",
        airframe_model="Hermes MALE Tactical",
        engine_model="Rotax 915iSc Turbo",
        base_station="Ramstein Air Base",
        latitude=49.437,
        longitude=7.600,
        altitude_ft=0.0,
        flight_hours_ttsn=1130.0,
        health_index=97.4,
        operational_status="STANDBY",
        active_mission=None,
        pilot_in_command="Capt. L. Weber",
        last_inspection="25-SEP-2024",
        next_due_hours=170.0,
        advisories_count=0
    )
]

FLEET_ALERTS: List[FleetAlertItem] = [
    FleetAlertItem(
        id="ALT-FLT-101",
        asset_id="UAV-07",
        severity="CRITICAL",
        title="Cylinder #3 Injector Degradation",
        message="Active CBM+ advisory: Fuel flow bias +0.50 L/h and EGT residual +18.0°C. Turnaround inspection required within 45h.",
        timestamp="14 min ago",
        acknowledged=False
    ),
    FleetAlertItem(
        id="ALT-FLT-102",
        asset_id="UAV-06",
        severity="WARNING",
        title="Depot Overhaul Threshold Reached",
        message="Aircraft reached 2,450 flight hours TTSN. Slipper clutch wear inspection due.",
        timestamp="2 hours ago",
        acknowledged=True
    ),
    FleetAlertItem(
        id="ALT-FLT-103",
        asset_id="UAV-01",
        severity="INFO",
        title="Routine Mission Checkpoint Passed",
        message="Waypoint WP-06 reached with 94% fuel endurance margin remaining.",
        timestamp="35 min ago",
        acknowledged=True
    )
]

@router.get("/fleet/summary")
async def get_fleet_summary():
    """Retrieve high-level fleet-wide asset operational KPIs."""
    total = len(FLEET_ASSETS)
    operational = sum(1 for a in FLEET_ASSETS if a.operational_status == "OPERATIONAL")
    maintenance = sum(1 for a in FLEET_ASSETS if a.operational_status in ["MAINTENANCE", "OFFLINE"])
    standby = sum(1 for a in FLEET_ASSETS if a.operational_status == "STANDBY")
    attention = sum(1 for a in FLEET_ASSETS if a.advisories_count > 0 or a.health_index < 93.0)
    
    total_hours = sum(a.flight_hours_ttsn for a in FLEET_ASSETS)
    avg_health = round(sum(a.health_index for a in FLEET_ASSETS) / total, 1)

    return {
        "total_assets": total,
        "operational_assets": operational,
        "offline_maintenance_assets": maintenance,
        "standby_assets": standby,
        "assets_requiring_attention": attention,
        "fleet_average_health": avg_health,
        "fleet_total_flight_hours": round(total_hours, 1),
        "active_fleet_missions": sum(1 for a in FLEET_ASSETS if a.active_mission)
    }

@router.get("/fleet/assets", response_model=List[FleetAsset])
async def list_fleet_assets(
    status: Optional[str] = Query(None, description="Filter by operational status: OPERATIONAL, MAINTENANCE, STANDBY, OFFLINE"),
    search: Optional[str] = Query(None, description="Search by callsign, tail number, or base")
):
    """Retrieve full inventory of fleet UAV assets with optional filters and search."""
    assets = list(FLEET_ASSETS)
    if status and status.upper() != "ALL":
        assets = [a for a in assets if a.operational_status.upper() == status.upper()]
    if search:
        s = search.lower()
        assets = [
            a for a in assets 
            if s in a.id.lower() or s in a.callsign.lower() or s in a.base_station.lower() or s in a.tail_number.lower()
        ]
    return assets

@router.get("/fleet/assets/{asset_id}", response_model=FleetAsset)
async def get_fleet_asset(asset_id: str):
    """Retrieve detailed specification and telemetry status for a single UAV asset."""
    for a in FLEET_ASSETS:
        if a.id.upper() == asset_id.upper() or a.callsign.lower() == asset_id.lower():
            return a
    raise HTTPException(status_code=404, detail="Fleet asset not found")

@router.put("/fleet/assets/{asset_id}", response_model=FleetAsset)
async def update_fleet_asset(asset_id: str, req: UpdateAssetMetadataRequest):
    """Update editable asset metadata (callsign, base station, pilot, operational status)."""
    for a in FLEET_ASSETS:
        if a.id.upper() == asset_id.upper():
            if req.callsign is not None:
                a.callsign = req.callsign.strip()
            if req.base_station is not None:
                a.base_station = req.base_station.strip()
            if req.pilot_in_command is not None:
                a.pilot_in_command = req.pilot_in_command.strip()
            if req.operational_status is not None:
                a.operational_status = req.operational_status.upper()
            return a
    raise HTTPException(status_code=404, detail="Fleet asset not found")

@router.get("/fleet/comparison")
async def get_fleet_comparison_matrix(
    asset_ids: Optional[str] = Query("UAV-01,UAV-03,UAV-07", description="Comma-separated asset IDs")
):
    """Retrieve multi-asset comparative telemetry and health matrices."""
    selected_ids = [aid.strip().upper() for aid in asset_ids.split(",") if aid.strip()]
    matched = [a for a in FLEET_ASSETS if a.id.upper() in selected_ids]
    if not matched:
        matched = FLEET_ASSETS[:3]

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

@router.get("/fleet/alerts", response_model=List[FleetAlertItem])
async def list_fleet_alerts():
    """Retrieve list of fleet-wide mission and condition alerts."""
    return FLEET_ALERTS

@router.post("/fleet/alerts/{alert_id}/acknowledge")
async def acknowledge_fleet_alert(alert_id: str):
    """Acknowledge a fleet alert."""
    for alt in FLEET_ALERTS:
        if alt.id == alert_id:
            alt.acknowledged = True
            return {"status": "SUCCESS", "message": f"Alert {alt.id} acknowledged.", "alert_id": alt.id}
    raise HTTPException(status_code=404, detail="Alert not found")
