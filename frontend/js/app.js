/**
 * AeroTwin-X Ground Control Station & Digital Twin Master Application
 * Coordinates Stitch UI, WebSockets, Three.js 3D CAD Explorer, AI Diagnostics,
 * Interactive KPI Drawers, Fault Injection Cockpit, and Historical Replay.
 */

class AeroTwinApp {
  constructor() {
    this.ws = null;
    this.activeView = "mission-control";
    this.dataMode = "LIVE"; // LIVE, SIMULATION, REPLAY
    this.selectedAircraft = "UAV-07";
    this.selectedEngine = "AE-03";

    // Telemetric States & Caches
    this.currentTelemetry = null;
    this.currentTwin = null;
    this.currentPrediction = null;
    this.currentMission = null;
    this.telemetryHistory = [];
    this.alertsList = [];
    this.maintenanceList = [];

    // Replay State
    this.isReplayMode = false;
    this.isReplayPlaying = false;
    this.replaySpeed = 1;
    this.replayInterval = null;
    this.currentReplayIdx = 0;

    // Simulation & Standalone State
    this.wsRetryCount = 0;
    this.isAutonomousSimRunning = false;
    this.simInterval = null;
    this.simFault = "NORMAL";
    this.simPhase = "CRUISE";
    this.simStep = 0;

    // Fault lifecycle state tracking
    this.faultLifecycle = {
      injected: false,
      detected: false,
      classified: false,
      activeType: "NORMAL"
    };

    // Initialize Subsystems
    this.initNavigation();
    this.initWebSocket();
    this.initControls();
    this.initCardInteractions();
    this.initHeaderControls();
    this.initClock();
    this.init3DViewer();
    this.fetchInitialBackendData();
  }

  /* -------------------------------------------------------------
   * 1. NAVIGATION & ROUTING
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

    // Support browser back/forward and direct hash routes
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) this.navigateTo(hash);
    });

    // Check initial hash
    const initialHash = window.location.hash.replace("#", "");
    if (initialHash) {
      this.navigateTo(initialHash);
    }
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
      // Fallback aliases for unified Stitch screens
      const aliasMap = {
        "engine-health": "rul-degradation",
        "fault-prediction": "ai-diagnostics",
        "3d-engine-explorer": "digital-twin",
        "telemetry-can": "sensor-monitoring",
        "data-quality": "edge-ai",
        "controls": "mission-simulator",
        "reports": "maintenance",
        "fleet": "mission-control",
        "settings": "system-architecture"
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

    // If navigated to 3D engine or Digital Twin, re-trigger 3D canvas resize
    if (path === "digital-twin" || path === "3d-engine-explorer") {
      setTimeout(() => {
        if (window.aeroEngine3D) {
          window.aeroEngine3D.init();
        }
      }, 100);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* -------------------------------------------------------------
   * 2. REAL-TIME WEBSOCKET STREAM & AUTONOMOUS DIGITAL TWIN
   * ------------------------------------------------------------- */
  initWebSocket() {
    const customGateway = new URLSearchParams(window.location.search).get("api") || localStorage.getItem("aerotwin_gateway");
    let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = window.location.host || "127.0.0.1:8000";

    if (customGateway) {
      const clean = customGateway.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/$/, '').replace(/\/api\/v1$/, '');
      host = clean;
      if (customGateway.startsWith("https://") || customGateway.startsWith("wss://")) {
        protocol = "wss:";
      } else if (customGateway.startsWith("http://") || customGateway.startsWith("ws://")) {
        protocol = "ws:";
      }
    }

    const wsUrl = `${protocol}//${host}/ws/telemetry`;
    console.log(`[AeroTwin-X] Connecting to Telemetry Gateway: ${wsUrl}`);
    this.updateConnectionBadge("CONNECTING", "text-amber-500", "bg-amber-500");

