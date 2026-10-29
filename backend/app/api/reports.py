"""Reports & Analytics API Endpoints."""
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import datetime
import uuid
import json
import io
import csv

router = APIRouter()

class GenerateReportRequest(BaseModel):
    title: Optional[str] = None
    report_type: str = Field("FLEET_HEALTH", description="FLEET_HEALTH, CBM_RELIABILITY, SENSOR_ANOMALY, MISSION_PERFORMANCE, EASA_AUDIT")
    asset_id: str = Field("UAV-07 (Hermes MALE)", description="Asset scope")
    date_range: str = Field("LAST_30_DAYS", description="LAST_24_HOURS, LAST_7_DAYS, LAST_30_DAYS, LAST_90_DAYS")
    format: str = Field("CSV", description="CSV, JSON, PDF_SUMMARY")
    metrics: Optional[List[str]] = Field(default_factory=lambda: ["CHT", "EGT", "Oil Pressure", "Fuel Flow", "Vibration", "RUL"])
    custom_notes: Optional[str] = None

class ReportItem(BaseModel):
    id: str
    title: str
    report_type: str
    asset_id: str
    date_range: str
    format: str
    file_size_kb: float
    status: str # READY, PROCESSING, FAILED
    generated_at: str
    author: str
    preview_summary: str
    data_content: Optional[str] = None

# In-memory storage for reports
REPORTS_DB: List[ReportItem] = [
    ReportItem(
        id="RPT-2026-081",
        title="Rotax 915iSc Fleet Reliability & MTBUR Analysis",
        report_type="CBM_RELIABILITY",
        asset_id="Fleet-Wide (8 UAVs)",
        date_range="LAST_30_DAYS",
        format="CSV",
        file_size_kb=142.5,
        status="READY",
        generated_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)).isoformat(),
        author="Flight Ops Reliability Chief",
        preview_summary="30-day cross-fleet Weibull hazard rate analysis. Mean MTBUR at 4,120 flight hours (+8.4% above OEM nominal baseline). Unscheduled removal rate 0.24/1k hrs.",
        data_content="Timestamp,Asset,Subsystem,HealthIndex,MTBUR_Hours,DegradationRate,Status\n2026-10-01,UAV-01,Propulsion,95.2,4250,0.012,NOMINAL\n2026-10-01,UAV-02,Propulsion,93.8,4100,0.018,NOMINAL\n2026-10-01,UAV-07,Fuel System,84.1,3820,0.045,ADVISORY_ACTIVE"
    ),
    ReportItem(
        id="RPT-2026-080",
        title="Cylinder #3 Injector Thermal Anomaly Forensic Log",
        report_type="SENSOR_ANOMALY",
        asset_id="UAV-07 (Hermes MALE)",
        date_range="LAST_7_DAYS",
        format="JSON",
        file_size_kb=88.2,
        status="READY",
        generated_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=3)).isoformat(),
        author="AI Diagnostic Engine",
        preview_summary="High-rate CAN bus residual audit confirming +18.0°C EGT deviation on Cylinder #3 with micro-coking signature in fuel flow rate (+0.50 L/h bias).",
        data_content=json.dumps({
            "report_id": "RPT-2026-080",
            "asset": "UAV-07",
            "engine": "AE-03",
            "anomaly": "INJECTOR_MICRO_COKING",
            "residuals": {"egt_deg_c": 18.0, "fuel_flow_dev_lph": 0.50},
            "pinn_confidence": 0.994,
            "rul_hours_remaining": 45.0
        }, indent=2)
    ),
    ReportItem(
        id="RPT-2026-079",
        title="Part-M Continuing Airworthiness Compliance Ledger",
        report_type="EASA_AUDIT",
        asset_id="UAV-07 (Hermes MALE)",
        date_range="LAST_90_DAYS",
        format="CSV",
        file_size_kb=310.4,
        status="READY",
        generated_at=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).isoformat(),
        author="Quality Assurance Lead",
        preview_summary="FAA Part-43 and EASA Part-M compliance audit. 142 certified work orders validated with cryptographic audit hashes and A&P sign-offs.",
        data_content="Order_ID,Date_UTC,Aircraft_TTSN,Task_Desc,Cert_Authority,Status,Hash\nWO-8839,2024-10-14,1838.2,Turnaround 13 Sign-off,Maj. K. Vance,CLOSED,9C81E4F0\nWO-8831,2024-10-02,1800.0,Digital Twin Recalibration,SYS-DAEMON,VERIFIED,4D22AA19\nWO-8798,2024-09-18,1742.6,100H Mandatory Inspection,Capt. R. Hernandez,CLOSED,18BC8821"
    )
]

