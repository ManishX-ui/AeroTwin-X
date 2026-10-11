"""Seed Fixtures and Baseline Industrial Asset Data.

Populates initial Fleets, UAV Assets, Sensor Channels, Edge Devices,
and Maintenance Work Orders into PostgreSQL upon request or initialization.
"""
import datetime
from sqlalchemy.orm import Session
from .models import (
    Fleet, Asset, Sensor, EdgeDevice, MaintenanceRecord, AlertRecord, DataQualityEvent
)


def seed_database_fixtures(db: Session, force: bool = False):
    """Seed baseline operational fleet data if the database is currently empty."""
    existing_fleets = db.query(Fleet).count()
    if existing_fleets > 0 and not force:
        return {"status": "SKIPPED", "message": "Database already contains fleet records."}

    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Create Baseline Fleet
    fleet_alpha = Fleet(
        id="FLT-ALPHA",
        name="1st Tactical MALE UAV Squadron",
        description="Forward-deployed long-endurance reconnaissance and atmospheric surveillance fleet.",
        organization="MALE Tactical Operations",
        base_station="Forward Operating Base Alpha (Nevada)",
        is_active=True,
        is_deleted=False,
        created_at=now,
        updated_at=now
    )
    db.merge(fleet_alpha)

    # 2. Baseline Assets
    raw_assets = [
        {
            "id": "UAV-01",
            "tail_number": "Tail #601",
            "callsign": "Valkyrie-1",
            "airframe_model": "Hermes 900 MALE",
            "engine_model": "Rotax 914 Turbo",
            "base_station": "Forward Operating Base Alpha (Nevada)",
            "latitude": 36.241,
            "longitude": -115.052,
            "altitude_ft": 18500.0,
            "flight_hours_ttsn": 2140.0,
            "health_index": 95.4,
            "operational_status": "OPERATIONAL",
            "active_mission": "MSN-2026-ALPHA",
            "pilot_in_command": "Capt. M. Larson",
            "last_inspection": "12-SEP-2024",
            "next_due_hours": 60.0,
            "advisories_count": 0
        },
        {
            "id": "UAV-02",
            "tail_number": "Tail #602",
            "callsign": "Valkyrie-2",
            "airframe_model": "Hermes 900 MALE",
            "engine_model": "Rotax 914 Turbo",
            "base_station": "Forward Operating Base Alpha (Nevada)",
            "latitude": 36.512,
            "longitude": -114.920,
            "altitude_ft": 16200.0,
            "flight_hours_ttsn": 1980.0,
            "health_index": 93.8,
            "operational_status": "OPERATIONAL",
            "active_mission": "MSN-2026-BRAVO",
            "pilot_in_command": "1st Lt. D. Rossi",
            "last_inspection": "28-AUG-2024",
            "next_due_hours": 120.0,
            "advisories_count": 0
        },
        {
            "id": "UAV-03",
            "tail_number": "Tail #701",
            "callsign": "Spectre-1",
            "airframe_model": "Bayraktar TB2 Spec",
            "engine_model": "Rotax 915iSc Turbo",
            "base_station": "Hangar Bay 4 (Texas Depot)",
            "latitude": 31.182,
            "longitude": -97.743,
            "altitude_ft": 0.0,
            "flight_hours_ttsn": 890.0,
            "health_index": 98.1,
            "operational_status": "STANDBY",
            "active_mission": None,
            "pilot_in_command": "Maj. T. Henderson",
            "last_inspection": "04-OCT-2024",
            "next_due_hours": 210.0,
            "advisories_count": 0
        },
        {
            "id": "UAV-04",
            "tail_number": "Tail #702",
            "callsign": "Spectre-2",
            "airframe_model": "Bayraktar TB2 Spec",
            "engine_model": "Rotax 915iSc Turbo",
            "base_station": "Naval Air Station Key West",
            "latitude": 24.555,
            "longitude": -81.782,
            "altitude_ft": 12400.0,
            "flight_hours_ttsn": 1420.0,
            "health_index": 96.5,
            "operational_status": "OPERATIONAL",
            "active_mission": "MSN-COASTAL-SURV",
            "pilot_in_command": "Lt. Cdr. S. O'Connor",
            "last_inspection": "19-SEP-2024",
            "next_due_hours": 80.0,
            "advisories_count": 0
        },
        {
            "id": "UAV-05",
            "tail_number": "Tail #801",
            "callsign": "Aegis-1",
            "airframe_model": "Hermes MALE Tactical",
            "engine_model": "Rotax 915iSc Turbo",
            "base_station": "Al Dhafra Air Base (Sector 4)",
            "latitude": 24.248,
            "longitude": 54.547,
            "altitude_ft": 21000.0,
            "flight_hours_ttsn": 620.0,
            "health_index": 99.0,
            "operational_status": "OPERATIONAL",
            "active_mission": "MSN-BORDER-RECON",
            "pilot_in_command": "Capt. H. Al-Maktoum",
            "last_inspection": "02-OCT-2024",
            "next_due_hours": 380.0,
            "advisories_count": 0
        },
        {
            "id": "UAV-06",
            "tail_number": "Tail #503",
            "callsign": "Odin-3",
            "airframe_model": "MQ-1 Predator Spec",
            "engine_model": "Rotax 914 Turbo",
            "base_station": "Hangar Bay 2 (Depot Overhaul)",
            "latitude": 32.899,
            "longitude": -97.040,
            "altitude_ft": 0.0,
            "flight_hours_ttsn": 2450.0,
            "health_index": 90.2,
            "operational_status": "MAINTENANCE",
            "active_mission": None,
            "pilot_in_command": "Unassigned (Depot Bay)",
            "last_inspection": "08-OCT-2024",
            "next_due_hours": 0.0,
            "advisories_count": 2
        },
        {
            "id": "UAV-07",
            "tail_number": "Tail #601-A",
            "callsign": "Hermes-Prime",
            "airframe_model": "Hermes MALE (High-Alt)",
            "engine_model": "Rotax 915iSc Turbo (AE-03)",
            "base_station": "GCS Central Command (Live Telemetry)",
            "latitude": 34.821,
            "longitude": -116.892,
            "altitude_ft": 14500.0,
            "flight_hours_ttsn": 1842.6,
            "health_index": 92.0,
            "operational_status": "OPERATIONAL",
            "active_mission": "MSN-SIM-LIVE",
            "pilot_in_command": "GCS Autonomous Pilot",
            "last_inspection": "14-OCT-2024",
            "next_due_hours": 45.0,
            "advisories_count": 1
        },
        {
            "id": "UAV-08",
            "tail_number": "Tail #802",
            "callsign": "Aegis-2",
            "airframe_model": "Hermes MALE Tactical",
            "engine_model": "Rotax 915iSc Turbo",
            "base_station": "Ramstein Air Base",
            "latitude": 49.437,
            "longitude": 7.600,
            "altitude_ft": 0.0,
            "flight_hours_ttsn": 1130.0,
            "health_index": 97.4,
            "operational_status": "STANDBY",
            "active_mission": None,
            "pilot_in_command": "Capt. L. Weber",
            "last_inspection": "25-SEP-2024",
            "next_due_hours": 170.0,
            "advisories_count": 0
        }
    ]

    sensor_channels = [
        ("RPM", "Engine Crankshaft Speed", "Propulsion Dynamics", "SPEED", "RPM", 0.0, 5800.0),
        ("CHT", "Cylinder Head Temperature (Bank Average)", "Thermal & Cooling", "TEMPERATURE", "°C", 50.0, 200.0),
        ("EGT", "Exhaust Gas Temperature", "Combustion", "TEMPERATURE", "°C", 400.0, 950.0),
        ("OIL_PRESS", "Engine Oil Pressure", "Lubrication", "PRESSURE", "bar", 1.5, 7.0),
        ("OIL_TEMP", "Engine Oil Temperature", "Lubrication", "TEMPERATURE", "°C", 50.0, 130.0),
        ("FUEL_FLOW", "Gravimetric Fuel Flow Rate", "Fuel & Metering", "FLOW", "L/h", 5.0, 35.0),
        ("VIBRATION", "Crankcase Structural Vibration RMS", "Mechanical Health", "ACCELERATION", "g", 0.0, 10.0),
        ("BATTERY_VOLT", "Main 28V Avionics DC Bus Voltage", "Electrical Bus", "VOLTAGE", "V", 22.0, 30.0),
        ("MAP", "Manifold Absolute Pressure", "Air Intake & Turbo", "PRESSURE", "inHg", 15.0, 45.0)
    ]

    for a_data in raw_assets:
        asset = Asset(
            id=a_data["id"],
            fleet_id="FLT-ALPHA",
            tail_number=a_data["tail_number"],
            callsign=a_data["callsign"],
            airframe_model=a_data["airframe_model"],
            engine_model=a_data["engine_model"],
            base_station=a_data["base_station"],
            latitude=a_data["latitude"],
            longitude=a_data["longitude"],
            altitude_ft=a_data["altitude_ft"],
            flight_hours_ttsn=a_data["flight_hours_ttsn"],
            health_index=a_data["health_index"],
            operational_status=a_data["operational_status"],
            active_mission=a_data["active_mission"],
            pilot_in_command=a_data["pilot_in_command"],
            last_inspection=a_data["last_inspection"],
            next_due_hours=a_data["next_due_hours"],
            advisories_count=a_data["advisories_count"],
            is_deleted=False,
            created_at=now,
            updated_at=now
        )
        db.merge(asset)

        # Register sensors for asset
        for code, name, sub, mtype, unit, min_v, max_v in sensor_channels:
            sensor = Sensor(
                id=f"{asset.id}-{code}",
                asset_id=asset.id,
                sensor_code=code,
                channel_name=name,
                subsystem=sub,
                measurement_type=mtype,
                unit=unit,
                nominal_min=min_v,
                nominal_max=max_v,
                sample_rate_hz=50.0,
                quality_score=99.2,
                status="HEALTHY",
                is_active=True,
                created_at=now,
                updated_at=now
            )
            db.merge(sensor)
    db.flush()

    # 3. Baseline Maintenance Records
    raw_maintenance = [
        MaintenanceRecord(
            id="TSK-401",
            asset_id="UAV-07",
            task_order="WO-2026-041",
            title="Borescope Inspection — Cyl #1 - #4 Valves",
            subsystem="Thermal & Combustion",
            priority="MEDIUM",
            advisory_text="Perform optical borescope inspection of exhaust valve seats at next turnaround.",
            evidence_triggers='["CBM+ predictive schedule trigger", "TTSN 1,842 flight hours milestone"]',
            status="OPEN",
            assigned_tech="Powertrain Bay 2",
            easa_part_m_ref="M.A.401 / SB-915-021",
            created_at=now,
            updated_at=now
        ),
        MaintenanceRecord(
            id="TSK-402",
            asset_id="UAV-07",
            task_order="WO-2026-042",
            title="Cylinder #3 Injector Ultrasonic Flush & Flow Check",
            subsystem="Fuel & Metering",
            priority="HIGH",
            advisory_text="Flow deviation +0.50 L/h detected on Cylinder #3. Perform bench spray pattern calibration.",
            evidence_triggers='["Fuel flow bias +0.50 L/h", "EGT residual +18.0°C"]',
            status="OPEN",
            assigned_tech="Fuel Calibration Lab",
            easa_part_m_ref="EASA Part-145 Tech Spec",
            created_at=now,
            updated_at=now
        ),
        MaintenanceRecord(
            id="TSK-398",
            asset_id="UAV-06",
            task_order="WO-2026-038",
            title="Turbocharger Wastegate Actuator Rigging & Recalibration",
            subsystem="Air Intake & Turbo",
            priority="HIGH",
            advisory_text="Wastegate boost lag detected at flight level FL180. Verify diaphragm seal and sensor harness.",
            evidence_triggers='["MAP lag > 1.2s", "Altitude compensation deviation"]',
            status="IN_PROGRESS",
            assigned_tech="Depot Bay 4 Lead",
            easa_part_m_ref="SB-914-044 Rev 3",
            created_at=now,
            updated_at=now
        )
    ]
    for mr in raw_maintenance:
        db.merge(mr)

    # 4. Baseline Alerts
    raw_alerts = [
        AlertRecord(
            id="ALT-FLT-101",
            asset_id="UAV-07",
            engine_id="AE-03",
            severity="CRITICAL",
            title="Cylinder #3 Injector Degradation",
            description="Active CBM+ advisory: Fuel flow bias +0.50 L/h and EGT residual +18.0°C. Turnaround inspection required within 45h.",
            evidence='["Fuel flow bias +0.50 L/h", "EGT residual +18.0°C"]',
            acknowledged=False,
            source="AI_FAULT_DETECTION",
            created_at=now,
            updated_at=now
        ),
        AlertRecord(
            id="ALT-FLT-102",
            asset_id="UAV-06",
            engine_id="AE-02",
            severity="WARNING",
            title="Depot Overhaul Threshold Reached",
            description="Aircraft reached 2,450 flight hours TTSN. Slipper clutch wear inspection due.",
            evidence='["TTSN >= 2,450h", "TBO Advisory Threshold"]',
            acknowledged=True,
            source="SCHEDULE_MONITOR",
            created_at=now,
            updated_at=now
        )
    ]
    for al in raw_alerts:
        db.merge(al)

    # 5. Baseline Edge Devices
    raw_devices = [
        EdgeDevice(
            id="EDGE-ORIN-01",
            asset_id="UAV-07",
            name="Orin Nano Core Avionics (Primary GCS Link)",
            ip_address="192.168.10.42",
            can_node_id="0x1F",
            hardware="NVIDIA Jetson Orin Nano (8GB)",
            status="ONLINE",
            cpu_util_pct=24.5,
            memory_used_gb=3.2,
            memory_total_gb=8.0,
            temperature_c=48.2,
            power_mode="15W",
            telemetry_hz=50,
            inference_batch_size=1,
            anomaly_threshold=0.35,
            offline_buffer_hours=48,
            active_models='["Isolation Forest v1.2", "XGBoost Classifier v2.1", "RUL Weibull v1.0"]',
            uptime_hours=142.8,
            created_at=now,
            updated_at=now
        ),
        EdgeDevice(
            id="EDGE-XAVIER-02",
            asset_id="UAV-01",
            name="Xavier NX Telemetry Concentrator (Nevada FOB)",
            ip_address="192.168.20.15",
            can_node_id="0x2A",
            hardware="NVIDIA Jetson Xavier NX (16GB)",
            status="ONLINE",
            cpu_util_pct=18.0,
            memory_used_gb=4.1,
            memory_total_gb=16.0,
            temperature_c=43.5,
            power_mode="15W",
            telemetry_hz=50,
            inference_batch_size=1,
            anomaly_threshold=0.40,
            offline_buffer_hours=72,
            active_models='["Isolation Forest v1.2", "Fault Classifier v2.1"]',
            uptime_hours=380.2,
            created_at=now,
            updated_at=now
        )
    ]
    for ed in raw_devices:
        db.merge(ed)

    # 6. Baseline Data Quality Event
    dq_event = DataQualityEvent(
        id="INC-DQ-091",
        asset_id="UAV-07",
        sensor_id="UAV-07-CHT",
        parameter="Cylinder 3 Head Temperature",
        severity="WARNING",
        rule_broken="Rate-of-Change Limit Exceeded (> 4.5°C/s spike during steady cruise)",
        status="OPEN",
        assigned_to="Flight Systems Lead",
        detected_at=now,
        created_at=now,
        updated_at=now
    )
    db.merge(dq_event)

    db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Successfully seeded {len(raw_assets)} assets, {len(raw_assets) * len(sensor_channels)} sensors, and initial maintenance/alerts/edge devices."
    }
