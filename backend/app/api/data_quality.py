"""Sensor Data Quality & Observability API Endpoints."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import datetime
import uuid

router = APIRouter()

class UpdateIncidentRequest(BaseModel):
    status: Optional[str] = Field(None, description="OPEN, INVESTIGATING, RESOLVED")
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None

class ResolveIncidentRequest(BaseModel):
    resolution_notes: str = Field(..., description="Details of corrective action taken or calibration performed")
    resolved_by: str = Field("Flight Systems Lead", description="Certifying engineer")

class SensorQualityItem(BaseModel):
    sensor_id: str
    channel_name: str
    subsystem: str
    unit: str
    nominal_range: str
    sample_rate_hz: int
    noise_sigma: float
    drift_score: float
    error_count_24h: int
    quality_score: float # 0 to 100
    status: str # HEALTHY, STALE, DRIFTING, FLAGGED
    last_reading: str

class QualityIncident(BaseModel):
    id: str
    sensor_id: str
    parameter: str
    severity: str # CRITICAL, WARNING, INFO
    rule_broken: str
    detected_at: str
    status: str # OPEN, INVESTIGATING, RESOLVED
    assigned_to: str
    resolution_notes: Optional[str] = None

SENSOR_MATRIX: List[SensorQualityItem] = [
    SensorQualityItem(
        sensor_id="CHT-03",
        channel_name="Cylinder #3 Head Temp",
        subsystem="Thermal & Combustion",
        unit="°C",
        nominal_range="110.0 - 150.0",
        sample_rate_hz=50,
        noise_sigma=0.32,
        drift_score=0.88,
        error_count_24h=14,
        quality_score=86.5,
        status="FLAGGED",
        last_reading="145.2 °C (Active Bias)"
    ),
    SensorQualityItem(
        sensor_id="EGT-03",
        channel_name="Cylinder #3 Exhaust Gas Temp",
        subsystem="Thermal & Combustion",
        unit="°C",
        nominal_range="750.0 - 860.0",
        sample_rate_hz=50,
        noise_sigma=0.45,
        drift_score=0.92,
        error_count_24h=8,
        quality_score=84.0,
        status="FLAGGED",
        last_reading="834.0 °C (+18.0°C residual)"
    ),
    SensorQualityItem(
        sensor_id="FF-01",
        channel_name="Primary High-Pressure Fuel Flow",
        subsystem="Fuel & Metering",
        unit="L/h",
        nominal_range="14.0 - 26.0",
        sample_rate_hz=50,
        noise_sigma=0.12,
        drift_score=0.41,
        error_count_24h=3,
        quality_score=91.0,
        status="DRIFTING",
        last_reading="19.4 L/h (+0.50 L/h bias)"
    ),
    SensorQualityItem(
        sensor_id="OIL-PRES-01",
        channel_name="Main Oil Gallery Pressure",
        subsystem="Lubrication & Gearbox",
        unit="bar",
        nominal_range="2.5 - 5.5",
        sample_rate_hz=50,
        noise_sigma=0.04,
        drift_score=0.05,
        error_count_24h=0,
        quality_score=99.2,
        status="HEALTHY",
        last_reading="4.35 bar (Nominal)"
    ),
    SensorQualityItem(
        sensor_id="OIL-TEMP-01",
        channel_name="Sump Oil Temperature",
        subsystem="Lubrication & Gearbox",
        unit="°C",
        nominal_range="70.0 - 110.0",
        sample_rate_hz=50,
        noise_sigma=0.08,
        drift_score=0.06,
        error_count_24h=0,
        quality_score=98.8,
        status="HEALTHY",
        last_reading="88.4 °C (Nominal)"
    ),
    SensorQualityItem(
        sensor_id="MAP-01",
        channel_name="Manifold Absolute Pressure",
        subsystem="Propulsion Core",
        unit="inHg",
        nominal_range="25.0 - 42.0",
        sample_rate_hz=50,
        noise_sigma=0.05,
        drift_score=0.03,
        error_count_24h=0,
        quality_score=99.5,
        status="HEALTHY",
        last_reading="34.8 inHg (Boosted)"
    ),
    SensorQualityItem(
        sensor_id="VIB-01",
        channel_name="Gearbox Case Accelerometer",
        subsystem="Propulsion Core",
        unit="mm/s RMS",
        nominal_range="0.0 - 12.0",
        sample_rate_hz=100,
        noise_sigma=0.18,
        drift_score=0.11,
        error_count_24h=1,
        quality_score=96.0,
        status="HEALTHY",
        last_reading="3.8 mm/s RMS (Nominal)"
    ),
    SensorQualityItem(
        sensor_id="AUX-TEMP-02",
        channel_name="Alternator Bearing Temp",
        subsystem="Electrical & Auxiliary",
        unit="°C",
        nominal_range="40.0 - 95.0",
        sample_rate_hz=10,
        noise_sigma=0.00,
        drift_score=0.00,
        error_count_24h=52,
        quality_score=62.0,
        status="STALE",
        last_reading="54.0 °C (Unchanging >180s)"
    )
]

INCIDENTS_DB: List[QualityIncident] = [
    QualityIncident(
        id="INC-DQ-091",
        sensor_id="AUX-TEMP-02",
        parameter="Alternator Bearing Temperature",
        severity="WARNING",
        rule_broken="Zero-Variance Frozen Telemetry (>180 sec constant value)",
        detected_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=45)).isoformat(),
        status="OPEN",
        assigned_to="Avionics Telemetry Team",
        resolution_notes="Awaiting line sensor connector continuity inspection."
    ),
    QualityIncident(
        id="INC-DQ-090",
        sensor_id="EGT-03",
        parameter="Exhaust Gas Temperature #3",
        severity="CRITICAL",
        rule_broken="Multivariate Physics Correlation Violation (+18°C above ODE)",
        detected_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2)).isoformat(),
        status="INVESTIGATING",
        assigned_to="Senior Propulsion Engineer",
        resolution_notes="Linked to CBM work order WO-2026-042 (Cylinder #3 injector coking)."
    ),
    QualityIncident(
        id="INC-DQ-089",
        sensor_id="FF-01",
        parameter="Fuel Flow Primary",
        severity="INFO",
        rule_broken="Calibration Curve Delta (+0.50 L/h positive offset)",
        detected_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)).isoformat(),
        status="RESOLVED",
        assigned_to="Calibration Technician",
        resolution_notes="Recalibrated flowmeter sensor polynomial offset in CAN gateway."
    )
]

@router.get("/data-quality/summary")
async def get_data_quality_summary():
    """Retrieve sensor data completeness, missing counts, validation errors, and quality KPIs."""
    total_sensors = len(SENSOR_MATRIX)
    healthy = sum(1 for s in SENSOR_MATRIX if s.status == "HEALTHY")
    stale = sum(1 for s in SENSOR_MATRIX if s.status == "STALE")
    flagged = sum(1 for s in SENSOR_MATRIX if s.status in ["FLAGGED", "DRIFTING"])
    
    missing_count = sum(s.error_count_24h for s in SENSOR_MATRIX)
    
    return {
        "completeness_score_pct": 99.2,
        "missing_readings_count": 14,
        "invalid_readings_count": 3,
        "duplicate_observations_count": 0,
        "stale_sensors_count": stale,
        "overall_quality_grade": "A- (93.8%)",
        "total_active_sensors": total_sensors,
        "healthy_sensors": healthy,
        "flagged_sensors": flagged,
        "validation_pipeline_state": "ACTIVE_SYNCHRONIZED"
    }

@router.get("/data-quality/sensors", response_model=List[SensorQualityItem])
async def list_sensor_quality_matrix(
    status: Optional[str] = Query(None, description="Filter by status: HEALTHY, STALE, DRIFTING, FLAGGED"),
    subsystem: Optional[str] = Query(None, description="Filter by subsystem")
):
    """Retrieve the 8-sensor Data Quality Matrix table with optional status/subsystem filters."""
    sensors = list(SENSOR_MATRIX)
    if status and status.upper() != "ALL":
        sensors = [s for s in sensors if s.status.upper() == status.upper()]
    if subsystem and subsystem.upper() != "ALL":
        sensors = [s for s in sensors if subsystem.lower() in s.subsystem.lower()]
    return sensors

@router.get("/data-quality/comparison")
async def get_raw_vs_validated_comparison(
    sensor_id: str = Query("CHT-03", description="Target sensor ID")
):
    """Retrieve raw versus physics-validated time-series data for comparison charting."""
    sensor = next((s for s in SENSOR_MATRIX if s.sensor_id == sensor_id), SENSOR_MATRIX[0])
    
    # Generate representative time-series curve based on selected sensor
    points = []
    base_val = 142.0 if "CHT" in sensor.sensor_id else (820.0 if "EGT" in sensor.sensor_id else (4.3 if "OIL" in sensor.sensor_id else 18.5))
    
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    for i in range(20):
        t_str = (now_dt - datetime.timedelta(seconds=(20 - i) * 5)).strftime("%H:%M:%S")
        noise = (i % 3 - 1) * 0.8
        spike = 4.2 if (i == 14 and sensor.status == "FLAGGED") else 0.0
        raw_val = round(base_val + noise + spike, 2)
        # Physics validated removes spike and filters noise
        validated_val = round(base_val + ((i / 20.0) * 0.5), 2)
        
        outcome = "FLAGGED_SPIKE" if spike > 0 else "VALIDATED_PASS"
        points.append({
            "timestamp": t_str,
            "raw_value": raw_val,
            "validated_value": validated_val,
            "unit": sensor.unit,
            "delta": round(raw_val - validated_val, 2),
            "outcome": outcome
        })

    return {
        "sensor_id": sensor.sensor_id,
        "channel_name": sensor.channel_name,
        "unit": sensor.unit,
        "quality_score": sensor.quality_score,
        "status": sensor.status,
        "observations": points
    }

@router.get("/data-quality/incidents", response_model=List[QualityIncident])
async def list_quality_incidents(
    status: Optional[str] = Query(None, description="Filter by status: OPEN, INVESTIGATING, RESOLVED")
):
    """Retrieve log of data-quality incidents and anomalies."""
    incidents = list(INCIDENTS_DB)
    if status and status.upper() != "ALL":
        incidents = [inc for inc in incidents if inc.status.upper() == status.upper()]
    return incidents

@router.put("/data-quality/incidents/{incident_id}", response_model=QualityIncident)
async def update_quality_incident(incident_id: str, req: UpdateIncidentRequest):
    """Update assigned technician, status, or notes on a data quality incident."""
    for inc in INCIDENTS_DB:
        if inc.id == incident_id:
            if req.status is not None:
                inc.status = req.status.upper()
            if req.assigned_to is not None:
                inc.assigned_to = req.assigned_to.strip()
            if req.resolution_notes is not None:
                inc.resolution_notes = req.resolution_notes.strip()
            return inc
    raise HTTPException(status_code=404, detail="Incident not found")

@router.post("/data-quality/incidents/{incident_id}/resolve", response_model=QualityIncident)
async def resolve_quality_incident(incident_id: str, req: ResolveIncidentRequest):
    """Resolve a sensor data quality incident and record resolution findings."""
    for inc in INCIDENTS_DB:
        if inc.id == incident_id:
            inc.status = "RESOLVED"
            inc.resolution_notes = f"{req.resolution_notes.strip()} [Resolved by: {req.resolved_by}]"
            return inc
    raise HTTPException(status_code=404, detail="Incident not found")