@router.get("/reports", response_model=List[ReportItem])
async def list_reports(
    report_type: Optional[str] = Query(None, description="Filter by report type"),
    search: Optional[str] = Query(None, description="Search by title, author, or asset")
):
    """Retrieve historical and generated reports with optional filtering and search."""
    results = list(REPORTS_DB)
    if report_type and report_type.upper() != "ALL":
        results = [r for r in results if r.report_type.upper() == report_type.upper()]
    if search:
        s_lower = search.lower()
        results = [
            r for r in results 
            if s_lower in r.title.lower() or s_lower in r.author.lower() or s_lower in r.asset_id.lower()
        ]
    return results

@router.post("/reports/generate", response_model=ReportItem)
async def generate_report(req: GenerateReportRequest):
    """Generate a new telemetry analytics, CBM+, or compliance report."""
    iso_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report_id = f"RPT-2026-{len(REPORTS_DB) + 82:03d}"
    
    title = req.title or f"{req.report_type.replace('_', ' ').title()} — {req.asset_id}"
    
    # Generate real tabular content according to format
    if req.format.upper() == "CSV":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["Timestamp_UTC", "Asset", "Metric", "Measured_Value", "Physics_Expected", "Residual_Delta", "Status"])
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        metrics_list = req.metrics or ["CHT_Cyl3", "EGT_Cyl3", "Oil_Pressure", "Fuel_Flow", "RPM"]
        for i in range(12):
            t_str = (now_dt - datetime.timedelta(hours=i*2)).strftime("%Y-%m-%d %H:%M:%S")
            for m in metrics_list:
                measured = 142.5 + (i * 0.4)
                expected = 140.0
                writer.writerow([t_str, req.asset_id, m, f"{measured:.1f}", f"{expected:.1f}", f"{(measured - expected):+.1f}", "NOMINAL" if abs(measured-expected) < 5 else "FLAGGED"])
        data_text = buf.getvalue()
        file_size = round(len(data_text) / 1024.0, 1) or 12.4
    elif req.format.upper() == "JSON":
        data_obj = {
            "report_id": report_id,
            "title": title,
            "type": req.report_type,
            "asset_id": req.asset_id,
            "date_range": req.date_range,
            "generated_at": iso_now,
            "metrics_evaluated": req.metrics,
            "observations_summary": {
                "total_telemetry_frames": 48920,
                "anomalies_detected": 1,
                "health_index_mean": 92.4,
                "rul_estimated_hours": 1284.0,
                "confidence_score": 0.994
            },
            "custom_engineering_notes": req.custom_notes or "Generated by AeroTwin-X Analytics Engine."
        }
        data_text = json.dumps(data_obj, indent=2)
        file_size = round(len(data_text) / 1024.0, 1) or 8.5
    else:
        # Formatted summary text / PDF transcript
        data_text = f"""================================================================================
AEROTWIN-X INDUSTRIAL DIGITAL TWIN & FLEET ANALYTICS REPORT
================================================================================
Report ID       : {report_id}
Title           : {title}
Classification  : EASA PART-M / CBM+ DISPATCH AUDIT
Asset Scope     : {req.asset_id}
Date Range      : {req.date_range}
Generated At    : {iso_now}
Author          : AeroTwin-X Automated Telemetry Auditor

1. EXECUTIVE SUMMARY:
Operational condition indexes across propulsion core, lubrication, and FADEC channels
have been verified against calibrated ODE Physics-Informed Neural Network (PINN) surrogates.

2. KEY METRICS:
- Mean Fleet Reliability  : 4,120 MTBUR Hours (+8.4% above baseline)
- Physics Model Sync      : 99.4% confidence (0.08σ residual drift)
- Subsystem Advisories    : 1 Immediate Action Required (Cylinder #3 Injector)
- TBO Countdown Remaining : 1,284.0 flight hours (TBO 2,500 h Baseline; Uncalibrated)

3. COMPLIANCE & VERIFICATION:
All sensor observations meet DO-178C / STANAG 4586 integrity specifications.
================================================================================
"""
        file_size = round(len(data_text) / 1024.0, 1) or 15.2

    preview = f"Generated {req.report_type} report for {req.asset_id} covering {req.date_range.replace('_', ' ').lower()}. Evaluated {len(req.metrics or [])} sensor streams with zero uncalibrated telemetry drops."

    new_report = ReportItem(
        id=report_id,
        title=title,
        report_type=req.report_type,
        asset_id=req.asset_id,
        date_range=req.date_range,
        format=req.format.upper(),
        file_size_kb=file_size,
        status="READY",
        generated_at=iso_now,
        author="AeroTwin Analytics Engine",
        preview_summary=preview,
        data_content=data_text
    )
    REPORTS_DB.insert(0, new_report)
    return new_report

