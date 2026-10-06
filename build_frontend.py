"""Assemble Stitch HTML screens into an interactive Single-Page Application."""
import os
import re

base_dir = r"c:\Users\Manish\Desktop\navomesh Projects\AeroTwin-X"
raw_dir = os.path.join(base_dir, "stitch_raw_screens")
frontend_dir = os.path.join(base_dir, "frontend")

def extract_main_body(filename):
    path = os.path.join(raw_dir, filename)
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()
    m = re.search(r"<main[^>]*>(.*?)</main>", html, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return ""

# Read shell header & sidebar from the primary Mission Control dashboard
overview_path = os.path.join(raw_dir, "23_Mission Control _ Overview Dashboard _Ai_c79d5ee8.html")
with open(overview_path, "r", encoding="utf-8", errors="ignore") as f:
    full_overview = f.read()

# Extract <head>
head_m = re.search(r"<head>(.*?)</head>", full_overview, re.DOTALL | re.IGNORECASE)
head_content = head_m.group(1).strip() if head_m else ""

# Extract <aside> (sidebar)
aside_m = re.search(r"<aside[^>]*>(.*?)</aside>", full_overview, re.DOTALL | re.IGNORECASE)
aside_content = aside_m.group(1).strip() if aside_m else ""

# Extract <header> (top mission bar)
header_m = re.search(r"<header[^>]*>(.*?)</header>", full_overview, re.DOTALL | re.IGNORECASE)
header_content = header_m.group(1).strip() if header_m else ""

# Extract main views
views = {
    "mission-control": extract_main_body("23_Mission Control _ Overview Dashboard _Ai_c79d5ee8.html"),
    "digital-twin": extract_main_body("05_3D Engine Digital Twin Explorer_97b5f472.html"),
    "sensor-monitoring": extract_main_body("32_Screen 10_ Live Telemetry _ CAN Bus_26295ed4.html"),
    "ai-diagnostics": extract_main_body("19_Screen 04_ AI Diagnostics _ Fault Predic_88451337.html"),
    "rul-degradation": extract_main_body("02_Screen 05_ RUL _ Engine Degradation_7f7479c8.html"),
    "alerts": extract_main_body("10_Screen 06_ Alerts _ Events Center_211b10e2.html"),
    "maintenance": extract_main_body("24_Screen 07_ Predictive Maintenance _ CBM__9a0c66f4.html"),
    "mission-simulator": extract_main_body("15_Screen 08_ Mission Simulator_9f1d8582.html"),
    "mission-replay": extract_main_body("27_Screen 09_ Mission Replay _ Historical T_1dab415f.html"),
    "edge-ai": extract_main_body("22_Screen 11_ Edge AI Monitoring_d9a3858f.html"),
    "system-architecture": extract_main_body("29_Screen 15_ AeroTwin-X System Architectur_e48db836.html"),
    "about-aerotwin-x": extract_main_body("03_Screen 16_ About AeroTwin-X_a19983d2.html")
}

print(f"Extracted {len(views)} views from Stitch.")

# Build integrated SPA HTML
spa_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
{head_content}
  <title>AeroTwin-X — MALE UAV Aero-Piston Digital Twin GCS</title>
  <!-- Three.js CDN for interactive 3D Engine CAD visualization -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <style>
    .view-pane {{ display: none; }}
    .view-pane.active {{ display: block; }}
    /* Smooth transition indicators */
    .telemetry-cell-flash {{ transition: background-color 0.3s ease; }}
    .flash-update {{ background-color: rgba(37, 99, 235, 0.15) !important; }}
  </style>
</head>
<body class="bg-surface font-body-md text-on-surface antialiased">

  <!-- ================= STITCH SIDEBAR ================= -->
  <aside id="main-sidebar" class="fixed left-0 top-0 h-screen w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between overflow-y-auto">
{aside_content}
  </aside>

  <!-- ================= STITCH TOP MISSION HEADER ================= -->
  <div class="pl-64">
    <header id="main-header" class="fixed top-0 left-64 right-0 h-14 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-gutter flex items-center justify-between">
{header_content}
    </header>

    <!-- ================= DYNAMIC VIEW PANES ================= -->
    <main class="relative pt-14 w-full px-gutter bg-surface min-h-screen">
"""

for view_id, view_html in views.items():
    active_cls = " active" if view_id == "mission-control" else ""
    spa_html += f"""
      <div id="view-{view_id}" class="view-pane{active_cls}">
        {view_html}
      </div>
    """

spa_html += """
    </main>
  </div>

  <!-- Notification Toast Container -->
  <div id="toast-container" class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"></div>

  <!-- Application Logic & WebSocket Bridge -->
  <script src="/static/js/app.js"></script>
</body>
</html>
"""

out_html_path = os.path.join(frontend_dir, "index.html")
with open(out_html_path, "w", encoding="utf-8") as f:
    f.write(spa_html)

print(f"Generated {out_html_path} ({len(spa_html)} characters).")
