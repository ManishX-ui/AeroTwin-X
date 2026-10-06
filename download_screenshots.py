"""Download Stitch high-res UI screenshots into docs/images/ for GitHub README."""
import os
import json
import urllib.request

step17_path = r"C:\Users\Manish\.gemini\antigravity-ide\brain\4a21b525-297f-4409-a0eb-4112cf3267ab\.system_generated\steps\17\output.txt"
with open(step17_path, "r", encoding="utf-8") as f:
    data = json.load(f)

screens = data.get("screens", [])
target_img_dir = r"c:\Users\Manish\Desktop\navomesh Projects\AeroTwin-X\docs\images"
os.makedirs(target_img_dir, exist_ok=True)

# Select primary screenshots
key_screens = {
    "01_mission_control_overview.png": "Mission Control / Overview Dashboard",
    "02_live_telemetry_can_bus.png": "Screen 10: Live Telemetry & CAN Bus",
    "03_digital_twin_3d_explorer.png": "3D Engine Digital Twin Explorer",
    "04_ai_diagnostics_fault_prediction.png": "Screen 04: AI Diagnostics & Fault Prediction",
    "05_rul_engine_degradation.png": "Screen 05: RUL & Engine Degradation",
    "06_alerts_events_center.png": "Screen 06: Alerts & Events Center",
    "07_predictive_maintenance_cbm.png": "Screen 07: Predictive Maintenance & CBM+ Workspace",
    "08_mission_simulator.png": "Screen 08: Mission Simulator",
    "09_mission_replay_analysis.png": "Screen 09: Mission Replay & Historical Telemetry Analysis",
    "10_fault_injection_cockpit.png": "AeroTwin-X: Master Control Center & Fault Injection Cockpit",
    "11_edge_ai_monitoring.png": "Screen 11: Edge AI Monitoring",
    "12_system_architecture.png": "Screen 15: AeroTwin-X System Architecture",
    "13_about_aerotwin_x.png": "Screen 16: About AeroTwin-X"
}

for filename, target_title in key_screens.items():
    found = None
    for s in screens:
        if target_title.lower() in s.get("title", "").lower():
            found = s
            break
    if found and found.get("screenshot", {}).get("downloadUrl"):
        url = found["screenshot"]["downloadUrl"]
        dest = os.path.join(target_img_dir, filename)
        print(f"Downloading {filename} from {url[:50]}...")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                content = resp.read()
                with open(dest, "wb") as out_f:
                    out_f.write(content)
            print(f" -> Saved {filename} ({len(content)} bytes)")
        except Exception as e:
            print(f" -> Error downloading {filename}: {e}")

print("All key UI screenshots downloaded.")
