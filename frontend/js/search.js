/**
 * AeroTwin-X Global Command Search Engine
 * Real-time indexing and navigation across UAVs, engines, sensors, components, alerts, missions, and work orders.
 */

class AeroSearchEngine {
  constructor() {
    this.searchIndex = [];
    this.inputEl = null;
    this.resultsEl = null;
    this.buildIndex();
    this.initDOM();
  }

  buildIndex() {
    this.searchIndex = [
      // UAVs & Engines
      { title: "UAV-07 (Hermes MALE UAV)", category: "AIRCRAFT", view: "fleet", desc: "Long-endurance tactical UAV equipped with Rotax 915iSc" },
      { title: "UAV-01 (Ghost Hawk Recon)", category: "AIRCRAFT", view: "fleet", desc: "Active tactical reconnaissance MALE UAV platform" },
      { title: "UAV-02 (Maritime Sector Patrol)", category: "AIRCRAFT", view: "fleet", desc: "Coastal surveillance UAV unit" },
      { title: "Engine AE-03 (Rotax 915iSc)", category: "ENGINE", view: "digital-twin", desc: "Turbocharged 4-cylinder aero-piston digital twin" },
      { title: "Engine AE-04 (Rotax 914F)", category: "ENGINE", view: "digital-twin", desc: "Secondary fleet surveillance propulsion unit" },

      // Sensors & Telemetry
      { title: "RPM (Engine Revolutions Per Minute)", category: "SENSOR", view: "sensor-monitoring", sensorKey: "RPM", unit: "RPM", desc: "Rotational engine speed measured via dual magnetic crankshaft pick-ups" },
      { title: "CHT (Cylinder Head Temperature)", category: "SENSOR", view: "sensor-monitoring", sensorKey: "CHT", unit: "°C", desc: "Critical cylinder thermal state monitored across 4 combustion heads" },
      { title: "EGT (Exhaust Gas Temperature)", category: "SENSOR", view: "sensor-monitoring", sensorKey: "EGT", unit: "°C", desc: "Exhaust runner gas temperature for individual cylinder mixture balance" },
      { title: "Oil Pressure (Lubrication)", category: "SENSOR", view: "sensor-monitoring", sensorKey: "OIL PRESSURE", unit: "bar", desc: "Dry-sump hydrodynamic journal bearing lubrication line pressure" },
      { title: "Oil Temperature", category: "SENSOR", view: "sensor-monitoring", sensorKey: "OIL TEMP", unit: "°C", desc: "Scavenge return line thermal sensor prior to oil radiator" },
      { title: "Manifold Pressure (MAP / Boost)", category: "SENSOR", view: "sensor-monitoring", sensorKey: "MAP", unit: "inHg", desc: "Turbocharged intake manifold absolute pressure" },
      { title: "Vibration (PRGB & Crankshaft)", category: "SENSOR", view: "sensor-monitoring", sensorKey: "VIBRATION", unit: "g", desc: "3-axis piezo accelerometer measuring mechanical harmonics" },
      { title: "Fuel Flow Rate", category: "SENSOR", view: "sensor-monitoring", sensorKey: "FUEL FLOW", unit: "L/h", desc: "Differential ultrasonic fuel injection consumption telemetry" },
      { title: "Battery Voltage (28V Bus)", category: "SENSOR", view: "sensor-monitoring", sensorKey: "BATTERY", unit: "V", desc: "Main DC avionics and ignition bus electrical potential" },

      // 3D Engine Components
      { title: "Cylinder #1 Assembly (Port Front)", category: "COMPONENT", view: "digital-twin", compId: "cyl_1", desc: "Port forward combustion chamber with dual spark plugs" },
      { title: "Cylinder #2 Assembly (Port Rear)", category: "COMPONENT", view: "digital-twin", compId: "cyl_2", desc: "Port rear cylinder monitored via FADEC thermocouple" },
      { title: "Cylinder #3 Assembly (Starboard Front)", category: "COMPONENT", view: "digital-twin", compId: "cyl_3", desc: "Starboard forward cylinder subject to active thermal monitoring" },
      { title: "Cylinder #4 Assembly (Starboard Rear)", category: "COMPONENT", view: "digital-twin", compId: "cyl_4", desc: "Starboard rear cylinder with exhaust telemetry" },
      { title: "Propeller Reduction Gearbox (PRGB)", category: "COMPONENT", view: "digital-twin", compId: "prgb", desc: "2.43:1 gear reduction drive with overload slip clutch" },
      { title: "Turbocharger & Wastegate Actuator", category: "COMPONENT", view: "digital-twin", compId: "turbo", desc: "High-altitude exhaust gas turbocharger with electronic gate" },
      { title: "Engine Crankcase & Oil Sump", category: "COMPONENT", view: "digital-twin", compId: "crankcase", desc: "Split-type aluminum alloy crankcase with dry-sump scavenging" },

      // AI Diagnostics & Models
      { title: "Residual Anomaly Detector (Isolation Forest)", category: "MODEL", view: "edge-ai", desc: "Multi-dimensional residual density isolation tree model" },
      { title: "Propulsion Fault Classifier (Gradient Boosted Tree)", category: "MODEL", view: "edge-ai", desc: "Multi-class fault classifier for overheating, misfire, and clog" },
      { title: "TBO Degradation & Countdown Estimator", category: "MODEL", view: "rul-degradation", desc: "Configured interval countdown with operational wear heuristics" },
      { title: "Aero-Piston Physics-Informed Digital Twin", category: "MODEL", view: "digital-twin", desc: "1st-order lumped parameter aerothermodynamic solver" },

      // Missions
      { title: "Mission MSN-ISR-0814 (Ghost Hawk)", category: "MISSION", view: "mission-simulator", desc: "Tactical Reconnaissance patrol at 14,500 ft ceiling" },
      { title: "Mission MSN-MAR-0720 (Coastal Patrol)", category: "MISSION", view: "mission-replay", desc: "Historical maritime patrol data replay package" },

      // Maintenance Work Orders & Alerts
      { title: "Work Order WO-2026-041 (Borescope Inspection)", category: "MAINTENANCE", view: "maintenance", desc: "Optical borescope inspection of exhaust valve seats" },
      { title: "Alert ALT-084 (CAN Bus Differential Synced)", category: "ALERT", view: "alerts", desc: "Zero CRC frame drops across 1000 CAN cycles" }
    ];
  }

