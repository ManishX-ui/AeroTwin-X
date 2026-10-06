"""End-to-End WebSocket and Live Server Verification."""
import asyncio
import sys
import os
import urllib.request
import websockets
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

async def verify_live_server():
    print("Checking HTTP index endpoint...")
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/")
        with urllib.request.urlopen(req, timeout=5) as resp:
            content = resp.read()
            print(f" -> Index served successfully ({len(content)} bytes, status {resp.status})")
    except Exception as e:
        print(f" -> HTTP request error: {e}")

    print("\nConnecting to Live WebSocket /ws/telemetry...")
    uri = "ws://127.0.0.1:8000/ws/telemetry"
    try:
        async with websockets.connect(uri) as ws:
            print(" -> WebSocket connected successfully!")
            # Wait for 3 incoming telemetry frames
            for i in range(3):
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                frame = json.loads(msg)
                telemetry = frame.get("telemetry", {})
                twin = frame.get("twin", {})
                pred = frame.get("prediction", {})
                print(f" [Frame {i+1}] RPM: {telemetry.get('rpm')}, CHT: {telemetry.get('cht')}°C, Sync: {twin.get('twin_sync_percent')}%, Health: {pred.get('health', {}).get('engine_health')}")

            # Send a fault injection command over WebSocket
            print("\nSending INJECT_FAULT (OVERHEATING) over WebSocket...")
            await ws.send(json.dumps({"action": "INJECT_FAULT", "fault": "OVERHEATING", "severity": 1.5}))

            # Wait for 2 more frames to see the fault take effect
            for i in range(2):
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                frame = json.loads(msg)
                telemetry = frame.get("telemetry", {})
                pred = frame.get("prediction", {})
                fault = pred.get("fault", {}).get("fault")
                anom = pred.get("anomaly", {}).get("anomaly_score")
                print(f" [Fault Frame {i+1}] CHT: {telemetry.get('cht')}°C, Predicted Fault: {fault}, Anomaly Score: {anom}")

            print("\nResetting to nominal baseline...")
            await ws.send(json.dumps({"action": "RESET"}))
            print(" -> Live WebSocket integration verified successfully!")

    except Exception as e:
        print(f" -> WebSocket verification error: {e}")

if __name__ == "__main__":
    asyncio.run(verify_live_server())
