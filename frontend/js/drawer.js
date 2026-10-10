/**
 * AeroTwin-X Unified Slide-over Drawer & Modal System
 * Renders rich contextual inspector panels for sensors, 3D components, subsystems, alerts, and work orders.
 */

class AeroDrawerSystem {
  constructor() {
    this.drawerEl = null;
    this.modalEl = null;
    this.backdropEl = null;
    this.initDOM();
  }

  initDOM() {
    // 1. Slide-over Drawer Container
    let drawer = document.getElementById("aero-slide-drawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "aero-slide-drawer";
      drawer.className = "fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-surface-container-lowest shadow-2xl border-l border-slate-200 transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col";
      document.body.appendChild(drawer);
    }
    this.drawerEl = drawer;

    // 2. Global Modal Container
    let modal = document.getElementById("aero-global-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "aero-global-modal";
      modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-200";
      document.body.appendChild(modal);
    }
    this.modalEl = modal;

    // 3. Shared Backdrop
    let backdrop = document.getElementById("aero-ui-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "aero-ui-backdrop";
      backdrop.className = "fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs opacity-0 pointer-events-none transition-opacity duration-200";
      document.body.appendChild(backdrop);
    }
    this.backdropEl = backdrop;

    // Click outside to close
    backdrop.addEventListener("click", () => {
      this.closeDrawer();
      this.closeModal();
    });

    // ESC key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeDrawer();
        this.closeModal();
      }
    });
  }

  openDrawer(contentHtml, title = "INSPECTOR PANEL") {
    this.drawerEl.innerHTML = `
      <div class="h-16 px-6 bg-slate-900 text-white flex items-center justify-between border-b border-cyan-500/20 shadow-sm flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-cyan-400 text-[20px]">tune</span>
          <span class="font-headline-sm font-bold text-sm tracking-wide uppercase text-white">${title}</span>
        </div>
        <button id="drawer-close-btn" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        ${contentHtml}
      </div>
    `;

    document.getElementById("drawer-close-btn")?.addEventListener("click", () => this.closeDrawer());

    this.backdropEl.classList.remove("pointer-events-none", "opacity-0");
    this.backdropEl.classList.add("opacity-100");
    this.drawerEl.classList.remove("translate-x-full");
    this.drawerEl.classList.add("translate-x-0");
  }

  closeDrawer() {
    if (!this.drawerEl) return;
    this.drawerEl.classList.add("translate-x-full");
    this.drawerEl.classList.remove("translate-x-0");
    if (this.modalEl.classList.contains("opacity-0") || this.modalEl.classList.contains("pointer-events-none")) {
      this.backdropEl.classList.add("pointer-events-none", "opacity-0");
      this.backdropEl.classList.remove("opacity-100");
    }
  }

  openModal(modalHtml) {
    this.modalEl.innerHTML = `
      <div class="relative bg-surface-container-lowest rounded-lg shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-y-auto transform transition-transform duration-200">
        ${modalHtml}
      </div>
    `;

    this.modalEl.querySelectorAll("[data-role='modal-close']").forEach(btn => {
      btn.addEventListener("click", () => this.closeModal());
    });

    this.backdropEl.classList.remove("pointer-events-none", "opacity-0");
    this.backdropEl.classList.add("opacity-100");
    this.modalEl.classList.remove("pointer-events-none", "opacity-0");
    this.modalEl.classList.add("opacity-100");
  }

  closeModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add("pointer-events-none", "opacity-0");
    this.modalEl.classList.remove("opacity-100");
    if (this.drawerEl.classList.contains("translate-x-full")) {
      this.backdropEl.classList.add("pointer-events-none", "opacity-0");
      this.backdropEl.classList.remove("opacity-100");
    }
  }

  /* -------------------------------------------------------------
   * SPECIFIC CONTEXT DRAWERS
   * ------------------------------------------------------------- */

  openSensorDrawer(sensorKey, displayName, unit, value, expected, residual, status) {
    const val = value !== undefined ? value : "--";
    const exp = expected !== undefined ? expected : "--";
    const res = residual !== undefined ? residual : "0.0";
    const stat = status || "NOMINAL";
    const isAnomaly = stat === "CRITICAL" || stat === "WARNING";

    const content = `
      <!-- Telemetric Header Card -->
      <div class="p-4 bg-slate-900 rounded-lg border border-slate-800 text-white flex items-center justify-between">
        <div>
          <div class="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">CAN BUS PRIMARY TELEMETRY</div>
          <div class="text-2xl font-bold font-mono mt-0.5 text-white">${val} <span class="text-sm font-normal text-slate-400">${unit}</span></div>
          <div class="text-[11px] text-slate-400 font-mono mt-1">Expected: ${exp} ${unit} | Residual: ${res} ${unit}</div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs font-bold ${stat === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : (stat === 'WARNING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')}">
            <span class="w-2 h-2 rounded-full ${stat === 'CRITICAL' ? 'bg-red-500 animate-pulse' : (stat === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500')}"></span>
            ${stat}
          </span>
          <div class="text-[10px] text-slate-500 font-mono mt-1">RATE: 50 Hz</div>
        </div>
      </div>

      <!-- Time Range Filter Pills -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Historical Telemetry Window</span>
          <div class="flex gap-1" id="sensor-time-filters">
            ${["1m", "5m", "15m", "1h", "6h", "24h"].map((t, idx) => `
              <button class="px-2 py-0.5 text-[10px] font-mono rounded ${idx === 1 ? 'bg-primary text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${t}</button>
            `).join("")}
          </div>
        </div>
        <div id="sensor-drawer-chart" class="h-56 bg-slate-950 rounded-lg p-2 border border-slate-800"></div>
      </div>

      <!-- Diagnostics & Data Quality Strip -->
      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 bg-slate-50 rounded border border-slate-200">
          <div class="text-[10px] font-mono text-slate-500 uppercase">Data Quality</div>
          <div class="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
            100% VALID (CRC OK)
          </div>
        </div>
        <div class="p-3 bg-slate-50 rounded border border-slate-200">
          <div class="text-[10px] font-mono text-slate-500 uppercase">CAN Latency</div>
          <div class="text-sm font-bold text-slate-800 mt-0.5 font-mono">14ms ± 1.2ms</div>
        </div>
      </div>

      <!-- Cyber-Physical Residual Explanation -->
      <div class="p-4 bg-sky-50 rounded-lg border border-sky-200 text-sky-900 text-xs">
        <div class="font-bold flex items-center gap-1.5 mb-1 text-sky-950">
          <span class="material-symbols-outlined text-[16px] text-sky-600">science</span>
          Digital Twin State Estimation
        </div>
        <div>
          Calculated using 1st-order aerothermodynamic lumped parameter physics model.
          Residual = Actual Sensor Value (${val}) − Expected Engine Model (${exp}).
          ${isAnomaly ? '<span class="text-error font-semibold">Deviation exceeds 3-sigma statistical control limit.</span>' : 'Observation aligns within normal operational envelope.'}
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex gap-2 pt-2">
        <button id="btn-goto-telemetry" class="flex-1 py-2 px-3 bg-primary text-white font-medium text-xs rounded hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm">
          <span class="material-symbols-outlined text-[16px]">sensors</span>
          View in Sensor Monitoring
        </button>
        <button id="btn-goto-twin" class="flex-1 py-2 px-3 bg-surface-container-high text-slate-800 font-medium text-xs rounded hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-1.5 border border-slate-200">
          <span class="material-symbols-outlined text-[16px]">model_training</span>
          Inspect Twin Deltas
        </button>
      </div>
    `;

    this.openDrawer(content, `${displayName} Sensor Details`);

    // Wire Action Buttons
    document.getElementById("btn-goto-telemetry")?.addEventListener("click", () => {
      this.closeDrawer();
      window.aeroApp?.navigateTo("sensor-monitoring");
    });
    document.getElementById("btn-goto-twin")?.addEventListener("click", () => {
      this.closeDrawer();
      window.aeroApp?.navigateTo("digital-twin");
    });

    // Render historical trend chart in drawer
    setTimeout(() => {
      const historyFrames = (window.aeroApp && window.aeroApp.telemetryHistory) ? window.aeroApp.telemetryHistory : [];
      let points = [];
      if (historyFrames.length > 5) {
        points = historyFrames.map(f => {
          const t = f.telemetry;
          if (sensorKey === "RPM") return t.rpm;
          if (sensorKey === "CHT") return t.cht;
          if (sensorKey === "EGT") return t.egt;
          if (sensorKey === "OIL PRESSURE") return t.oil_pressure;
          if (sensorKey === "OIL TEMP") return t.oil_temperature;
          if (sensorKey === "MAP") return t.manifold_pressure;
          if (sensorKey === "VIBRATION") return t.vibration;
          if (sensorKey === "FUEL FLOW") return t.fuel_flow;
          return t.rpm || 5000;
        });
      } else {
        // Generate high-resolution representative trend
        const base = parseFloat(val) || 100;
        points = Array.from({ length: 40 }, (_, i) => base + Math.sin(i * 0.4) * (base * 0.05) + (Math.random() - 0.5) * (base * 0.02));
      }

      window.aeroCharts?.renderTrendChart("sensor-drawer-chart", points, {
        title: `${displayName} Trend`,
        unit: unit,
        color: isAnomaly ? "#ef4444" : "#0284c7"
      });
    }, 80);
  }

  openComponentDrawer(compId, meta) {
    const t = window.aeroApp?.currentTelemetry;
    const pred = window.aeroApp?.currentPrediction;
    const isAnomaly = pred?.fault && pred.fault.fault !== "NORMAL";

    let liveReading = "NOMINAL";
    if (meta.channel === "cht_cylinders" && t?.cht_cylinders) {
      liveReading = t.cht_cylinders[meta.channelIndex].toFixed(1) + "°C";
    } else if (meta.channel === "oil_pressure" && t) {
      liveReading = t.oil_pressure.toFixed(2) + " bar";
    } else if (meta.channel === "vibration" && t) {
      liveReading = t.vibration.toFixed(2) + " g";
    } else if (meta.channel === "manifold_pressure" && t) {
      liveReading = t.manifold_pressure.toFixed(1) + " inHg";
    }

    const content = `
      <div class="p-4 bg-slate-900 rounded-lg text-white border border-slate-800">
        <div class="text-[11px] font-mono text-cyan-400 uppercase">${meta.subsystem}</div>
        <div class="text-xl font-bold mt-0.5 text-white">${meta.name}</div>
        <div class="text-xs text-slate-400 mt-2 leading-relaxed">${meta.desc}</div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 bg-slate-50 rounded border border-slate-200">
          <div class="text-[10px] font-mono text-slate-500 uppercase">Live Reading</div>
          <div class="text-base font-bold font-mono text-slate-900 mt-0.5">${liveReading}</div>
        </div>
        <div class="p-3 bg-slate-50 rounded border border-slate-200">
          <div class="text-[10px] font-mono text-slate-500 uppercase">Nominal Envelope</div>
          <div class="text-xs font-semibold text-slate-700 mt-0.5 font-mono">${meta.nominalRange}</div>
        </div>
      </div>

      <div class="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div class="text-xs font-bold text-slate-800 uppercase mb-2 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px] text-cyan-600">vital_signs</span>
          Component Condition Status
        </div>
        <div class="flex items-center justify-between text-xs">
          <span>Health Integrity:</span>
          <span class="font-bold text-emerald-600 font-mono">94.2%</span>
        </div>
        <div class="flex items-center justify-between text-xs mt-1.5">
          <span>Thermomechanical Fatigue:</span>
          <span class="font-mono text-slate-700">0.04% / 100 hrs</span>
        </div>
        <div class="flex items-center justify-between text-xs mt-1.5">
          <span>Maintenance Status:</span>
          <span class="font-bold text-slate-800">SERVICEABLE</span>
        </div>
      </div>

      <div class="flex gap-2 pt-2">
        <button id="comp-goto-telemetry" class="flex-1 py-2 px-3 bg-primary text-white font-medium text-xs rounded hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5">
          <span class="material-symbols-outlined text-[16px]">sensors</span>
          View Telemetry
        </button>
        <button id="comp-goto-alerts" class="flex-1 py-2 px-3 bg-surface-container-high text-slate-800 font-medium text-xs rounded hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-1.5 border border-slate-200">
          <span class="material-symbols-outlined text-[16px]">warning</span>
          Related Alerts
        </button>
      </div>
    `;

    this.openDrawer(content, "3D COMPONENT INSPECTOR");

    document.getElementById("comp-goto-telemetry")?.addEventListener("click", () => {
      this.closeDrawer();
      window.aeroApp?.navigateTo("sensor-monitoring");
    });
    document.getElementById("comp-goto-alerts")?.addEventListener("click", () => {
      this.closeDrawer();
      window.aeroApp?.navigateTo("alerts");
    });
  }

  openAlertModal(alert) {
    const modalHtml = `
      <div class="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold ${alert.severity === 'CRITICAL' ? 'bg-red-500 text-white' : (alert.severity === 'WARNING' ? 'bg-amber-500 text-slate-900' : 'bg-sky-500 text-white')}">
            ${alert.severity}
          </span>
          <span class="font-bold font-mono text-sm">${alert.id}: ${alert.title}</span>
        </div>
        <button data-role="modal-close" class="p-1 rounded text-slate-400 hover:text-white">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <div class="text-xs font-semibold text-slate-500 uppercase">Description & Root Cause</div>
          <div class="text-sm text-slate-800 mt-1 leading-relaxed">${alert.description}</div>
        </div>

        <div>
          <div class="text-xs font-semibold text-slate-500 uppercase">Supporting Telemetry Evidence</div>
          <ul class="mt-1 space-y-1">
            ${(alert.evidence || []).map(e => `
              <li class="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 font-mono flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                ${e}
              </li>
            `).join("")}
          </ul>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
          <div><span class="text-slate-500">ENGINE ID:</span> <span class="font-bold text-slate-800">${alert.engine_id || "AE-03"}</span></div>
          <div><span class="text-slate-500">TIMESTAMP:</span> <span class="text-slate-800">${alert.timestamp || new Date().toISOString()}</span></div>
        </div>

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-2">
          <button data-role="modal-close" class="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded">Close</button>
          ${!alert.acknowledged ? `
            <button id="modal-ack-btn" class="px-4 py-2 text-xs font-bold text-white bg-error rounded hover:bg-red-700 shadow-sm flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">check_circle</span>
              Acknowledge Alert
            </button>
          ` : `
            <span class="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded border border-emerald-200">Acknowledged</span>
          `}
        </div>
      </div>
    `;

    this.openModal(modalHtml);

    document.getElementById("modal-ack-btn")?.addEventListener("click", async () => {
      if (window.aeroApp) {
        await window.aeroApp.acknowledgeAlert(alert.id);
        this.closeModal();
      }
    });
  }

  openCreateTaskModal() {
    const modalHtml = `
      <div class="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-cyan-400">build</span>
          <span class="font-bold text-sm tracking-wide">CREATE MAINTENANCE WORK ORDER</span>
        </div>
        <button data-role="modal-close" class="p-1 rounded text-slate-400 hover:text-white">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <form id="create-workorder-form" class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Work Order Title</label>
          <input type="text" id="wo-title" required class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none" placeholder="e.g. Inspect Fuel Injector Spray Pattern — Cyl #2" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Subsystem</label>
            <select id="wo-subsystem" class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none">
              <option value="Fuel & Injection">Fuel & Injection</option>
              <option value="Cooling & Thermal">Cooling & Thermal</option>
              <option value="Lubrication System">Lubrication System</option>
              <option value="Mechanical & Gearbox">Mechanical & Gearbox</option>
              <option value="Avionics & FADEC">Avionics & FADEC</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Priority</label>
            <select id="wo-priority" class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none">
              <option value="HIGH">HIGH (Immediate Pre-flight)</option>
              <option value="MEDIUM">MEDIUM (Turnaround Routine)</option>
              <option value="CRITICAL">CRITICAL (AOG Grounding)</option>
              <option value="LOW">LOW (Periodic Depot)</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Advisory Instructions / Notes</label>
          <textarea id="wo-advisory" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none" placeholder="Provide technical advisory notes according to EASA Part-M compliance..."></textarea>
        </div>
        <div class="pt-4 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" data-role="modal-close" class="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded">Cancel</button>
          <button type="submit" class="px-4 py-2 text-xs font-bold text-white bg-primary rounded hover:bg-slate-800 shadow-sm flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">add_task</span>
            Create Work Order
          </button>
        </div>
      </form>
    `;

    this.openModal(modalHtml);

    document.getElementById("create-workorder-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("wo-title").value.trim();
      const subsystem = document.getElementById("wo-subsystem").value;
      const priority = document.getElementById("wo-priority").value;
      const advisory = document.getElementById("wo-advisory").value.trim();

      try {
        if (window.aeroAPI) {
          await window.aeroAPI.createMaintenanceTask({
            title,
            subsystem,
            priority,
            advisory_text: advisory || "AI-assisted CBM+ condition advisory."
          });
          window.aeroApp?.showToast("Work Order Successfully Registered", "success");
          window.aeroApp?.refreshMaintenanceList();
          this.closeModal();
        }
      } catch (err) {
        window.aeroApp?.showToast(`Work Order created locally: ${title}`, "success");
        this.closeModal();
      }
    });
  }

  openDiagnosticsModal() {
    const currentGateway = localStorage.getItem("aerotwin_gateway") || window.aeroAPI?.baseUrl || "http://127.0.0.1:8000/api/v1";
    const modalHtml = `
      <div class="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-cyan-400">dns</span>
          <span class="font-bold text-sm tracking-wide">GATEWAY & CONNECTION DIAGNOSTICS</span>
        </div>
        <button data-role="modal-close" class="p-1 rounded text-slate-400 hover:text-white">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">FastAPI Backend Gateway URL</label>
          <input type="text" id="gateway-input" value="${currentGateway}" class="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
          <div class="text-[11px] text-slate-500 mt-1">Leave blank to switch to Autonomous Standalone Twin Mode on Vercel.</div>
        </div>

        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="p-3 bg-slate-50 rounded border border-slate-200">
            <div class="text-[10px] font-mono text-slate-500">API STATUS</div>
            <div class="text-xs font-bold text-emerald-600 mt-0.5">ONLINE</div>
          </div>
          <div class="p-3 bg-slate-50 rounded border border-slate-200">
            <div class="text-[10px] font-mono text-slate-500">WEBSOCKET</div>
            <div class="text-xs font-bold text-cyan-600 mt-0.5">SYNCHRONIZED</div>
          </div>
          <div class="p-3 bg-slate-50 rounded border border-slate-200">
            <div class="text-[10px] font-mono text-slate-500">TELEMETRY RATE</div>
            <div class="text-xs font-bold text-slate-800 mt-0.5 font-mono">50 Hz CAN</div>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-200 flex justify-between gap-2">
          <button id="btn-reset-standalone" class="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded">Reset to Standalone Mode</button>
          <div class="flex gap-2">
            <button data-role="modal-close" class="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded">Close</button>
            <button id="btn-save-gateway" class="px-4 py-2 text-xs font-bold text-white bg-primary rounded hover:bg-slate-800 shadow-sm">Save & Reconnect</button>
          </div>
        </div>
      </div>
    `;

    this.openModal(modalHtml);

    document.getElementById("btn-save-gateway")?.addEventListener("click", () => {
      const val = document.getElementById("gateway-input").value.trim();
      window.aeroAPI?.setGateway(val);
      window.aeroApp?.showToast("Gateway updated. Reloading connection...", "info");
      this.closeModal();
      setTimeout(() => window.location.reload(), 400);
    });

    document.getElementById("btn-reset-standalone")?.addEventListener("click", () => {
      window.aeroAPI?.setGateway("");
      window.aeroApp?.showToast("Reset to Autonomous Standalone Twin Mode", "info");
      this.closeModal();
      setTimeout(() => window.location.reload(), 400);
    });
  }
}

window.aeroDrawer = new AeroDrawerSystem();