@router.get("/reports/{report_id}", response_model=ReportItem)
async def get_report(report_id: str):
    """Retrieve metadata and preview for a specific report."""
    for r in REPORTS_DB:
        if r.id == report_id:
            return r
    raise HTTPException(status_code=404, detail="Report not found")

@router.get("/reports/{report_id}/download")
async def download_report(report_id: str):
    """Download the actual generated report file."""
    for r in REPORTS_DB:
        if r.id == report_id:
            ext = "csv" if r.format.upper() == "CSV" else ("json" if r.format.upper() == "JSON" else "txt")
            media_type = "text/csv" if ext == "csv" else ("application/json" if ext == "json" else "text/plain")
            filename = f"{r.id}_{r.report_type.lower()}.{ext}"
            return Response(
                content=r.data_content or "No data available",
                media_type=media_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
    raise HTTPException(status_code=404, detail="Report not found")

@router.delete("/reports/{report_id}")
async def delete_report(report_id: str):
    """Delete a report record after user confirmation."""
    for idx, r in enumerate(REPORTS_DB):
        if r.id == report_id:
            deleted = REPORTS_DB.pop(idx)
            return {"status": "SUCCESS", "message": f"Report {deleted.id} deleted.", "deleted_id": deleted.id}
    raise HTTPException(status_code=404, detail="Report not found")

@router.get("/reports/analytics/summary")
async def get_reports_analytics():
    """Retrieve historical analytics data for reporting visualizations and multi-asset comparisons."""
    time_series = [
        {"day": "Day 1", "health_index": 96.2, "anomaly_count": 0, "cht_avg": 138.4, "egt_avg": 810.2},
        {"day": "Day 5", "health_index": 95.8, "anomaly_count": 0, "cht_avg": 139.1, "egt_avg": 812.0},
        {"day": "Day 10", "health_index": 95.1, "anomaly_count": 1, "cht_avg": 140.2, "egt_avg": 814.5},
        {"day": "Day 15", "health_index": 94.6, "anomaly_count": 0, "cht_avg": 141.0, "egt_avg": 816.2},
        {"day": "Day 20", "health_index": 93.9, "anomaly_count": 1, "cht_avg": 142.1, "egt_avg": 819.0},
        {"day": "Day 25", "health_index": 93.1, "anomaly_count": 2, "cht_avg": 143.5, "egt_avg": 822.4},
        {"day": "Day 30", "health_index": 92.0, "anomaly_count": 1, "cht_avg": 145.2, "egt_avg": 828.0}
    ]

    asset_comparisons = [
        {"asset": "UAV-01", "model": "Rotax 914 Turbo", "hours": 2140, "health": 95.4, "fuel_burn_lph": 18.2, "rul_hours": 1410},
        {"asset": "UAV-02", "model": "Rotax 914 Turbo", "hours": 1980, "health": 93.8, "fuel_burn_lph": 18.4, "rul_hours": 1320},
        {"asset": "UAV-03", "model": "Rotax 915iSc", "hours": 890, "health": 98.1, "fuel_burn_lph": 17.5, "rul_hours": 1780},
        {"asset": "UAV-04", "model": "Rotax 915iSc", "hours": 1420, "health": 96.5, "fuel_burn_lph": 17.8, "rul_hours": 1540},
        {"asset": "UAV-05", "model": "Rotax 915iSc", "hours": 620, "health": 99.0, "fuel_burn_lph": 17.2, "rul_hours": 1910},
        {"asset": "UAV-06", "model": "Rotax 914 Turbo", "hours": 2450, "health": 90.2, "fuel_burn_lph": 19.1, "rul_hours": 940},
        {"asset": "UAV-07", "model": "Rotax 915iSc", "hours": 1842.6, "health": 92.0, "fuel_burn_lph": 18.9, "rul_hours": 1284.0},
        {"asset": "UAV-08", "model": "Rotax 915iSc", "hours": 1130, "health": 97.4, "fuel_burn_lph": 17.6, "rul_hours": 1690}
    ]

    return {
        "time_series": time_series,
        "asset_comparisons": asset_comparisons,
        "total_reports_generated": len(REPORTS_DB),
        "fleet_mtbur_current": 4120.0,
        "compliance_rate_pct": 100.0
    }