  initDOM() {
    // Check if search input exists in header; if not, create it
    const headerLeft = document.querySelector("#main-header > div:first-child");
    if (!headerLeft) return;

    let searchWrapper = document.getElementById("header-search-wrapper");
    if (!searchWrapper) {
      searchWrapper = document.createElement("div");
      searchWrapper.id = "header-search-wrapper";
      searchWrapper.className = "relative hidden md:block w-52 lg:w-72";
      searchWrapper.innerHTML = `
        <div class="relative flex items-center">
          <span class="material-symbols-outlined absolute left-2.5 text-[16px] text-slate-400 pointer-events-none">search</span>
          <input id="global-search-input" type="text" placeholder="Search UAVs, sensors, components, alerts..." 
            class="w-full pl-8 pr-7 py-1.5 bg-slate-100 hover:bg-slate-200/80 focus:bg-white border border-slate-200 focus:border-cyan-500 rounded text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all font-body-md" />
          <kbd class="absolute right-2 px-1 text-[9px] font-mono font-semibold bg-slate-200/80 text-slate-500 rounded border border-slate-300">Ctrl+K</kbd>
        </div>
        <div id="global-search-results" class="absolute left-0 right-0 mt-1.5 max-h-80 overflow-y-auto bg-surface-container-lowest rounded-lg shadow-xl border border-slate-200 hidden z-50 divide-y divide-slate-100">
        </div>
      `;

      // Insert right after aircraft/engine spec
      headerLeft.appendChild(searchWrapper);
    }

    this.inputEl = document.getElementById("global-search-input");
    this.resultsEl = document.getElementById("global-search-results");

    if (this.inputEl && this.resultsEl) {
      let debounceTimer = null;
      this.inputEl.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.handleSearch(e.target.value), 120);
      });

      this.inputEl.addEventListener("focus", (e) => {
        if (e.target.value.trim().length > 0) {
          this.handleSearch(e.target.value);
        }
      });

      // Close on click outside
      document.addEventListener("click", (e) => {
        if (!searchWrapper.contains(e.target)) {
          this.resultsEl.classList.add("hidden");
        }
      });

      // Keyboard Shortcut (Ctrl+K or Cmd+K)
      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          this.inputEl.focus();
          this.inputEl.select();
        }
      });
    }
  }

  handleSearch(query) {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      this.resultsEl.classList.add("hidden");
      this.resultsEl.innerHTML = "";
      return;
    }

    const matches = this.searchIndex.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.desc && item.desc.toLowerCase().includes(q))
    ).slice(0, 8);

    if (matches.length === 0) {
      this.resultsEl.innerHTML = `
        <div class="p-4 text-center text-xs text-slate-400">
          No aerospace telemetry or components found matching "<span class="font-bold text-slate-600">${query}</span>"
        </div>
      `;
    } else {
      this.resultsEl.innerHTML = matches.map((item, idx) => {
        const catBadgeColors = {
          "AIRCRAFT": "bg-indigo-50 text-indigo-700 border-indigo-200",
          "ENGINE": "bg-sky-50 text-sky-700 border-sky-200",
          "SENSOR": "bg-cyan-50 text-cyan-800 border-cyan-200",
          "COMPONENT": "bg-emerald-50 text-emerald-700 border-emerald-200",
          "MODEL": "bg-purple-50 text-purple-700 border-purple-200",
          "MISSION": "bg-amber-50 text-amber-800 border-amber-200",
          "MAINTENANCE": "bg-slate-100 text-slate-700 border-slate-200",
          "ALERT": "bg-rose-50 text-rose-700 border-rose-200"
        };
        const badgeClass = catBadgeColors[item.category] || "bg-slate-100 text-slate-700 border-slate-200";

        return `
          <div class="search-item p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between" data-index="${idx}">
            <div class="min-w-0 pr-2">
              <div class="text-xs font-semibold text-slate-900 truncate">${item.title}</div>
              <div class="text-[10px] text-slate-500 truncate mt-0.5">${item.desc}</div>
            </div>
            <span class="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border ${badgeClass} uppercase flex-shrink-0">${item.category}</span>
          </div>
        `;
      }).join("");

      // Attach click events
      this.resultsEl.querySelectorAll(".search-item").forEach(el => {
        el.addEventListener("click", () => {
          const idx = parseInt(el.getAttribute("data-index"));
          this.selectItem(matches[idx]);
        });
      });
    }

    this.resultsEl.classList.remove("hidden");
  }

  selectItem(item) {
    this.resultsEl.classList.add("hidden");
    this.inputEl.value = "";

    // 1. Navigate to target view
    if (window.aeroApp && item.view) {
      window.aeroApp.navigateTo(item.view);
    }

    // 2. Open contextual drawer if applicable
    if (item.category === "SENSOR" && window.aeroDrawer) {
      setTimeout(() => {
        window.aeroDrawer.openSensorDrawer(item.sensorKey, item.title, item.unit);
      }, 150);
    } else if (item.category === "COMPONENT" && window.aeroEngine3D) {
      setTimeout(() => {
        window.aeroEngine3D.selectComponent(item.compId);
      }, 200);
    }
  }
}

window.aeroSearch = new AeroSearchEngine();