    // Fast-path: If on cloud host (e.g. Vercel) and no external backend configured, start autonomous physics engine immediately
    const isCloudStatic = window.location.hostname.includes("vercel.app") || window.location.hostname.includes(".app");
    if (isCloudStatic && !customGateway && !this.isAutonomousSimRunning) {
      this.startAutonomousSimulation("Vercel Edge Host — Standalone Digital Twin Mode Active");
    }

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e) {
      if (!this.isAutonomousSimRunning) {
        this.startAutonomousSimulation("Gateway Offline — Standalone Digital Twin Active");
      }
      return;
    }

    this.ws.onopen = () => {
      console.log("[AeroTwin-X] Telemetry WebSocket connected (50 Hz CAN Bus Synchronized).");
      this.stopAutonomousSimulation();
      this.wsRetryCount = 0;
      this.dataMode = "LIVE";
      this.updateConnectionBadge("TELEMETRY: CONNECTED (LIVE GCS)", "text-tertiary", "bg-tertiary-fixed-dim");
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
      this.wsRetryCount++;
      if (!this.isAutonomousSimRunning) {
        this.startAutonomousSimulation("Gateway Disconnected — Autonomous Physics Loop Engaged");
      }
      // Re-probe background gateway every 10 seconds
      setTimeout(() => {
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
          this.initWebSocket();
        }
      }, 10000);
    };

    this.ws.onerror = (err) => {
      console.warn("WebSocket error:", err);
      if (!this.isAutonomousSimRunning) {
        this.startAutonomousSimulation("Telemetry Gateway Standalone Fallback");
      }
    };
  }

  /* -------------------------------------------------------------
   * 2b. AUTONOMOUS DIGITAL TWIN CLIENT SIMULATION (VERCEL / STANDALONE)
   * ------------------------------------------------------------- */
  startAutonomousSimulation(reason = "") {
    if (this.isAutonomousSimRunning) return;
    this.isAutonomousSimRunning = true;
    this.dataMode = "SIMULATION";
    console.info(`[AeroTwin-X] Starting Autonomous Digital Twin Engine (${reason})`);
    
    this.updateConnectionBadge("TELEMETRY: AUTONOMOUS TWIN", "text-cyan-400 font-bold", "bg-cyan-400");
    this.showToast("Autonomous Aero-Piston Digital Twin Active (Stand-alone Mode)", "info");

    const phaseParams = {
      TAKEOFF: { rpm: 5750, map: 38.2, chtBase: 154, egtBase: 760, fuel: 32.5, throttle: 100, vib: 0.65 },
      CLIMB:   { rpm: 5400, map: 34.0, chtBase: 150, egtBase: 750, fuel: 28.0, throttle: 88,  vib: 0.52 },
      CRUISE:  { rpm: 5180, map: 29.4, chtBase: 146, egtBase: 745, fuel: 24.2, throttle: 74,  vib: 0.42 },
      LOITER:  { rpm: 4650, map: 25.1, chtBase: 139, egtBase: 730, fuel: 19.5, throttle: 58,  vib: 0.38 },
      DESCENT: { rpm: 4200, map: 21.0, chtBase: 132, egtBase: 710, fuel: 15.0, throttle: 42,  vib: 0.35 },
      LANDING: { rpm: 3800, map: 18.5, chtBase: 128, egtBase: 690, fuel: 12.0, throttle: 30,  vib: 0.40 }
    };

    this.simInterval = setInterval(() => {
      if (this.isReplayMode) return;
      this.simStep++;
      const t = this.simStep * 0.15;

      const p = phaseParams[this.simPhase] || phaseParams.CRUISE;
      const rpmNoise = Math.sin(t * 1.5) * 12 + (Math.random() - 0.5) * 6;
      const chtNoise = Math.sin(t * 0.4) * 0.8 + (Math.random() - 0.5) * 0.3;
      const egtNoise = Math.cos(t * 0.8) * 2.2 + (Math.random() - 0.5) * 1.2;

      let rpm = p.rpm + rpmNoise;
      let map = p.map + (Math.random() - 0.5) * 0.2;
      let oilPress = 3.82 + (Math.random() - 0.5) * 0.05;
      let oilTemp = 91.5 + Math.sin(t * 0.3) * 1.0;
      let fuelFlow = p.fuel + (Math.random() - 0.5) * 0.3;
      let vibration = p.vib + (Math.random() - 0.5) * 0.03;

      let chts = [
        p.chtBase - 1.8 + chtNoise,
        p.chtBase - 0.2 + chtNoise,
        p.chtBase + 1.9 + chtNoise,
        p.chtBase - 1.1 + chtNoise
      ];

      let egts = [
        p.egtBase - 3 + egtNoise,
        p.egtBase + 4 + egtNoise,
        p.egtBase + 8 + egtNoise,
        p.egtBase - 5 + egtNoise
      ];

      let isAnomaly = false;
      let anomalyScore = 0.08 + (Math.random() * 0.04);
      let faultType = this.simFault;
      let faultConf = 0.96;
      let health = 92.5 - Math.sin(t * 0.1) * 0.6;
      let rulHours = 718.0;
      let rootCause = "All cyber-physical engine parameters within nominal MALE UAV flight envelope.";
      let evidence = ["CAN Bus differential latency 14ms nominal", "Thermal variance within ±3.5% across 4 cylinders"];

      // Fault Injections
      if (this.simFault === "OVERHEATING") {
        isAnomaly = true;
        anomalyScore = 0.88;
        chts[2] = 178.4 + Math.sin(t * 2) * 1.5;
        oilTemp = 104.2;
        health = 52.0;
        rulHours = 18.0;
        rootCause = "High-severity thermal runaway identified on Cylinder #3 (CHT 178.4°C exceeds 175°C threshold).";
        evidence = ["Cyl #3 CHT delta +32.4°C vs Digital Twin prediction", "Oil temperature elevated to 104.2°C"];
      } else if (this.simFault === "INJECTOR_ANOMALY" || this.simFault === "INJECTOR_CLOGGING") {
        isAnomaly = true;
        anomalyScore = 0.79;
        egts[1] = 658.0 + Math.sin(t * 3) * 4.0;
        vibration = 1.82 + Math.random() * 0.15;
        health = 66.0;
        rulHours = 114.0;
        rootCause = "Fuel injector partial restriction detected on Cylinder #2 resulting in combustion imbalance.";
        evidence = ["Cyl #2 EGT dropped 88°C below bank mean", "FFT rotational vibration spike 1.82g at 1X RPM"];
      } else if (this.simFault === "LUBRICATION_ISSUE" || this.simFault === "OIL_PRESSURE_DROP") {
        isAnomaly = true;
        anomalyScore = 0.92;
        oilPress = 1.42 + (Math.random() - 0.5) * 0.08;
        health = 41.0;
        rulHours = 4.5;
        rootCause = "Critical loss of engine lubrication pressure (1.42 bar vs 3.8 bar nominal). Immediate RTB advisory.";
        evidence = ["Oil pressure below EASA Part-M minimum operating threshold", "Scavenge pump pressure drop"];
      } else if (this.simFault === "ABNORMAL_VIBRATION" || this.simFault === "MISFIRE") {
        isAnomaly = true;
        anomalyScore = 0.84;
        vibration = 2.65 + Math.random() * 0.4;
        rpm = rpm - 140;
        health = 58.0;
        rulHours = 42.0;
        rootCause = "Mechanical harmonic excitation exceeding 2.5g RMS. PRGB gearbox torsional stress.";
        evidence = ["Piezo accelerometer harmonic spike 2.65g", "Instantaneous RPM ripple"];
      } else if (this.simFault === "SENSOR_DRIFT") {
        isAnomaly = true;
        anomalyScore = 0.67;
        map = 35.8;
        health = 78.0;
        rulHours = 340.0;
        rootCause = "Dual MAP transducer mismatch detected; redundant FADEC CAN node B discrepancy.";
        evidence = ["MAP residual +6.4 inHg divergence from digital twin manifold model", "Secondary CAN frame deviation"];
      }

      // Update fault lifecycle indicators
      if (this.simFault !== "NORMAL") {
        this.faultLifecycle.injected = true;
        this.faultLifecycle.detected = anomalyScore > 0.35;
        this.faultLifecycle.classified = isAnomaly;
        this.faultLifecycle.activeType = this.simFault;
      } else {
        this.faultLifecycle.injected = false;
        this.faultLifecycle.detected = false;
        this.faultLifecycle.classified = false;
        this.faultLifecycle.activeType = "NORMAL";
      }

      const meanCht = chts.reduce((a, b) => a + b, 0) / 4;
      const meanEgt = egts.reduce((a, b) => a + b, 0) / 4;

      const simFrame = {
        type: "TELEMETRY_FRAME",
        telemetry: {
          timestamp: new Date().toISOString(),
          engine_id: "AE-03",
          aircraft_id: "UAV-07",
          rpm: rpm,
          manifold_pressure: map,
          cht: meanCht,
          egt: meanEgt,
          oil_pressure: oilPress,
          oil_temperature: oilTemp,
          fuel_flow: fuelFlow,
          fuel_pressure: 2.85,
          coolant_temp: 88.2,
          throttle_pos: p.throttle,
          vibration: vibration,
          ambient_temp: 8.5,
          pressure_altitude: 8500 + Math.sin(t * 0.1) * 30,
          indicated_airspeed: 92.4,
          battery_voltage: 28.2,
          alternator_current: 32.1,
          cht_cylinders: chts,
          egt_cylinders: egts
        },
        twin: {
          timestamp: new Date().toISOString(),
          twin_sync_percent: isAnomaly ? 64.0 : 99.4,
          channels: {
            rpm: { actual: Math.round(rpm), expected: p.rpm, residual: (rpm - p.rpm).toFixed(1), unit: "RPM", status: "NOMINAL" },
            cht: { actual: meanCht.toFixed(1), expected: p.chtBase.toFixed(1), residual: (meanCht - p.chtBase).toFixed(1), unit: "°C", status: isAnomaly ? "CRITICAL" : "NOMINAL" },
            egt: { actual: Math.round(meanEgt), expected: p.egtBase, residual: Math.round(meanEgt - p.egtBase), unit: "°C", status: isAnomaly ? "WARNING" : "NOMINAL" },
            oil_pressure: { actual: oilPress.toFixed(2), expected: "3.80", residual: (oilPress - 3.8).toFixed(2), unit: "bar", status: oilPress < 2.0 ? "CRITICAL" : "NOMINAL" },
            manifold_pressure: { actual: map.toFixed(1), expected: p.map.toFixed(1), residual: (map - p.map).toFixed(1), unit: "inHg", status: "NOMINAL" },
            vibration: { actual: vibration.toFixed(2), expected: "0.40", residual: (vibration - 0.4).toFixed(2), unit: "g", status: vibration > 1.2 ? "CRITICAL" : "NOMINAL" }
          }
        },
        prediction: {
          timestamp: new Date().toISOString(),
          anomaly: {
            is_anomaly: isAnomaly,
            anomaly_score: anomalyScore,
            anomaly_status: isAnomaly ? (anomalyScore > 0.85 ? "CRITICAL" : "WARNING") : "LOW",
            threshold: 0.35
          },
          fault: {
            fault: faultType,
            confidence: faultConf,
            probabilities: { [faultType]: faultConf, "NORMAL": isAnomaly ? 0.04 : 0.96 }
          },
          health: {
            engine_health: health,
            subsystems: {
              "Combustion & Cylinder": isAnomaly ? (health - 15) : 94.0,
              "Lubrication System": oilPress < 2.0 ? 35.0 : 96.0,
              "Cooling & Thermal": this.simFault === "OVERHEATING" ? 42.0 : 93.0,
              "Fuel & Injection": this.simFault.includes("INJECTOR") ? 50.0 : 97.0
            }
          },
          rul: {
            rul_hours: rulHours,
            confidence_lower: Math.max(0, rulHours - 30),
            confidence_upper: rulHours + 40,
            degradation_rate: isAnomaly ? 0.32 : 0.04
          },
          evidence: evidence,
          feature_attributions: {
            "CHT Cyl 3": this.simFault === "OVERHEATING" ? 0.54 : 0.08,
            "Oil Press": oilPress < 2.0 ? 0.62 : 0.06,
            "Vibration": vibration > 1.0 ? 0.45 : 0.05,
            "EGT Cyl 2": this.simFault.includes("INJECTOR") ? 0.49 : 0.04
          },
          root_cause_explanation: rootCause
        },
        mission: {
          mission_id: "MSN-ISR-0814",
          phase: this.simPhase,
          phase_elapsed_s: this.simStep * 0.15,
          waypoint: "WP-04 (LOITER BOX ALFA)",
          fuel_remaining_pct: Math.max(15, 84 - (this.simStep * 0.01))
        }
      };

      this.handleIncomingFrame(simFrame);
    }, 150);
  }

  stopAutonomousSimulation() {
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
    this.isAutonomousSimRunning = false;
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

    // Buffer frame for trends and scrubbing
    this.telemetryHistory.push(frame);
    if (this.telemetryHistory.length > 300) {
      this.telemetryHistory.shift();
    }

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

    // 7. Update 3D Engine Component Status & Thermal Colors
    this.update3DEngineStatus(prediction);
    if (window.aeroEngine3D) {
      window.aeroEngine3D.updateThermalState(telemetry, prediction);
    }

    // 8. Update Simulation Lifecycle Badges
    this.updateSimulationLifecycleUI();
  }

  /* -------------------------------------------------------------
   * 4. DOM COMPONENT BINDERS & UPDATES
   * ------------------------------------------------------------- */
  updateTopKpiBar(prediction, twin) {
    if (!prediction) return;
    const { anomaly, fault, health, rul } = prediction;

    // Engine Health
    this.setAllText(".font-telemetry-hero:first-of-type, [data-kpi='health']", Math.round(health.engine_health));

    // Health Status Badge
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

    // Twin Sync %
    if (twin) {
      const syncVal = twin.twin_sync_percent;
      this.findAndSetTextByPrefix("Twin Sync", syncVal + "%");
      const twinBadge = document.querySelector("#header-twin-sync, [data-role='twin-sync-text']");
      if (twinBadge) twinBadge.textContent = `TWIN: ${syncVal}% SYNC`;
    }

    // RUL
    this.findAndSetTextByPrefix("Remaining Life", Math.round(rul.rul_hours).toLocaleString());

    // Anomaly Score
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

    // Fault Title Pill
    const faultPills = document.querySelectorAll("[data-role='fault-title'], #view-ai-diagnostics .font-headline-lg");
    faultPills.forEach(p => {
      if (p.textContent.includes("FAULT") || p.getAttribute("data-role") === "fault-title") {
        p.textContent = fault.fault.replace(/_/g, " ");
        p.className = fault.fault === "NORMAL" ? "font-headline-lg font-bold text-tertiary" : "font-headline-lg font-bold text-error animate-pulse";
      }
    });

    // Root Cause Text
    const rootEl = document.querySelector("[data-role='root-cause-text']");
    if (rootEl) rootEl.textContent = root_cause_explanation;

    // Evidence List Items
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
    this.updateBarAndText("thermal-health", h.subsystems?.["Cooling & Thermal"] || 94);
    this.updateBarAndText("lube-health", h.subsystems?.["Lubrication System"] || 96);
    this.updateBarAndText("combustion-health", h.subsystems?.["Combustion & Cylinder"] || 92);
    this.updateBarAndText("vibration-health", 95);
    this.updateBarAndText("electrical-health", 98);
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
    updateComp("[data-comp='cylinders']", h.subsystems?.["Cooling & Thermal"] || 90);
    updateComp("[data-comp='lubrication']", h.subsystems?.["Lubrication System"] || 92);
    updateComp("[data-comp='cooling']", h.subsystems?.["Cooling & Thermal"] || 90);
    updateComp("[data-comp='combustion']", h.subsystems?.["Combustion & Cylinder"] || 92);
    updateComp("[data-comp='gearbox']", 95);
  }

  updateSimulationLifecycleUI() {
    const banner = document.getElementById("sim-lifecycle-banner");
    if (!banner) return;

    if (this.faultLifecycle.injected) {
      banner.classList.remove("hidden");
      banner.innerHTML = `
        <div class="flex items-center justify-between p-3 bg-slate-900 text-white rounded-lg border border-red-500/40 shadow-md">
          <div class="flex items-center gap-3">
            <span class="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
            <div>
              <span class="text-xs font-bold text-red-400 uppercase">ACTIVE SIMULATED SCENARIO: ${this.faultLifecycle.activeType}</span>
              <div class="text-[11px] text-slate-300">Continuous telemetry loop reflecting cyber-physical fault symptoms.</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-1 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">1. FAULT INJECTED</span>
            <span class="px-2 py-1 rounded text-[10px] font-mono font-bold ${this.faultLifecycle.detected ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-500'}">2. ANOMALY DETECTED</span>
            <span class="px-2 py-1 rounded text-[10px] font-mono font-bold ${this.faultLifecycle.classified ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'}">3. FAULT CLASSIFIED</span>
            <button id="btn-quick-reset" class="ml-2 px-2.5 py-1 bg-primary hover:bg-slate-800 text-white text-[10px] font-bold rounded">RESET NOMINAL</button>
          </div>
        </div>
      `;
      document.getElementById("btn-quick-reset")?.addEventListener("click", () => this.injectFault("NORMAL"));
    } else {
      banner.classList.add("hidden");
    }
  }

  /* -------------------------------------------------------------
   * 5. INTERACTIVE CARDS & DETAIL DRAWERS (PHASE 4 & 8)
   * ------------------------------------------------------------- */
  initCardInteractions() {
    // 1. Mission Control Overview KPI Cards
    const overviewKpis = document.querySelectorAll("#view-mission-control section.grid > div");
    overviewKpis.forEach((card, idx) => {
      card.style.cursor = "pointer";
      card.classList.add("hover:ring-1", "hover:ring-cyan-500/50", "transition-all");
      card.addEventListener("click", () => {
        const t = this.currentTelemetry || { rpm: 5180, cht: 146.2, egt: 746, oil_pressure: 3.82, oil_temperature: 91.5 };
        const pred = this.currentPrediction || { health: { engine_health: 92 }, rul: { rul_hours: 718 }, anomaly: { anomaly_score: 0.08 } };

        if (idx === 0) { // Engine Health
          window.aeroDrawer?.openSensorDrawer("HEALTH", "Engine Overall Health", "%", Math.round(pred.health.engine_health), 100, 0, "NOMINAL");
        } else if (idx === 1) { // Twin Sync
          this.navigateTo("digital-twin");
        } else if (idx === 2) { // RUL
          this.navigateTo("rul-degradation");
        } else if (idx === 3) { // Anomaly Score
          this.navigateTo("ai-diagnostics");
        } else if (idx === 4) { // Thermal Efficiency
          window.aeroDrawer?.openSensorDrawer("CHT", "Cylinder Head Temperature (CHT)", "°C", t.cht.toFixed(1), "145.0", "+1.2", "NOMINAL");
        } else if (idx === 5) { // Active Alerts
          this.navigateTo("alerts");
        }
      });
    });

    // 2. Clickable Telemetry Gauges across Sensor Monitoring & Overview
    const sensorCardMatchers = [
      { text: "RPM", key: "RPM", name: "Engine Revolutions Per Minute", unit: "RPM" },
      { text: "CHT", key: "CHT", name: "Cylinder Head Temperature", unit: "°C" },
      { text: "EGT", key: "EGT", name: "Exhaust Gas Temperature", unit: "°C" },
      { text: "OIL PRESSURE", key: "OIL PRESSURE", name: "Lubrication Oil Pressure", unit: "bar" },
      { text: "OIL TEMP", key: "OIL TEMP", name: "Lubrication Oil Temperature", unit: "°C" },
      { text: "MAP", key: "MAP", name: "Manifold Absolute Pressure (Boost)", unit: "inHg" },
      { text: "FUEL FLOW", key: "FUEL FLOW", name: "Fuel Flow Consumption", unit: "L/h" },
      { text: "VIBRATION", key: "VIBRATION", name: "PRGB & Engine Vibration", unit: "g" },
      { text: "BATT", key: "BATTERY", name: "28V DC Avionics Battery", unit: "V" },
      { text: "ALT", key: "ALTERNATOR", name: "Alternator Output Current", unit: "A" }
    ];

    document.querySelectorAll("#view-sensor-monitoring .bg-surface-container-lowest, #view-mission-control .bg-surface-container-lowest").forEach(card => {
      const cardText = card.textContent.toUpperCase();
      for (const m of sensorCardMatchers) {
        if (cardText.includes(m.text)) {
          card.style.cursor = "pointer";
          card.classList.add("hover:border-cyan-400", "transition-all");
          card.addEventListener("click", () => {
            const t = this.currentTelemetry || {};
            let val = "--";
            if (m.key === "RPM") val = Math.round(t.rpm || 5180);
            else if (m.key === "CHT") val = (t.cht || 146.2).toFixed(1);
            else if (m.key === "EGT") val = Math.round(t.egt || 746);
            else if (m.key === "OIL PRESSURE") val = (t.oil_pressure || 3.82).toFixed(2);
            else if (m.key === "OIL TEMP") val = (t.oil_temperature || 91.5).toFixed(1);
            else if (m.key === "MAP") val = (t.manifold_pressure || 29.4).toFixed(1);
            else if (m.key === "FUEL FLOW") val = (t.fuel_flow || 24.2).toFixed(1);
            else if (m.key === "VIBRATION") val = (t.vibration || 0.42).toFixed(2);
            else if (m.key === "BATTERY") val = (t.battery_voltage || 28.2).toFixed(1);

            window.aeroDrawer?.openSensorDrawer(m.key, m.name, m.unit, val);
          });
          break;
        }
      }
    });

    // 3. Clickable Alert items in Alerts View
    document.querySelectorAll("#view-alerts table tbody tr, #view-alerts .divide-y > div").forEach(row => {
      row.style.cursor = "pointer";
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return; // Let button handle ack
        const alertId = row.querySelector(".font-mono")?.textContent.trim() || "ALT-084";
        const found = this.alertsList.find(a => a.id === alertId) || {
          id: alertId,
          title: "Telemetry Link Synchronized",
          description: "Zero CRC frame drops across 1000 CAN cycles. FADEC node ACK confirmed.",
          severity: "INFO",
          evidence: ["CAN A/B primary differential link", "50 Hz telemetry clock locked"],
          acknowledged: true
        };
        window.aeroDrawer?.openAlertModal(found);
      });
    });

    // 4. Clickable 3D Camera Reset Button
    document.querySelectorAll("button").forEach(b => {
      const txt = b.textContent.toUpperCase();
      if (txt.includes("RESET CAMERA") || txt.includes("RESET CAM")) {
        b.addEventListener("click", () => {
          window.aeroEngine3D?.resetCamera();
          this.showToast("3D Camera Reset to Default Viewport", "info");
        });
      } else if (txt.includes("METALLIC") || txt.includes("THERMAL") || txt.includes("WIREFRAME")) {
        b.addEventListener("click", () => {
          let mode = "METALLIC";
          if (txt.includes("THERMAL")) mode = "THERMAL";
          if (txt.includes("WIREFRAME")) mode = "WIREFRAME";
          window.aeroEngine3D?.setViewMode(mode);
          this.showToast(`3D Render Mode: ${mode}`, "info");
        });
      }
    });
  }

  /* -------------------------------------------------------------
   * 6. HEADER CONTROLS, SEARCH & DIAGNOSTICS (PHASE 7)
   * ------------------------------------------------------------- */
  initHeaderControls() {
    // Mode Switcher in Header (LIVE vs SIMULATION vs REPLAY)
    const modeButtons = document.querySelectorAll("#main-header .rounded-md button");
    modeButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const mode = btn.textContent.trim().toUpperCase();
        modeButtons.forEach(b => {
          b.className = "px-2.5 py-1 text-slate-600 hover:text-slate-900 font-label-caps text-[11px] font-medium transition-all";
        });
        btn.className = "px-2.5 py-1 bg-primary text-white font-label-caps text-[11px] font-bold rounded shadow-xs flex items-center gap-1.5 transition-all";

        this.dataMode = mode;
        if (mode === "LIVE") {
          this.stopAutonomousSimulation();
          this.initWebSocket();
        } else if (mode === "SIMULATION") {
          this.startAutonomousSimulation("User switched to SIMULATION mode");
        }
        this.showToast(`Operating Data Mode: ${mode}`, "info");
      });
    });

    // Telemetry Status Badge -> Opens Gateway Diagnostics Modal
    const badge = document.getElementById("telemetry-status-badge");
    if (badge) {
      badge.style.cursor = "pointer";
      badge.title = "Click to open Gateway Diagnostics & URL Config";
      badge.addEventListener("click", () => {
        window.aeroDrawer?.openDiagnosticsModal();
      });
    }

    // Alerts Bell in Header -> Opens Alert Center
    const bellBtn = document.querySelector("#main-header button[title='System Alerts']");
    if (bellBtn) {
      bellBtn.addEventListener("click", () => {
        this.navigateTo("alerts");
      });
    }

    // New Maintenance Task button in Maintenance View
    document.querySelectorAll("#view-maintenance button").forEach(btn => {
      const txt = btn.textContent.toUpperCase();
      if (txt.includes("NEW TASK") || txt.includes("CREATE WORK ORDER") || txt.includes("ADD WORK ORDER")) {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          window.aeroDrawer?.openCreateTaskModal();
        });
      }
    });
  }

  /* -------------------------------------------------------------
   * 7. BUTTON CONTROLS, FAULT INJECTION & REPLAY
   * ------------------------------------------------------------- */
  initControls() {
    // Master click interceptor for fault injection & simulation
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const text = btn.textContent.trim().toUpperCase();

      // Fault Scenarios Map
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
        if (text.includes(key) && !btn.id?.includes("drawer") && !btn.id?.includes("modal")) {
          e.preventDefault();
          this.injectFault(faultType);
          return;
        }
      }

      // Mission Phase Buttons
      const phases = ["TAKEOFF", "CLIMB", "CRUISE", "LOITER", "DESCENT", "LANDING"];
      for (const ph of phases) {
        if (text === ph || text === `PHASE: ${ph}`) {
          e.preventDefault();
          this.setMissionPhase(ph);
          return;
        }
      }

      // Alert Acknowledgment
      if (text.includes("ACKNOWLEDGE") || btn.hasAttribute("data-ack-id")) {
        e.preventDefault();
        const alertId = btn.getAttribute("data-ack-id") || "ALT-084";
        this.acknowledgeAlert(alertId, btn);
        return;
      }
    });

    this.initReplayEngine();
  }

  async injectFault(faultType) {
    this.simFault = faultType;
    console.log(`[AeroTwin-X] Injecting Fault: ${faultType}`);

    // If connected via real WebSocket, send fault action
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        if (faultType === "NORMAL") {
          this.ws.send(JSON.stringify({ action: "RESET" }));
        } else {
          this.ws.send(JSON.stringify({ action: "INJECT_FAULT", fault: faultType, severity: 1.3 }));
        }
      } catch (e) {}
    }

    try {
      if (window.aeroAPI) {
        if (faultType === "NORMAL") {
          await window.aeroAPI.resetSimulation();
          this.showToast("System Reset to Nominal Baseline", "success");
        } else {
          await window.aeroAPI.injectFault(faultType, 1.3);
          this.showToast(`FAULT INJECTED: ${faultType}`, "error");
        }
      }
    } catch (err) {
      // Standalone simulation mode
      this.showToast(faultType === "NORMAL" ? "System Reset to Nominal Baseline" : `FAULT INJECTED: ${faultType}`, faultType === "NORMAL" ? "success" : "error");
    }
  }

  async setMissionPhase(phase) {
    this.simPhase = phase;
    console.log(`[AeroTwin-X] Setting Flight Phase: ${phase}`);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ action: "SET_PHASE", phase }));
      } catch (e) {}
    }

    try {
      if (window.aeroAPI) {
        await window.aeroAPI.setMissionPhase(phase);
      }
      this.showToast(`Flight Phase Transitioned to ${phase}`, "info");
    } catch (err) {
      this.showToast(`Flight Phase Transitioned to ${phase}`, "info");
    }
  }

  async acknowledgeAlert(alertId, btnElement) {
    try {
      if (window.aeroAPI) {
        await window.aeroAPI.acknowledgeAlert(alertId);
      }
    } catch (err) {}

    // Update local alert state
    const found = this.alertsList.find(a => a.id === alertId);
    if (found) found.acknowledged = true;

    if (btnElement) {
      btnElement.textContent = "ACKNOWLEDGED";
      btnElement.disabled = true;
      btnElement.classList.add("opacity-50");
    }

    this.showToast(`Alert ${alertId} Acknowledged by Lead Flight Eng`, "info");
  }

  /* -------------------------------------------------------------
   * 8. MISSION REPLAY ENGINE (PHASE 12)
   * ------------------------------------------------------------- */
  initReplayEngine() {
    const scrubber = document.querySelector("#view-mission-replay input[type='range'], [data-role='replay-scrubber']");
    if (!scrubber) return;

    scrubber.addEventListener("input", (e) => {
      this.isReplayMode = true;
      this.dataMode = "REPLAY";
      const frameIdx = parseInt(e.target.value);
      this.seekReplayFrame(frameIdx);
    });

    // Play/Pause button
    const playBtn = document.querySelector("#view-mission-replay button:has(.material-symbols-outlined:contains('play_arrow')), #btn-replay-play");
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        this.toggleReplayPlayback(playBtn);
      });
    }

    // Jump Anomaly Button
    const jumpBtn = document.querySelector("#view-mission-replay button:contains('JUMP ANOMALY'), #btn-jump-anomaly");
    if (jumpBtn) {
      jumpBtn.addEventListener("click", () => {
        scrubber.value = 68;
        this.seekReplayFrame(68);
        this.showToast("Seeking to T-14m Anomaly Event (CHT Surge)", "warning");
      });
    }
  }

  seekReplayFrame(frameIdx) {
    this.currentReplayIdx = frameIdx;
    if (this.telemetryHistory.length > frameIdx) {
      const historicalFrame = this.telemetryHistory[frameIdx];
      this.handleIncomingFrame(historicalFrame);
    } else {
      // Generate deterministic replay frame for scrubber position
      const t = frameIdx * 0.2;
      const isAnomalyZone = frameIdx >= 60 && frameIdx <= 85;
      const replayFrame = {
        type: "TELEMETRY_FRAME",
        telemetry: {
          timestamp: `2026-05-18T14:${String(Math.floor(frameIdx / 4)).padStart(2, '0')}:22Z`,
          rpm: isAnomalyZone ? 4980 : 5180,
          cht: isAnomalyZone ? 176.4 : 145.2,
          egt: isAnomalyZone ? 782 : 744,
          oil_pressure: isAnomalyZone ? 2.45 : 3.82,
          oil_temperature: isAnomalyZone ? 104.5 : 91.5,
          vibration: isAnomalyZone ? 1.85 : 0.42,
          manifold_pressure: 29.2,
          fuel_flow: 24.1,
          battery_voltage: 28.2,
          cht_cylinders: [144, 146, isAnomalyZone ? 176.4 : 148, 145],
          egt_cylinders: [742, 748, 754, 739]
        },
        twin: {
          twin_sync_percent: isAnomalyZone ? 62.4 : 99.7,
          channels: {
            rpm: { actual: isAnomalyZone ? 4980 : 5180, expected: 5180, residual: isAnomalyZone ? "-200" : "0", unit: "RPM", status: isAnomalyZone ? "WARNING" : "NOMINAL" },
            cht: { actual: isAnomalyZone ? 176.4 : 145.2, expected: 145.0, residual: isAnomalyZone ? "+31.4" : "+0.2", unit: "°C", status: isAnomalyZone ? "CRITICAL" : "NOMINAL" }
          }
        },
        prediction: {
          anomaly: { is_anomaly: isAnomalyZone, anomaly_score: isAnomalyZone ? 0.88 : 0.08, anomaly_status: isAnomalyZone ? "CRITICAL" : "LOW" },
          fault: { fault: isAnomalyZone ? "OVERHEATING" : "NORMAL", confidence: 0.94 },
          health: { engine_health: isAnomalyZone ? 54 : 92 },
          rul: { rul_hours: isAnomalyZone ? 18 : 718 },
          root_cause_explanation: isAnomalyZone ? "Historical playback: Thermal surge on Cylinder #3." : "Historical playback: Nominal cruise."
        },
        mission: { mission_id: "MSN-ISR-0814", phase: "CRUISE" }
      };
      this.handleIncomingFrame(replayFrame);
    }
  }

  toggleReplayPlayback(playBtn) {
    this.isReplayPlaying = !this.isReplayPlaying;
    if (this.isReplayPlaying) {
      playBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">pause</span><span>PAUSE</span>`;
      this.replayInterval = setInterval(() => {
        const scrubber = document.querySelector("#view-mission-replay input[type='range']");
        if (scrubber) {
          let next = parseInt(scrubber.value) + 1;
          if (next > parseInt(scrubber.max)) next = 0;
          scrubber.value = next;
          this.seekReplayFrame(next);
        }
      }, 250);
      this.showToast("Mission Replay Playback Active (1x)", "info");
    } else {
      playBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">play_arrow</span><span>PLAY</span>`;
      clearInterval(this.replayInterval);
      this.replayInterval = null;
    }
  }

  /* -------------------------------------------------------------
   * 9. INITIAL DATA FETCH & BACKEND SYNCHRONIZATION
   * ------------------------------------------------------------- */
  async fetchInitialBackendData() {
    if (!window.aeroAPI) return;
    try {
      const [alerts, tasks] = await Promise.all([
        window.aeroAPI.listAlerts().catch(() => []),
        window.aeroAPI.listMaintenanceTasks().catch(() => [])
      ]);
      this.alertsList = alerts;
      this.maintenanceList = tasks;
    } catch (e) {
      console.warn("Initial backend bootstrap handled gracefully.");
    }
  }

  /* -------------------------------------------------------------
   * 10. UTILITY & HELPER METHODS
   * ------------------------------------------------------------- */
  initClock() {
    const clockEl = document.querySelector("[data-role='utc-clock'] span:last-child");
    if (!clockEl) return;
    setInterval(() => {
      const now = new Date();
      const timeStr = now.toISOString().substring(11, 19);
      const dateStr = now.toISOString().substring(0, 10);
      clockEl.textContent = `${timeStr} UTC | ${dateStr}`;
    }, 1000);
  }

  init3DViewer() {
    if (window.aeroEngine3D) {
      window.aeroEngine3D.init();
    }
  }

  updateConnectionBadge(text, textColor, dotColor) {
    const badge = document.querySelector("#telemetry-status-badge, #main-header .telemetry-status-badge");
    if (badge) {
      badge.innerHTML = `<span class="w-2 h-2 rounded-full ${dotColor} animate-pulse"></span><span class="font-label-caps text-label-caps uppercase ${textColor}">${text}</span>`;
    }
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const colors = {
      success: "bg-emerald-600 text-white border-emerald-500",
      error: "bg-red-600 text-white border-red-500",
      warning: "bg-amber-600 text-white border-amber-500",
      info: "bg-slate-900 text-cyan-300 border-cyan-500/40"
    };

    const icons = {
      success: "check_circle",
      error: "warning",
      warning: "report_problem",
      info: "info"
    };

    const toast = document.createElement("div");
    toast.className = `px-4 py-2.5 rounded shadow-xl border text-xs font-mono font-medium flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `<span class="material-symbols-outlined text-[16px]">${icons[type] || 'info'}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove("translate-y-2", "opacity-0");
    }, 10);

    setTimeout(() => {
      toast.classList.add("translate-y-2", "opacity-0");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  setAllText(selector, text) {
    document.querySelectorAll(selector).forEach(el => el.textContent = text);
  }

  findAndSetTextByPrefix(prefix, value) {
    document.querySelectorAll(".bg-surface-container-lowest").forEach(card => {
      if (card.textContent.includes(prefix)) {
        const valEl = card.querySelector(".font-telemetry-hero, .text-2xl, .text-xl");
        if (valEl) valEl.textContent = value;
      }
    });
  }

  updateMetricElements(label, value) {
    document.querySelectorAll(".bg-surface-container-lowest, tr, .telemetry-cell").forEach(el => {
      if (el.textContent.includes(label)) {
        const valEl = el.querySelector(".font-telemetry-hero, .font-telemetry-lg, .font-telemetry-md, .val-actual");
        if (valEl && !valEl.dataset.locked) {
          valEl.textContent = value;
        }
      }
    });
  }

  updateBarAndText(idPrefix, value) {
    const num = Math.min(100, Math.max(0, Math.round(value)));
    const bar = document.querySelector(`[data-bar='${idPrefix}']`);
    if (bar) bar.style.width = `${num}%`;
    const text = document.querySelector(`[data-val='${idPrefix}']`);
    if (text) text.textContent = `${num}%`;
  }
}

// Instantiate Master Application on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  window.aeroApp = new AeroTwinApp();
});

// Also trigger immediately if script loads after DOMContentLoaded
if (document.readyState === "complete" || document.readyState === "interactive") {
  if (!window.aeroApp) {
    window.aeroApp = new AeroTwinApp();
  }
}
