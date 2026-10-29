#!/usr/bin/env python3
"""CLI Script: Simulate Real IoT Hardware (ESP32 / Raspberry Pi) Ingestion to AeroTwin-X.

Sends validated physical or simulated sensor packets to:
POST /api/v1/telemetry/ingest
Uses authentication (X-API-Key or Bearer token).
Supports:
- Generic IoT sensor schema (temperature, vibration, pressure, rpm)
- Canonical TelemetryPacket schema
- Continuous streaming mode or single-shot test
- Injection of physical faults (thermal runaway, vibration spike, pressure drop)
"""
import sys
import os
import time
import argparse
import datetime
import json
import urllib.request
import urllib.error

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def send_sensor_reading(
    url: str,
    api_key: str,
    device_id: str,
    rpm: float,
    temperature: float,
    vibration: float,
    oil_pressure: float,
    fuel_flow: float,
    payload_format: str = "generic"
) -> dict:
    """Send an authenticated HTTP POST sensor reading to AeroTwin-X."""
    iso_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if payload_format == "generic":
        # Generic IoT device contract (e.g., ESP32 / Arduino / Raspberry Pi)
        body = {
            "device_id": device_id,
            "timestamp": iso_now,
            "source": "sensor",
            "sensors": {
                "rpm": rpm,
                "temperature": temperature,
                "vibration": vibration,
                "oil_pressure": oil_pressure,
                "fuel_flow": fuel_flow,
                "voltage": 28.2
            },
            "metadata": {
                "firmware": "v1.4.2-esp32-freertos",
                "interface": "WiFi-HTTP"
            }
        }
    else:
        # Full canonical TelemetryPacket
        body = {
            "timestamp": iso_now,
            "uav_id": device_id,
            "engine_id": "AE-03",
            "rpm": rpm,
            "cht": temperature,
            "egt": 725.0,
            "oil_pressure": oil_pressure,
            "oil_temperature": 88.0,
            "fuel_flow": fuel_flow,
            "vibration": vibration,
            "battery_voltage": 28.2,
            "alternator_current": 13.5,
            "injection_timing": 18.2,
            "throttle_pos": 75.0,
            "manifold_pressure": 31.5,
            "ambient_temp": 15.0,
            "pressure_altitude": 2500.0,
            "mission_phase": "CRUISE",
            "quality": "VALID",
            "source": "LIVE_SENSOR"
        }

    json_bytes = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=json_bytes,
        headers={
            "Content-Type": "application/json",
            "X-API-Key": api_key,
            "User-Agent": "AeroTwin-ESP32-Simulator/1.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            status_code = resp.status
            resp_body = json.loads(resp.read().decode("utf-8"))
            return {"status_code": status_code, "data": resp_body}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        return {"status_code": e.code, "error": err_msg}
    except Exception as e:
        return {"status_code": 0, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="AeroTwin-X IoT Hardware Sensor Simulator")
    parser.add_argument("--url", type=str, default="http://127.0.0.1:8000/api/v1/telemetry/ingest", help="Ingest URL")
    parser.add_argument("--api-key", type=str, default="aerotwin-sensor-key-live-2026", help="Ingestion API Key")
    parser.add_argument("--device-id", type=str, default="ENGINE-001", help="Device ID")
    parser.add_argument("--format", type=str, choices=["generic", "canonical"], default="generic", help="Payload schema")
    parser.add_argument("--count", type=int, default=1, help="Number of packets to send (0 for continuous)")
    parser.add_argument("--interval", type=float, default=2.0, help="Interval in seconds between packets")
    parser.add_argument("--fault", type=str, choices=["NONE", "OVERHEATING", "VIBRATION", "OIL_DROP"], default="NONE")
    args = parser.parse_args()

    print(f"=== AeroTwin-X Real Sensor Ingestion Simulation ===")
    print(f"Target URL:    {args.url}")
    print(f"Device ID:     {args.device_id}")
    print(f"Format:        {args.format}")
    print(f"Fault Mode:    {args.fault}")
    print(f"Packets Count: {args.count if args.count > 0 else 'Continuous'}")
    print("-" * 52)

    sent = 0
    while True:
        sent += 1
        # Baseline nominal values
        rpm = 2550.0
        cht = 108.0
        vib = 1.15
        oil_p = 4.2
        fuel = 18.2

        if args.fault == "OVERHEATING":
            cht += 38.0
            print(" [INJECTING FAULT: Overheating CHT = 146.0°C]")
        elif args.fault == "VIBRATION":
            vib += 5.2
            print(" [INJECTING FAULT: High Vibration = 6.35g]")
        elif args.fault == "OIL_DROP":
            oil_p -= 2.4
            print(" [INJECTING FAULT: Low Oil Pressure = 1.8 bar]")

        res = send_sensor_reading(
            url=args.url,
            api_key=args.api_key,
            device_id=args.device_id,
            rpm=rpm,
            temperature=cht,
            vibration=vib,
            oil_pressure=oil_p,
            fuel_flow=fuel,
            payload_format=args.format
        )

        if "data" in res:
            d = res["data"]
            pred = d.get("prediction_result", {})
            print(f"[{sent}] HTTP {res['status_code']} | Reading ID: {d.get('reading_id')} | Status: {d.get('processing_status')}")
            print(f"     -> Predicted Class: {pred.get('fault', 'NORMAL')} | Conf: {pred.get('confidence')}% | Anomaly Score: {pred.get('anomaly_score')}")
        else:
            print(f"[{sent}] HTTP {res['status_code']} | Error: {res.get('error')}")

        if args.count > 0 and sent >= args.count:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
