/**
 * AeroTwin-X Ground Control Station & Digital Twin Frontend Engine
 * Connects Stitch UI to Real-Time Telemetry, Digital Twin, and AI/ML Pipeline
 */

class AeroTwinApp {
  constructor() {
    this.ws = null;
    this.activeView = "mission-control";
    this.currentTelemetry = null;
    this.currentTwin = null;
    this.currentPrediction = null;
    this.currentMission = null;
    this.isReplayMode = false;
    this.replayFrames = [];
    this.threeScene = null;

    this.initNavigation();
    this.initWebSocket();
    this.initControls();
    this.initClock();
    this.initThreeJSEngine();
  }

  /* -------------------------------------------------------------
   * 1. NAVIGATION ROUTING
   * ------------------------------------------------------------- */
  initNavigation() {
    const navLinks = document.querySelectorAll("[data-path]");
    navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetPath = link.getAttribute("data-path");
        this.navigateTo(targetPath);
      });
    });

    // Also support hash changes
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) this.navigateTo(hash);
    });
  }

  navigateTo(path) {
    if (!path) return;
    this.activeView = path;
    window.location.hash = path;

    // Update view panes
    document.querySelectorAll(".view-pane").forEach(pane => pane.classList.remove("active"));
    const targetPane = document.getElementById(`view-${path}`);
    if (targetPane) {
      targetPane.classList.add("active");
    } else {
      // Fallback aliases
      const aliasMap = {
        "engine-health": "rul-degradation",
        "fault-prediction": "ai-diagnostics",
        "3d-engine-explorer": "digital-twin",
        "telemetry-can": "sensor-monitoring",
        "data-quality": "edge-ai",
        "controls": "mission-simulator"
      };
      const fallback = aliasMap[path] || "mission-control";
      const fbPane = document.getElementById(`view-${fallback}`);
      if (fbPane) fbPane.classList.add("active");
    }

    // Update active nav item styling in sidebar
    document.querySelectorAll("[data-path]").forEach(link => {
      if (link.getAttribute("data-path") === path) {
        link.className = "flex items-center gap-space-sm px-space-sm py-space-xs transition-colors bg-primary-container text-on-primary font-body-lg rounded-DEFAULT shadow-[0_1px_3px_rgba(11,31,51,0.08)]";
      } else {
        link.className = "flex items-center gap-space-sm px-space-sm py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-body-md text-body-md transition-colors";
      }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* -------------------------------------------------------------
   * 2. REAL-TIME WEBSOCKET STREAM
   * ------------------------------------------------------------- */
  initWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || "127.0.0.1:8000";
    const wsUrl = `${protocol}//${host}/ws/telemetry`;

    console.log(`Connecting to AeroTwin-X Telemetry Gateway: ${wsUrl}`);
    this.updateConnectionBadge("CONNECTING", "text-amber-500", "bg-amber-500");

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("Telemetry WebSocket connected.");
      this.updateConnectionBadge("TELEMETRY: CONNECTED", "text-tertiary", "bg-tertiary-fixed-dim");
      this.showToast("Telemetry Link Established (50 Hz CAN Bus Synchronized)", "success");
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        if (frame.type === "TELEMETRY_FRAME" && !this.isReplayMode) {
          this.handleIncomingFrame(frame);
        }
      } catch (err) {
        console.error("Frame parse error:", err);
      }
    };

    this.ws.onclose = () => {
      console.warn("WebSocket disconnected. Retrying in 2.5s...");
      this.updateConnectionBadge("TELEMETRY: DISCONNECTED", "text-error", "bg-error");
      setTimeout(() => this.initWebSocket(), 2500);
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  updateConnectionBadge(text, textColor, dotColor) {
    const badge = document.querySelector("#main-header .bg-tertiary-container");
    if (badge) {
      badge.innerHTML = `<span class="w-2 h-2 rounded-full ${dotColor} animate-pulse"></span><span class="font-label-caps text-label-caps uppercase ${textColor}">${text}</span>`;
    }
  }

  /* -------------------------------------------------------------
   * 3. INCOMING TELEMETRY & TWIN FRAME DISPATCHER
   * ------------------------------------------------------------- */
  handleIncomingFrame(frame) {
    const { telemetry, twin, prediction, mission } = frame;
    this.currentTelemetry = telemetry;
    this.currentTwin = twin;
    this.currentPrediction = prediction;
    this.currentMission = mission;

    // 1. Update Top Mission KPI Bar
    this.updateTopKpiBar(prediction, twin);

    // 2. Update Live Sensor Gauges (RPM, CHT, EGT, Pressures)
    this.updateGauges(telemetry);

    // 3. Update Cylinder Balance Displays
    this.updateCylinderChannels(telemetry);

    // 4. Update Digital Twin Actual vs Expected Strip
    this.updateDigitalTwinDeltas(twin);

    // 5. Update AI Diagnostics & SHAP Explanations
    this.updateAIDiagnostics(prediction);

    // 6. Update Health Indices & RUL
    this.updateHealthAndRUL(prediction);

    // 7. Update 3D Engine Component Status
    this.update3DEngineStatus(prediction);

    // 8. Render 3D Canvas Thermal Heatmap
    this.render3DEngineThermal(telemetry, prediction);
  }

  /* -------------------------------------------------------------
   * 4. DOM COMPONENT BINDERS
   * ------------------------------------------------------------- */
  updateTopKpiBar(prediction, twin) {
    if (!prediction) return;
    const { anomaly, fault, health, rul } = prediction;

    // 1. Engine Health
    const healthEls = document.querySelectorAll("[data-kpi='engine-health'], .font-telemetry-hero:contains('92'), [data-role='engine-health-val']");
    this.setAllText(".font-telemetry-hero:first-of-type, [data-kpi='health']", Math.round(health.engine_health));

    // Update Top bar health status pill
    const healthBadge = document.querySelector("section.grid > div:first-child span.inline-flex");
    if (healthBadge) {
      if (health.engine_health < 60) {
        healthBadge.className = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-DEFAULT bg-error-container text-error font-label-caps text-[10px] font-semibold";
        healthBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>CRITICAL`;
      } else if (health.engine_health < 85) {
        healthBadge.className = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-DEFAULT bg-amber-100 text-amber-700 font-label-caps text-[10px] font-semibold";
        healthBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>WARNING`;
      } else {
        healthBadge.className = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-DEFAULT bg-tertiary-container/15 text-tertiary font-label-caps text-[10px] font-semibold";
        healthBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-pulse"></span>NORMAL`;
      }
    }

    // 2. Twin Sync %
    if (twin) {
      const syncVal = twin.twin_sync_percent;
      this.findAndSetTextByPrefix("Twin Sync", syncVal + "%");
      const twinBadge = document.querySelector("#main-header span:contains('TWIN:')");
      if (twinBadge) twinBadge.textContent = `TWIN: ${syncVal}% SYNC`;
    }

    // 3. RUL
    this.findAndSetTextByPrefix("Remaining Life", Math.round(rul.rul_hours).toLocaleString());

    // 4. Anomaly Score
    this.findAndSetTextByPrefix("Anomaly Score", anomaly.anomaly_score.toFixed(2));
    const anomBadge = document.querySelector("section.grid > div:nth-child(4) span.inline-flex");
    if (anomBadge) {
      if (anomaly.is_anomaly) {
        anomBadge.className = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-DEFAULT bg-error-container text-error font-label-caps text-[10px] font-semibold";
        anomBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>${anomaly.anomaly_status}`;
      } else {
        anomBadge.className = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-DEFAULT bg-tertiary-container/15 text-tertiary font-label-caps text-[10px] font-semibold";
        anomBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>LOW`;
      }
    }
  }

  updateGauges(t) {
    if (!t) return;
    // Bind numeric telemetry metrics everywhere they occur in the DOM
    this.updateMetricElements("RPM", Math.round(t.rpm));
    this.updateMetricElements("CHT", t.cht.toFixed(1) + "°C");
    this.updateMetricElements("EGT", Math.round(t.egt) + "°C");
    this.updateMetricElements("Oil Pressure", t.oil_pressure.toFixed(2) + " bar");
    this.updateMetricElements("Oil Temp", t.oil_temperature.toFixed(1) + "°C");
    this.updateMetricElements("Fuel Flow", t.fuel_flow.toFixed(1) + " L/h");
    this.updateMetricElements("Vibration", t.vibration.toFixed(2) + " g");
    this.updateMetricElements("MAP", t.manifold_pressure.toFixed(1) + " inHg");
    this.updateMetricElements("Batt Volt", t.battery_voltage.toFixed(1) + " V");
    this.updateMetricElements("Alt Amp", t.alternator_current.toFixed(1) + " A");
  }

  updateCylinderChannels(t) {
    if (!t || !t.cht_cylinders || !t.egt_cylinders) return;
    t.cht_cylinders.forEach((c, idx) => {
      this.updateMetricElements(`CYL #${idx + 1} CHT`, c.toFixed(1) + "°C");
    });
    t.egt_cylinders.forEach((e, idx) => {
      this.updateMetricElements(`CYL #${idx + 1} EGT`, Math.round(e) + "°C");
    });
  }

  updateDigitalTwinDeltas(twin) {
    if (!twin || !twin.channels) return;
    for (const [channelKey, data] of Object.entries(twin.channels)) {
      const container = document.querySelector(`[data-channel='${channelKey}']`);
      if (container) {
        const actEl = container.querySelector(".val-actual");
        const expEl = container.querySelector(".val-expected");
        const resEl = container.querySelector(".val-residual");
        if (actEl) actEl.textContent = data.actual;
        if (expEl) expEl.textContent = data.expected;
        if (resEl) {
          resEl.textContent = (data.residual > 0 ? "+" : "") + data.residual + " " + data.unit;
          resEl.className = data.status === "CRITICAL" ? "text-error font-bold" : (data.status === "WARNING" ? "text-amber-600 font-bold" : "text-tertiary");
        }
      }
    }
  }

  updateAIDiagnostics(pred) {
    if (!pred) return;
    const { fault, anomaly, root_cause_explanation, evidence, feature_attributions } = pred;

    // Fault Banner
    const faultPill = document.querySelector("#view-ai-diagnostics [data-role='fault-title'], #view-mission-control [data-role='fault-title']");
    if (faultPill) {
      faultPill.textContent = fault.fault.replace(/_/g, " ");
      faultPill.className = fault.fault === "NORMAL" ? "text-tertiary font-bold" : "text-error font-bold animate-pulse";
    }

    // Confidence %
    const confVal = document.querySelector("[data-role='confidence-pct']");
    if (confVal) confVal.textContent = fault.confidence + "%";

    // Root Cause
    const rootEl = document.querySelector("[data-role='root-cause-text']");
    if (rootEl) rootEl.textContent = root_cause_explanation;

    // Evidence Items
    const evidenceList = document.querySelector("[data-role='evidence-list']");
    if (evidenceList && evidence) {
      evidenceList.innerHTML = evidence.map(e => `
        <li class="flex items-center gap-2 py-1 text-xs">
          <span class="w-1.5 h-1.5 rounded-full ${fault.fault === 'NORMAL' ? 'bg-tertiary' : 'bg-error'}"></span>
          <span>${e}</span>
        </li>
      `).join("");
    }
  }

  updateHealthAndRUL(pred) {
    if (!pred || !pred.health) return;
    const h = pred.health;
    this.updateBarAndText("thermal-health", h.thermal_health);
    this.updateBarAndText("lube-health", h.lubrication_health);
    this.updateBarAndText("combustion-health", h.combustion_health);
    this.updateBarAndText("vibration-health", h.vibration_health);
    this.updateBarAndText("electrical-health", h.electrical_health);
  }

  update3DEngineStatus(pred) {
    if (!pred || !pred.health) return;
    const h = pred.health;
    const updateComp = (selector, score) => {
      const el = document.querySelector(selector);
      if (el) {
        if (score < 50) {
          el.className = "px-2 py-1 rounded bg-error-container text-error text-[10px] font-bold";
          el.textContent = "CRITICAL";
        } else if (score < 80) {
          el.className = "px-2 py-1 rounded bg-amber-100 text-amber-700 text-[10px] font-bold";
          el.textContent = "WARNING";
        } else {
          el.className = "px-2 py-1 rounded bg-tertiary-container/20 text-tertiary text-[10px] font-bold";
          el.textContent = "NORMAL";
        }
      }
    };
    updateComp("[data-comp='cylinders']", h.thermal_health);
    updateComp("[data-comp='lubrication']", h.lubrication_health);
    updateComp("[data-comp='cooling']", h.thermal_health);
    updateComp("[data-comp='combustion']", h.combustion_health);
    updateComp("[data-comp='gearbox']", h.vibration_health);
  }

  /* -------------------------------------------------------------
   * 5. INTERACTIVE BUTTON CONTROLS & FAULT INJECTION COCKPIT
   * ------------------------------------------------------------- */
  initControls() {
    // Mode Switcher (LIVE vs SIMULATION)
    document.querySelectorAll("#main-header button").forEach(btn => {
      const text = btn.textContent.trim().toUpperCase();
      if (text.includes("LIVE") || text.includes("SIMULATION")) {
        btn.addEventListener("click", () => {
          document.querySelectorAll("#main-header button").forEach(b => {
            b.className = "px-space-sm py-[2px] text-on-surface-variant hover:text-on-surface font-label-caps text-label-caps";
          });
          btn.className = "px-space-sm py-[2px] bg-primary text-on-primary font-label-caps text-label-caps rounded-DEFAULT flex items-center gap-1";
          this.showToast(`Operating Mode: ${text}`, "info");
        });
      }
    });

    // Wire Fault Injection Buttons across the UI
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const text = btn.textContent.trim().toUpperCase();

      // 1. Fault Scenario Buttons
      const faultMap = {
        "OVERHEATING": "OVERHEATING",
        "INJECTOR": "INJECTOR_ANOMALY",
        "MISFIRE": "MISFIRE",
        "LUBRICATION": "LUBRICATION_ISSUE",
        "VIBRATION": "ABNORMAL_VIBRATION",
        "DRIFT": "SENSOR_DRIFT",
        "DROPOUT": "SENSOR_DROPOUT",
        "ELECTRICAL": "ELECTRICAL_FAULT",
        "COMBUSTION": "COMBUSTION_INSTABILITY",
        "RESET": "NORMAL",
        "NOMINAL": "NORMAL"
      };

      for (const [key, faultType] of Object.entries(faultMap)) {
        if (text.includes(key)) {
          e.preventDefault();
          this.injectFault(faultType);
          return;
        }
      }

      // 2. Mission Phase Buttons
      const phaseMap = ["TAKEOFF", "CLIMB", "CRUISE", "LOITER", "DESCENT", "LANDING"];
      for (const phase of phaseMap) {
        if (text === phase || text.includes(`PHASE: ${phase}`)) {
          e.preventDefault();
          this.setMissionPhase(phase);
          return;
        }
      }

      // 3. Alert Acknowledgment
      if (text.includes("ACKNOWLEDGE") || btn.hasAttribute("data-ack-id")) {
        e.preventDefault();
        const alertId = btn.getAttribute("data-ack-id") || "ALT-084";
        this.acknowledgeAlert(alertId, btn);
        return;
      }
    });

    // Replay Scrubber Setup
    this.initReplayScrubber();
  }

  async injectFault(faultType) {
    try {
      if (faultType === "NORMAL") {
        await fetch("/api/v1/simulation/reset", { method: "POST" });
        this.showToast("System Reset to Nominal Baseline", "success");
      } else {
        const res = await fetch("/api/v1/faults/inject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fault_type: faultType, severity: 1.3 })
        });
        const data = await res.json();
        this.showToast(`FAULT INJECTED: ${faultType}`, "error");
      }
    } catch (err) {
      console.error("Fault injection failed:", err);
    }
  }

  async setMissionPhase(phase) {
    try {
      await fetch("/api/v1/simulation/phase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase })
      });
      this.showToast(`Flight Phase Transitioned to ${phase}`, "info");
    } catch (err) {
      console.error("Phase change failed:", err);
    }
  }

  async acknowledgeAlert(alertId, btnElement) {
    try {
      await fetch(`/api/v1/alerts/${alertId}/ack`, { method: "POST" });
      if (btnElement) {
        btnElement.textContent = "ACKNOWLEDGED";
        btnElement.disabled = true;
        btnElement.classList.add("opacity-50");
      }
      this.showToast(`Alert ${alertId} Acknowledged by Lead Flight Eng`, "info");
    } catch (err) {
      console.error("Ack failed:", err);
    }
  }

  /* -------------------------------------------------------------
   * 6. MISSION REPLAY ENGINE
   * ------------------------------------------------------------- */
  initReplayScrubber() {
    const scrubber = document.querySelector("#view-mission-replay input[type='range'], [data-role='replay-scrubber']");
    if (!scrubber) return;

    scrubber.addEventListener("input", async (e) => {
      this.isReplayMode = true;
      const frameIdx = parseInt(e.target.value);
      try {
        const res = await fetch(`/api/v1/missions/MSN-ISR-0814/replay?frame_index=${frameIdx}`);
        const data = await res.json();
        if (data && data.frame) {
          this.handleIncomingFrame(data.frame);
        }
      } catch (err) {
        console.error("Replay seek error:", err);
      }
    });

    // Jump buttons
    const jumpAnomBtn = document.querySelector("#view-mission-replay button:contains('JUMP ANOMALY')");
    if (jumpAnomBtn) {
      jumpAnomBtn.addEventListener("click", () => {
        this.showToast("Seeking to Anomaly Ignition Event (T-14m CHT Spike)", "warning");
      });
    }
  }

  /* -------------------------------------------------------------
   * 7. THREE.JS 3D ENGINE VISUALIZATION
   * ------------------------------------------------------------- */
  initThreeJSEngine() {
    const containers = [
      document.querySelector("#view-digital-twin canvas"),
      document.querySelector("#view-3d-engine-explorer canvas"),
      document.querySelector("#threejs-engine-container")
    ];

    // Find first valid container or fallback
    let targetCanvas = containers.find(c => c !== null);
    if (!targetCanvas || typeof THREE === "undefined") return;

    const width = targetCanvas.parentElement.clientWidth || 600;
    const height = targetCanvas.parentElement.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1726);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 15, 30);

    const renderer = new THREE.WebGLRenderer({ canvas: targetCanvas, antialias: true });
    renderer.setSize(width, height);

    // Aerospace Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    // Build Stylized 4-Cylinder Aero-Piston CAD Assembly
    const engineGroup = new THREE.Group();

    // Crankcase
    const crankcaseGeo = new THREE.BoxGeometry(10, 5, 8);
    const crankcaseMat = new THREE.MeshStandardMaterial({ color: 0x243242, roughness: 0.4, metalness: 0.8 });
    const crankcase = new THREE.Mesh(crankcaseGeo, crankcaseMat);
    engineGroup.add(crankcase);

    // 4 Cylinders (Rotax Boxer configuration)
    this.cylinderMeshes = [];
    const cylOffsets = [
      [-3.2, 3.5, -2],
      [-3.2, 3.5, 2],
      [3.2, 3.5, -2],
      [3.2, 3.5, 2]
    ];

    cylOffsets.forEach((pos, i) => {
      const cylGeo = new THREE.CylinderGeometry(1.6, 1.6, 4, 16);
      const cylMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3, metalness: 0.7 });
      const cyl = new THREE.Mesh(cylGeo, cylMat);
      cyl.position.set(pos[0], pos[1], pos[2]);
      engineGroup.add(cyl);
      this.cylinderMeshes.push(cyl);
    });

    // Propeller Reduction Gearbox (PRGB)
    const prgbGeo = new THREE.CylinderGeometry(2, 2.4, 3, 16);
    const prgbMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });
    const prgb = new THREE.Mesh(prgbGeo, prgbMat);
    prgb.rotation.z = Math.PI / 2;
    prgb.position.set(0, 0, 5.5);
    engineGroup.add(prgb);

    // Turbocharger housing
    const turboGeo = new THREE.TorusGeometry(1.5, 0.6, 12, 24);
    const turboMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 });
    const turbo = new THREE.Mesh(turboGeo, turboMat);
    turbo.position.set(0, -2.5, -3.5);
    engineGroup.add(turbo);

    scene.add(engineGroup);
    this.engineGroup = engineGroup;

    // Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (this.engineGroup) {
        this.engineGroup.rotation.y += 0.005;
      }
      renderer.render(scene, camera);
    };
    animate();
  }

  render3DEngineThermal(telemetry, prediction) {
    if (!this.cylinderMeshes) return;
    const cht = telemetry ? telemetry.cht : 108.0;
    const isOverheat = prediction && prediction.fault && prediction.fault.fault === "OVERHEATING";

    this.cylinderMeshes.forEach((mesh, idx) => {
      if (isOverheat) {
        // Red / Glowing Orange during thermal anomaly
        mesh.material.color.setHex(idx === 1 ? 0xef4444 : 0xf97316);
      } else if (cht > 120.0) {
        mesh.material.color.setHex(0xeab308);
      } else {
        mesh.material.color.setHex(0x38bdf8); // Cool Nominal Blue
      }
    });
  }

  /* -------------------------------------------------------------
   * 8. HELPERS & TOAST SYSTEM
   * ------------------------------------------------------------- */
  initClock() {
    setInterval(() => {
      const now = new Date();
      const utcString = now.toTimeString().split(" ")[0] + " UTC | " + now.toISOString().split("T")[0];
      this.setAllText(".font-code-cell:contains('UTC'), [data-role='utc-clock']", utcString);
    }, 1000);
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const colors = {
      success: "bg-tertiary-container text-on-tertiary-container border-tertiary",
      error: "bg-error-container text-on-error-container border-error",
      warning: "bg-amber-100 text-amber-900 border-amber-500",
      info: "bg-surface-container-high text-on-surface border-secondary"
    };

    const toast = document.createElement("div");
    toast.className = `px-4 py-2.5 rounded-DEFAULT shadow-lg border text-xs font-semibold flex items-center gap-2 pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `<span class="material-symbols-outlined text-[16px]">info</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove("translate-y-2", "opacity-0");
    }, 10);

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  setAllText(selector, text) {
    try {
      document.querySelectorAll(selector).forEach(el => el.textContent = text);
    } catch (e) {}
  }

  updateMetricElements(metricName, formattedValue) {
    // Find containers where a label matches metricName
    document.querySelectorAll("div, tr, span").forEach(el => {
      if (el.children.length === 0 && el.textContent.trim().toUpperCase() === metricName.toUpperCase()) {
        const parent = el.parentElement;
        if (parent) {
          const valEl = parent.querySelector(".font-telemetry-hero, .font-telemetry-lg, .font-telemetry-md, .text-on-surface");
          if (valEl && valEl !== el) {
            valEl.textContent = formattedValue;
          }
        }
      }
    });
  }

  findAndSetTextByPrefix(labelPrefix, value) {
    document.querySelectorAll("div").forEach(div => {
      const labelSpan = div.querySelector("span.font-label-caps");
      if (labelSpan && labelSpan.textContent.includes(labelPrefix)) {
        const valSpan = div.querySelector(".font-telemetry-hero, .font-telemetry-lg");
        if (valSpan) valSpan.textContent = value;
      }
    });
  }

  updateBarAndText(key, value) {
    const bar = document.querySelector(`[data-bar='${key}']`);
    if (bar) bar.style.width = `${Math.min(100, Math.max(0, value))}%`;
  }
}

// Auto-initialize when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  window.aerotwin = new AeroTwinApp();
});
