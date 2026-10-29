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

    // Simulation event timeline history
    this.simulationEventLog = [];

    // Initialize Subsystems
    this.initNavigation();
    this.initWebSocket();
    this.initControls();
    this.initSimulationControls();
    this.initCardInteractions();
    this.initHeaderControls();
    this.initClock();
    this.init3DViewer();
    this.initMaintenanceModule();
    this.initReportsModule();
    this.initEdgeAIModule();
    this.initDataQualityModule();
    this.initFleetModule();
    this.initMLSystemModule();
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
        "controls": "mission-simulator",
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

    // Trigger module data load on navigation
    if (path === "maintenance") this.loadMaintenanceTasks();
    if (path === "reports") this.loadReports();
    if (path === "edge-ai") this.loadEdgeDevices();
    if (path === "data-quality") this.loadDataQuality();
    if (path === "fleet") this.loadFleet();

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
    this.logSimulationEvent(faultType === "NORMAL" ? "SIMULATION_RESET" : "FAULT_INJECTED", faultType === "NORMAL" ? "Baseline conditions restored" : `Fault injected: ${faultType}`);

    const faultBadge = document.getElementById("sim-active-fault-badge");
    if (faultBadge) {
      faultBadge.textContent = `ACTIVE: ${faultType}`;
      faultBadge.className = faultType === "NORMAL" ? "bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-semibold" : "bg-red-100 text-red-900 px-2 py-0.5 rounded font-bold animate-pulse";
    }

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

    this.logSimulationEvent("ALERT_ACKNOWLEDGED", `Operator acknowledged alert: ${alertId}`);
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

    // Viewport Navigation Buttons
    document.getElementById("btn-3d-zoom-in")?.addEventListener("click", () => {
      window.aeroEngine3D?.zoomIn();
    });
    document.getElementById("btn-3d-zoom-out")?.addEventListener("click", () => {
      window.aeroEngine3D?.zoomOut();
    });
    document.getElementById("btn-3d-reset")?.addEventListener("click", () => {
      window.aeroEngine3D?.returnToFullEngine();
      this.showToast("Camera Reset & Selected Full Engine Assembly", "info");
    });
    document.getElementById("btn-3d-orbit")?.addEventListener("click", () => {
      this.showToast("Click and drag left mouse button in viewport to orbit 360°", "info");
    });
    document.getElementById("btn-3d-sensor-overlay")?.addEventListener("click", () => {
      window.aeroEngine3D?.toggleSensorOverlays();
    });

    // 3D WebGL vs 2D Schematic Toggle
    document.getElementById("btn-toggle-3d-view")?.addEventListener("click", () => {
      const canvas = document.getElementById("threejs-engine-canvas");
      const schematic = document.getElementById("schematic-2d-view");
      const btn = document.getElementById("btn-toggle-3d-view");
      if (!canvas || !schematic) return;

      if (schematic.classList.contains("hidden")) {
        schematic.classList.remove("hidden");
        canvas.classList.add("hidden");
        if (btn) btn.textContent = "2D";
        this.showToast("Switched to 2D Technical Schematic Fallback", "info");
      } else {
        schematic.classList.add("hidden");
        canvas.classList.remove("hidden");
        if (btn) btn.textContent = "3D";
        this.showToast("Switched to 3D WebGL CAD Viewport", "info");
      }
    });

    // Component Isolation Ribbon in Digital Twin view
    document.querySelectorAll("#view-digital-twin .bg-surface-container\\/70 button, #view-digital-twin [data-role='isolate-comp']").forEach(b => {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        const txt = b.textContent.toUpperCase();
        if (txt.includes("ALL ASSEMBLY")) {
          window.aeroEngine3D?.returnToFullEngine();
        } else if (txt.includes("CYLINDER #3")) {
          window.aeroEngine3D?.selectComponent("cyl_3");
        } else if (txt.includes("CYLINDER HEAD") || txt.includes("CYLINDER #1")) {
          window.aeroEngine3D?.selectComponent("cyl_1");
        } else if (txt.includes("TURBO")) {
          window.aeroEngine3D?.selectComponent("turbo");
        } else if (txt.includes("INJECTOR")) {
          window.aeroEngine3D?.selectComponent("fuel_rail");
        } else if (txt.includes("OIL") || txt.includes("CRANK")) {
          window.aeroEngine3D?.selectComponent("crankcase");
        } else if (txt.includes("GEARBOX") || txt.includes("PRGB")) {
          window.aeroEngine3D?.selectComponent("prgb");
        }
      });
    });
  }

  /* -------------------------------------------------------------
   * SIMULATION LIFECYCLE CONTROLS & TIMELINE LOGGER (FEATURE 3)
   * ------------------------------------------------------------- */
  initSimulationControls() {
    // Start Simulation
    document.getElementById("btn-sim-start")?.addEventListener("click", async () => {
      try {
        await window.aeroAPI?.startSimulation();
        this.updateSimState("RUNNING");
        this.logSimulationEvent("SIMULATION_STARTED", "Mission simulation loop active at 50Hz");
        this.showToast("Simulation Started (Active)", "success");
      } catch (e) {
        this.updateSimState("RUNNING");
        this.logSimulationEvent("SIMULATION_STARTED", "Autonomous edge simulation active");
      }
    });

    // Pause Simulation
    document.getElementById("btn-sim-pause")?.addEventListener("click", async () => {
      try {
        await window.aeroAPI?.pauseSimulation();
        this.updateSimState("PAUSED");
        this.logSimulationEvent("SIMULATION_PAUSED", "Simulation loop paused by operator");
        this.showToast("Simulation Paused", "warning");
      } catch (e) {
        this.updateSimState("PAUSED");
      }
    });

    // Resume Simulation
    document.getElementById("btn-sim-resume")?.addEventListener("click", async () => {
      try {
        await window.aeroAPI?.resumeSimulation();
        this.updateSimState("RUNNING");
        this.logSimulationEvent("SIMULATION_RESUMED", "Continuous simulation loop resumed");
        this.showToast("Simulation Resumed", "success");
      } catch (e) {
        this.updateSimState("RUNNING");
      }
    });

    // Stop Simulation
    document.getElementById("btn-sim-stop")?.addEventListener("click", async () => {
      try {
        await window.aeroAPI?.stopSimulation();
        this.updateSimState("STOPPED");
        this.logSimulationEvent("SIMULATION_STOPPED", "Simulation loop halted");
        this.showToast("Simulation Stopped", "info");
      } catch (e) {
        this.updateSimState("STOPPED");
      }
    });

    // Reset Simulation
    document.getElementById("btn-sim-reset")?.addEventListener("click", async () => {
      await this.injectFault("NORMAL");
      this.updateSimState("RUNNING");
      this.logSimulationEvent("SIMULATION_RESET", "Reset to nominal baseline telemetry");
    });

    // Scenario Select Change
    document.getElementById("sim-scenario-select")?.addEventListener("change", (e) => {
      const scenario = e.target.value;
      this.logSimulationEvent("SCENARIO_SELECTED", `Scenario queued: ${scenario}`);
    });

    // Inject Fault Button
    document.getElementById("btn-inject-fault")?.addEventListener("click", async () => {
      const select = document.getElementById("sim-scenario-select");
      const scenario = select ? select.value : "OVERHEATING";
      await this.injectFault(scenario);
    });
  }

  updateSimState(state) {
    const badge = document.getElementById("sim-state-badge");
    if (badge) {
      badge.textContent = state;
      badge.className = `font-bold ${state === "RUNNING" ? "text-emerald-400" : state === "PAUSED" ? "text-amber-400" : "text-red-400"}`;
    }
    const statusText = document.getElementById("sim-status-text");
    if (statusText) {
      statusText.textContent = `SIMULATION ${state} • MODE: ${this.isSimulationMode ? "STANDALONE ODE" : "CAN-FD 50Hz"}`;
    }
  }

  logSimulationEvent(type, description) {
    const timeStr = new Date().toLocaleTimeString();
    const eventItem = { type, description, time: timeStr };
    this.simulationEventLog.unshift(eventItem);
    if (this.simulationEventLog.length > 25) this.simulationEventLog.pop();

    const countEl = document.getElementById("sim-timeline-count");
    if (countEl) countEl.textContent = `${this.simulationEventLog.length} Events`;

    const container = document.getElementById("sim-event-timeline");
    if (container) {
      container.innerHTML = this.simulationEventLog.map(ev => {
        let tagColor = "text-sky-600 bg-sky-50";
        if (ev.type.includes("FAULT") || ev.type.includes("ANOMALY")) tagColor = "text-red-600 bg-red-50";
        else if (ev.type.includes("PREDICTION")) tagColor = "text-cyan-600 bg-cyan-50";
        else if (ev.type.includes("ALERT")) tagColor = "text-amber-600 bg-amber-50";
        else if (ev.type.includes("RESET")) tagColor = "text-emerald-600 bg-emerald-50";

        return `
          <div class="p-1 rounded border border-slate-100 flex items-start justify-between gap-1 text-[10px]">
            <div>
              <span class="px-1 py-0.5 rounded font-bold text-[8.5px] font-mono ${tagColor}">${ev.type}</span>
              <span class="text-slate-700 ml-1 font-mono">${ev.description}</span>
            </div>
            <span class="text-[9px] text-slate-400 shrink-0 font-mono">${ev.time}</span>
          </div>
        `;
      }).join("");
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
  /* =============================================================
   * MODULE 1: MAINTENANCE WORKSPACE CONTROLLER
   * ============================================================= */
  initMaintenanceModule() {
    // 1. KPI Cards Filter Clicks
    document.getElementById("maint-kpi-total")?.addEventListener("click", () => {
      this.maintStatusFilter = "ALL";
      this.maintPriorityFilter = "ALL";
      const sel = document.getElementById("maint-status-select");
      if (sel) sel.value = "ALL";
      this.loadMaintenanceTasks();
      this.showToast("Filtered: Showing all maintenance work orders", "info");
    });

    document.getElementById("maint-kpi-overdue")?.addEventListener("click", () => {
      this.maintStatusFilter = "OPEN";
      this.maintPriorityFilter = "HIGH";
      const sel = document.getElementById("maint-status-select");
      if (sel) sel.value = "OPEN";
      this.loadMaintenanceTasks();
      this.showToast("Filtered: Showing high/critical action queue", "warning");
    });

    document.getElementById("maint-kpi-upcoming")?.addEventListener("click", () => {
      this.maintStatusFilter = "OPEN";
      this.maintPriorityFilter = "ALL";
      const sel = document.getElementById("maint-status-select");
      if (sel) sel.value = "OPEN";
      this.loadMaintenanceTasks();
      this.showToast("Filtered: Showing scheduled upcoming maintenance", "info");
    });

    document.getElementById("maint-kpi-critical")?.addEventListener("click", () => {
      this.maintStatusFilter = "ALL";
      this.maintPriorityFilter = "CRITICAL";
      const sel = document.getElementById("maint-status-select");
      if (sel) sel.value = "ALL";
      this.loadMaintenanceTasks();
      this.showToast("Filtered: Showing critical airworthiness advisories", "error");
    });

    // 2. Subsystem Filter Pills
    document.querySelectorAll(".maint-filter-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".maint-filter-pill").forEach(b => {
          b.className = "maint-filter-pill px-3.5 py-1.5 text-xs font-medium rounded-full bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors";
        });
        btn.className = "maint-filter-pill px-3.5 py-1.5 text-xs font-medium rounded-full bg-slate-800 text-white shadow-sm cursor-pointer transition-colors";
        this.maintSubsystemFilter = btn.getAttribute("data-maint-filter");
        this.loadMaintenanceTasks();
      });
    });

    // 3. Header Action Buttons
    document.getElementById("maint-export-btn")?.addEventListener("click", () => {
      window.location.href = window.aeroAPI.getMaintenanceExportUrl();
      this.showToast("Generating and downloading Maintenance CSV ledger...", "success");
    });

    document.getElementById("maint-create-wo-btn")?.addEventListener("click", () => {
      window.aeroDrawer?.openCreateWorkOrderModal(async (payload) => {
        await window.aeroAPI.createMaintenanceTask(payload);
        this.loadMaintenanceTasks();
        this.showToast(`Work order dispatched to ${payload.assigned_tech}`, "success");
      });
    });

    // 4. Featured Advisory Direct Actions
    document.getElementById("maint-btn-create-inj-wo")?.addEventListener("click", () => {
      window.aeroDrawer?.openCreateWorkOrderModal(async (payload) => {
        await window.aeroAPI.createMaintenanceTask(payload);
        this.loadMaintenanceTasks();
        this.showToast("Cylinder #3 Injector Turnaround Work Order created!", "success");
      });
    });

    document.getElementById("maint-btn-view-inj-sensor")?.addEventListener("click", () => {
      window.aeroDrawer?.openSensorDrawer("CHT", "Cylinder #3 Head Temperature", "°C", "145.2", "140.0", "+5.2", "WARNING");
    });

    document.getElementById("maint-btn-evidence")?.addEventListener("click", () => {
      window.aeroDrawer?.openAlertModal({
        id: "ALT-084",
        title: "Micro-Coking on Solenoid Injector S/N INJ-084",
        description: "Differential flow bias +0.50 L/h detected with EGT residual delta +18.0°C. Verified via optical borescope macro scan.",
        severity: "CRITICAL",
        evidence: [
          "Physics-Informed ODE residual mismatch on Cyl #3",
          "High-pressure rail pressure delta: 0.08 bar",
          "Optical macro scan confirmed carbon halo ring on valve face"
        ],
        acknowledged: false
      });
    });

    // 5. Search & Status Dropdown Filters
    document.getElementById("maint-search-input")?.addEventListener("input", (e) => {
      this.maintSearchQuery = e.target.value.trim().toLowerCase();
      this.renderMaintenanceTable();
    });

    document.getElementById("maint-status-select")?.addEventListener("change", (e) => {
      this.maintStatusFilter = e.target.value;
      this.loadMaintenanceTasks();
    });

    document.getElementById("maint-refresh-btn")?.addEventListener("click", () => {
      this.loadMaintenanceTasks();
      this.showToast("Maintenance task ledger refreshed from backend", "info");
    });

    this.maintStatusFilter = "ALL";
    this.maintSubsystemFilter = "ALL";
    this.maintPriorityFilter = "ALL";
    this.maintSearchQuery = "";
  }

  async loadMaintenanceTasks() {
    try {
      const filters = {};
      if (this.maintStatusFilter && this.maintStatusFilter !== "ALL") filters.status = this.maintStatusFilter;
      if (this.maintSubsystemFilter && this.maintSubsystemFilter !== "ALL") filters.subsystem = this.maintSubsystemFilter;
      if (this.maintPriorityFilter && this.maintPriorityFilter !== "ALL") filters.priority = this.maintPriorityFilter;

      const [tasks, summary] = await Promise.all([
        window.aeroAPI.listMaintenanceTasks(filters),
        window.aeroAPI.getMaintenanceSummary()
      ]);

      this.maintenanceList = tasks;

      // Update KPI numbers
      if (summary) {
        const totalEl = document.getElementById("maint-kpi-val-total");
        const overdueEl = document.getElementById("maint-kpi-val-overdue");
        const upcomingEl = document.getElementById("maint-kpi-val-upcoming");
        const critEl = document.getElementById("maint-kpi-val-critical");
        if (totalEl) totalEl.textContent = summary.total_tasks;
        if (overdueEl) overdueEl.textContent = summary.overdue_work_orders;
        if (upcomingEl) upcomingEl.textContent = summary.upcoming_maintenance;
        if (critEl) critEl.textContent = summary.critical_alerts;

        // Render Equipment Risk Matrix
        this.renderEquipmentRiskMatrix(summary.risk_matrix);
        // Render Timeline
        this.renderMaintenanceTimeline(summary.timeline_events);
      }

      this.renderMaintenanceTable();
    } catch (err) {
      console.warn("Failed to load maintenance data:", err.message);
    }
  }

  renderEquipmentRiskMatrix(riskList) {
    const container = document.getElementById("maint-risk-matrix-list");
    if (!container || !riskList) return;

    container.innerHTML = riskList.map(r => `
      <div class="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200 flex items-center justify-between transition-colors cursor-pointer" data-subsystem="${r.subsystem}">
        <div class="flex items-center gap-3">
          <span class="w-2.5 h-2.5 rounded-full ${r.risk_level === 'CRITICAL' ? 'bg-rose-500 animate-pulse' : (r.risk_level === 'HIGH' ? 'bg-amber-500' : 'bg-emerald-500')}"></span>
          <div>
            <span class="font-bold text-slate-800 text-xs font-mono block">${r.subsystem}</span>
            <span class="text-[11px] text-slate-500 font-sans">${r.component} — ${r.action}</span>
          </div>
        </div>
        <div class="text-right">
          <span class="font-mono font-bold text-xs ${r.health_score < 85 ? 'text-rose-600' : (r.health_score < 90 ? 'text-amber-600' : 'text-emerald-700')}">${r.health_score}%</span>
          <span class="block text-[10px] text-slate-400 font-mono">${r.risk_level}</span>
        </div>
      </div>
    `).join("");

    container.querySelectorAll("[data-subsystem]").forEach(el => {
      el.addEventListener("click", () => {
        const sub = el.getAttribute("data-subsystem");
        this.maintSubsystemFilter = sub;
        this.loadMaintenanceTasks();
        this.showToast(`Filtered work orders by ${sub}`, "info");
      });
    });
  }

  renderMaintenanceTimeline(events) {
    const container = document.getElementById("maint-timeline-list");
    if (!container || !events) return;

    container.innerHTML = events.map(e => `
      <div class="p-3 bg-slate-50 hover:bg-white rounded-lg border border-slate-200 space-y-1.5 transition-all cursor-pointer" data-evt-id="${e.id}">
        <div class="flex items-center justify-between text-xs font-mono">
          <strong class="text-slate-800">${e.stage}</strong>
          <span class="text-[10px] px-1.5 py-0.5 rounded ${e.status === 'ACTION_REQUIRED' ? 'bg-rose-100 text-rose-800 font-bold' : 'bg-slate-200 text-slate-700'}">${e.timeframe}</span>
        </div>
        <div class="text-[11px] text-slate-500 font-mono">${e.hours} • ${e.tasks} Tasks Scheduled</div>
      </div>
    `).join("");

    container.querySelectorAll("[data-evt-id]").forEach(el => {
      el.addEventListener("click", () => {
        const eid = el.getAttribute("data-evt-id");
        this.showToast(`Timeline Inspection: ${eid} scheduled parameters nominal`, "info");
      });
    });
  }

  renderMaintenanceTable() {
    const tbody = document.getElementById("maint-wo-tbody");
    if (!tbody) return;

    let list = this.maintenanceList || [];
    if (this.maintSearchQuery) {
      list = list.filter(t => 
        (t.task_order && t.task_order.toLowerCase().includes(this.maintSearchQuery)) ||
        (t.title && t.title.toLowerCase().includes(this.maintSearchQuery)) ||
        (t.subsystem && t.subsystem.toLowerCase().includes(this.maintSearchQuery)) ||
        (t.assigned_tech && t.assigned_tech.toLowerCase().includes(this.maintSearchQuery))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-sans">No matching work orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(t => {
      const priorityColors = {
        CRITICAL: "bg-rose-100 text-rose-800 border-rose-300",
        HIGH: "bg-amber-100 text-amber-800 border-amber-300",
        MEDIUM: "bg-sky-100 text-sky-800 border-sky-300",
        LOW: "bg-slate-100 text-slate-700 border-slate-300"
      };
      const statusColors = {
        OPEN: "bg-amber-50 text-amber-700 border border-amber-200",
        IN_PROGRESS: "bg-sky-50 text-sky-700 border border-sky-200",
        COMPLETED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        CANCELLED: "bg-slate-100 text-slate-500 border border-slate-200"
      };

      return `
        <tr class="hover:bg-slate-50/70 transition-colors cursor-pointer group" data-task-id="${t.id}">
          <td class="py-3 px-4 font-bold text-sky-700 font-mono whitespace-nowrap">${t.task_order || t.id}</td>
          <td class="py-3 px-4 font-sans text-slate-800">${t.subsystem}</td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${priorityColors[t.priority] || priorityColors.MEDIUM}">${t.priority}</span>
          </td>
          <td class="py-3 px-4 font-sans max-w-xs truncate" title="${t.title}">${t.title}</td>
          <td class="py-3 px-4 whitespace-nowrap text-slate-600 font-sans">${t.assigned_tech || 'Unassigned'}</td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${statusColors[t.status] || statusColors.OPEN}">${t.status}</span>
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1.5" onclick="event.stopPropagation()">
              <button class="btn-wo-edit p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Edit Work Order" data-id="${t.id}">
                <span class="material-symbols-outlined text-[16px]">edit</span>
              </button>
              <button class="btn-wo-toggle p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Toggle Status" data-id="${t.id}">
                <span class="material-symbols-outlined text-[16px]">swap_horiz</span>
              </button>
              <button class="btn-wo-del p-1 rounded hover:bg-rose-100 text-rose-600 cursor-pointer" title="Delete" data-id="${t.id}">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Wire row clicks to drawer
    tbody.querySelectorAll("tr[data-task-id]").forEach(tr => {
      tr.addEventListener("click", () => {
        const tid = tr.getAttribute("data-task-id");
        const task = this.maintenanceList.find(x => x.id === tid);
        if (task) {
          window.aeroDrawer?.openWorkOrderDrawer(
            task,
            async (id, payload) => {
              await window.aeroAPI.updateMaintenanceTask(id, payload);
              this.loadMaintenanceTasks();
              this.showToast("Work order saved successfully", "success");
            },
            async (id) => {
              await window.aeroAPI.deleteMaintenanceTask(id);
              this.loadMaintenanceTasks();
              this.showToast("Work order deleted", "info");
            }
          );
        }
      });
    });

    // Wire row buttons
    tbody.querySelectorAll(".btn-wo-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const tid = btn.getAttribute("data-id");
        const task = this.maintenanceList.find(x => x.id === tid);
        if (task) {
          window.aeroDrawer?.openWorkOrderDrawer(
            task,
            async (id, payload) => {
              await window.aeroAPI.updateMaintenanceTask(id, payload);
              this.loadMaintenanceTasks();
            },
            async (id) => {
              await window.aeroAPI.deleteMaintenanceTask(id);
              this.loadMaintenanceTasks();
            }
          );
        }
      });
    });

    tbody.querySelectorAll(".btn-wo-toggle").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tid = btn.getAttribute("data-id");
        const task = this.maintenanceList.find(x => x.id === tid);
        if (!task) return;
        const nextStatus = task.status === "OPEN" ? "IN_PROGRESS" : (task.status === "IN_PROGRESS" ? "COMPLETED" : "OPEN");
        await window.aeroAPI.updateMaintenanceStatus(tid, nextStatus);
        this.loadMaintenanceTasks();
        this.showToast(`Work order ${task.task_order || tid} transitioned to ${nextStatus}`, "info");
      });
    });

    tbody.querySelectorAll(".btn-wo-del").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tid = btn.getAttribute("data-id");
        if (confirm(`Permanently delete work order ${tid}?`)) {
          await window.aeroAPI.deleteMaintenanceTask(tid);
          this.loadMaintenanceTasks();
          this.showToast("Work order deleted successfully", "info");
        }
      });
    });
  }

  /* =============================================================
   * MODULE 2: REPORTS & ANALYTICS CONTROLLER
   * ============================================================= */
  initReportsModule() {
    document.getElementById("rep-btn-generate")?.addEventListener("click", () => {
      window.aeroDrawer?.openGenerateReportModal(async (payload) => {
        await window.aeroAPI.generateReport(payload);
        this.loadReports();
        this.showToast("Airworthiness report generated and saved to history!", "success");
      });
    });

    document.getElementById("rep-search-input")?.addEventListener("input", (e) => {
      this.repSearchQuery = e.target.value.trim().toLowerCase();
      this.renderReportsTable();
    });

    document.getElementById("rep-type-filter")?.addEventListener("change", (e) => {
      this.repTypeFilter = e.target.value;
      this.loadReports();
    });

    document.getElementById("rep-refresh-btn")?.addEventListener("click", () => {
      this.loadReports();
      this.showToast("Reports ledger refreshed from backend", "info");
    });

    this.repSearchQuery = "";
    this.repTypeFilter = "ALL";
    this.reportsList = [];
  }

  async loadReports() {
    try {
      const type = (this.repTypeFilter && this.repTypeFilter !== "ALL") ? this.repTypeFilter : null;
      const [reports, analytics] = await Promise.all([
        window.aeroAPI.listReports(type),
        window.aeroAPI.getReportsAnalytics()
      ]);

      this.reportsList = reports;
      const totalEl = document.getElementById("rep-kpi-total");
      if (totalEl) totalEl.textContent = reports.length;

      this.renderReportsTable();

      if (analytics) {
        this.renderReportsCharts(analytics.time_series);
        this.renderMultiAssetComparison(analytics.asset_comparisons);
      }
    } catch (err) {
      console.warn("Failed to load reports data:", err.message);
    }
  }

  renderReportsTable() {
    const tbody = document.getElementById("rep-history-tbody");
    if (!tbody) return;

    let list = this.reportsList || [];
    if (this.repSearchQuery) {
      list = list.filter(r => 
        r.id.toLowerCase().includes(this.repSearchQuery) ||
        r.title.toLowerCase().includes(this.repSearchQuery) ||
        r.asset_id.toLowerCase().includes(this.repSearchQuery) ||
        r.author.toLowerCase().includes(this.repSearchQuery)
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400 font-sans">No reports found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(r => `
      <tr class="hover:bg-slate-50/70 transition-colors cursor-pointer" data-rep-id="${r.id}">
        <td class="py-3 px-4 font-bold text-sky-700 whitespace-nowrap">${r.id}</td>
        <td class="py-3 px-4 font-sans text-slate-800 font-medium">${r.title}</td>
        <td class="py-3 px-4 whitespace-nowrap text-slate-600 font-sans">${r.asset_id}</td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.format === 'CSV' ? 'bg-emerald-100 text-emerald-800' : (r.format === 'JSON' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800')}">${r.format}</span>
        </td>
        <td class="py-3 px-4 whitespace-nowrap text-slate-500">${r.file_size_kb} KB</td>
        <td class="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">${new Date(r.generated_at).toLocaleDateString()}</td>
        <td class="py-3 px-4 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">READY</span>
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap" onclick="event.stopPropagation()">
          <div class="flex items-center justify-end gap-1.5">
            <button class="btn-rep-dl p-1.5 rounded hover:bg-slate-100 text-primary font-bold text-xs flex items-center gap-1 border border-slate-200 cursor-pointer" title="Download Report File" data-id="${r.id}">
              <span class="material-symbols-outlined text-[15px]">download</span>
              <span>Download</span>
            </button>
            <button class="btn-rep-del p-1 rounded hover:bg-rose-100 text-rose-600 cursor-pointer" title="Delete Report" data-id="${r.id}">
              <span class="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `).join("");

    // Wire row click to preview
    tbody.querySelectorAll("tr[data-rep-id]").forEach(tr => {
      tr.addEventListener("click", async () => {
        const rid = tr.getAttribute("data-rep-id");
        const report = await window.aeroAPI.getReport(rid);
        if (report) {
          const html = `
            <div class="p-6">
              <div class="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 class="font-bold text-slate-900 text-base">${report.title}</h3>
                  <p class="text-xs font-mono text-slate-500">${report.id} • ${report.format} • ${report.file_size_kb} KB</p>
                </div>
                <button data-role="modal-close" class="p-1 rounded text-slate-400 hover:text-slate-600">
                  <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div class="mt-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs font-sans text-slate-700">
                <strong>Executive Summary:</strong> ${report.preview_summary}
              </div>
              <div class="mt-4 bg-slate-950 text-slate-200 p-4 rounded-lg font-mono text-xs max-h-72 overflow-y-auto whitespace-pre">
${report.data_content || 'No text data available.'}
              </div>
              <div class="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 mt-4">
                <button data-role="modal-close" class="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded">Close</button>
                <button id="modal-rep-dl-btn" class="px-4 py-1.5 text-xs font-bold bg-primary text-white rounded hover:bg-slate-800 flex items-center gap-1 cursor-pointer">
                  <span class="material-symbols-outlined text-[16px]">download</span> Download ${report.format}
                </button>
              </div>
            </div>
          `;
          window.aeroDrawer?.openModal(html);
          document.getElementById("modal-rep-dl-btn")?.addEventListener("click", () => {
            window.location.href = window.aeroAPI.getReportDownloadUrl(report.id);
            this.showToast(`Downloading ${report.id}...`, "success");
          });
        }
      });
    });

    tbody.querySelectorAll(".btn-rep-dl").forEach(btn => {
      btn.addEventListener("click", () => {
        const rid = btn.getAttribute("data-id");
        window.location.href = window.aeroAPI.getReportDownloadUrl(rid);
        this.showToast(`Downloading report ${rid}...`, "success");
      });
    });

    tbody.querySelectorAll(".btn-rep-del").forEach(btn => {
      btn.addEventListener("click", async () => {
        const rid = btn.getAttribute("data-id");
        if (confirm(`Permanently delete report ${rid}?`)) {
          await window.aeroAPI.deleteReport(rid);
          this.loadReports();
          this.showToast("Report deleted", "info");
        }
      });
    });
  }

  renderReportsCharts(timeSeries) {
    if (!timeSeries) return;
    const canvas = document.getElementById("rep-health-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1;
    for (let y = 30; y < h - 20; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();
    }

    const points = timeSeries.map((d, i) => {
      const x = 50 + (i / (timeSeries.length - 1)) * (w - 80);
      const y = h - 40 - ((d.health_index - 85) / 15) * (h - 70);
      return { x, y, val: d.health_index, label: d.day, anom: d.anomaly_count };
    });

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(56, 189, 248, 0.35)");
    grad.addColorStop(1, "rgba(56, 189, 248, 0.0)");

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, h - 30);
    ctx.lineTo(points[0].x, h - 30);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    points.forEach(p => {
      ctx.fillStyle = p.anom > 0 ? "#f43f5e" : "#0284c7";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.anom > 0 ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px JetBrains Mono";
      ctx.fillText(p.label, p.x - 12, h - 10);
    });

    // Render sensor residuals canvas
    const sensorCanvas = document.getElementById("rep-sensor-canvas");
    if (sensorCanvas) {
      const sCtx = sensorCanvas.getContext("2d");
      const sRect = sensorCanvas.getBoundingClientRect();
      sensorCanvas.width = sRect.width * (window.devicePixelRatio || 1);
      sensorCanvas.height = sRect.height * (window.devicePixelRatio || 1);
      sCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      sCtx.clearRect(0, 0, sRect.width, sRect.height);

      const bars = [
        { label: "CHT #3 Dev", val: 5.2, max: 15, color: "#f59e0b" },
        { label: "EGT #3 Dev", val: 18.0, max: 25, color: "#ef4444" },
        { label: "Fuel Bias", val: 0.5, max: 1.0, color: "#f43f5e" },
        { label: "Oil Press Dev", val: 0.05, max: 0.5, color: "#10b981" }
      ];

      bars.forEach((b, idx) => {
        const bx = 30;
        const by = 25 + idx * 50;
        const bw = (b.val / b.max) * (sRect.width - 120);

        sCtx.fillStyle = "#cbd5e1";
        sCtx.font = "11px JetBrains Mono";
        sCtx.fillText(b.label, bx, by - 6);

        sCtx.fillStyle = "rgba(148, 163, 184, 0.2)";
        sCtx.fillRect(bx, by, sRect.width - 120, 16);

        sCtx.fillStyle = b.color;
        sCtx.fillRect(bx, by, Math.max(8, bw), 16);

        sCtx.fillStyle = "#f8fafc";
        sCtx.font = "bold 11px JetBrains Mono";
        sCtx.fillText(`+${b.val}`, bx + bw + 8, by + 12);
      });
    }
  }

  renderMultiAssetComparison(comparisons) {
    const container = document.getElementById("rep-comparison-grid");
    if (!container || !comparisons) return;

    container.innerHTML = comparisons.map(c => `
      <div class="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 space-y-2 transition-colors cursor-pointer" data-asset="${c.asset}">
        <div class="flex items-center justify-between">
          <strong class="text-slate-800 font-mono text-xs">${c.asset}</strong>
          <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${c.health < 93 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${c.health}% Health</span>
        </div>
        <div class="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-600">
          <div>TTSN: <strong>${c.hours}h</strong></div>
          <div>Fuel: <strong>${c.fuel_burn_lph} L/h</strong></div>
        </div>
        <div class="text-[10px] text-slate-400 font-mono flex justify-between border-t border-slate-200 pt-1">
          <span>${c.model}</span>
          <span class="text-sky-700 font-semibold">RUL: ${c.rul_hours}h</span>
        </div>
      </div>
    `).join("");

    container.querySelectorAll("[data-asset]").forEach(el => {
      el.addEventListener("click", () => {
        const aid = el.getAttribute("data-asset");
        this.showToast(`Selected ${aid} for comparative diagnostics`, "info");
      });
    });
  }

  /* =============================================================
   * MODULE 3: EDGE AI CONSOLE CONTROLLER
   * ============================================================= */
  initEdgeAIModule() {
    document.getElementById("edge-refresh-all-btn")?.addEventListener("click", () => {
      this.loadEdgeDevices();
      this.showToast("All edge hardware nodes polled and telemetry synchronized", "info");
    });

    document.getElementById("edge-status-filter")?.addEventListener("change", (e) => {
      this.edgeStatusFilter = e.target.value;
      this.loadEdgeDevices();
    });

    document.getElementById("edge-kpi-online")?.addEventListener("click", () => {
      this.edgeStatusFilter = "ONLINE";
      const sel = document.getElementById("edge-status-filter");
      if (sel) sel.value = "ONLINE";
      this.loadEdgeDevices();
      this.showToast("Filtered: Online active nodes", "info");
    });

    document.getElementById("edge-kpi-offline")?.addEventListener("click", () => {
      this.edgeStatusFilter = "OFFLINE";
      const sel = document.getElementById("edge-status-filter");
      if (sel) sel.value = "OFFLINE";
      this.loadEdgeDevices();
      this.showToast("Filtered: Offline test nodes", "info");
    });

    document.getElementById("edge-kpi-attention")?.addEventListener("click", () => {
      this.edgeStatusFilter = "ATTENTION";
      const sel = document.getElementById("edge-status-filter");
      if (sel) sel.value = "ATTENTION";
      this.loadEdgeDevices();
      this.showToast("Filtered: Nodes requiring thermal or memory attention", "warning");
    });

    document.getElementById("edge-kpi-models")?.addEventListener("click", () => {
      document.getElementById("edge-models-grid")?.scrollIntoView({ behavior: "smooth" });
      this.showToast("Viewing deployed AI models catalog", "info");
    });

    this.edgeStatusFilter = "ALL";
    this.edgeDevicesList = [];
    this.edgeModelsList = [];
  }

  async loadEdgeDevices() {
    try {
      const statusParam = (this.edgeStatusFilter && this.edgeStatusFilter !== "ALL") ? this.edgeStatusFilter : null;
      const [devices, models, pipeline, summary] = await Promise.all([
        window.aeroAPI.listEdgeDevices(statusParam),
        window.aeroAPI.listAIModels(),
        window.aeroAPI.getEdgePipeline(),
        window.aeroAPI.getEdgeAISummary()
      ]);

      this.edgeDevicesList = devices;
      this.edgeModelsList = models;

      if (summary) {
        const onEl = document.getElementById("edge-kpi-val-online");
        const offEl = document.getElementById("edge-kpi-val-offline");
        const attEl = document.getElementById("edge-kpi-val-attention");
        const modEl = document.getElementById("edge-kpi-val-models");
        if (onEl) onEl.textContent = summary.online_devices;
        if (offEl) offEl.textContent = summary.offline_devices;
        if (attEl) attEl.textContent = summary.attention_devices;
        if (modEl) modEl.textContent = summary.active_models;
      }

      this.renderEdgeDevicesTable();
      this.renderEdgePipeline(pipeline);
      this.renderEdgeModelsGrid();
    } catch (err) {
      console.warn("Failed to load Edge AI data:", err.message);
    }
  }

  renderEdgeDevicesTable() {
    const tbody = document.getElementById("edge-devices-tbody");
    if (!tbody) return;

    if (!this.edgeDevicesList || this.edgeDevicesList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400 font-sans">No edge nodes matching filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.edgeDevicesList.map(d => {
      const statusBadges = {
        ONLINE: "bg-emerald-100 text-emerald-800 border-emerald-300",
        OFFLINE: "bg-slate-100 text-slate-600 border-slate-300",
        ATTENTION: "bg-amber-100 text-amber-800 border-amber-300"
      };

      return `
        <tr class="hover:bg-slate-50/70 transition-colors cursor-pointer" data-dev-id="${d.id}">
          <td class="py-3 px-4 font-mono">
            <span class="font-bold text-slate-900 block">${d.id}</span>
            <span class="text-[11px] text-slate-500 font-sans">${d.name}</span>
          </td>
          <td class="py-3 px-4 font-mono text-slate-600 text-xs">
            <div>${d.ip_address}</div>
            <div class="text-[10px] text-slate-400">${d.can_node_id}</div>
          </td>
          <td class="py-3 px-4 text-xs font-sans text-slate-700">${d.hardware}</td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${statusBadges[d.status]}">${d.status}</span>
          </td>
          <td class="py-3 px-4 font-mono text-xs">
            <div class="flex items-center gap-2">
              <span class="w-12">${d.cpu_util_pct}% CPU</span>
              <div class="w-16 bg-slate-200 h-1.5 rounded overflow-hidden">
                <div class="bg-primary h-full" style="width: ${d.cpu_util_pct}%"></div>
              </div>
            </div>
            <div class="text-[10px] text-slate-400 mt-0.5">${d.memory_used_gb} / ${d.memory_total_gb} GB RAM</div>
          </td>
          <td class="py-3 px-4 font-mono text-xs">
            <span class="font-bold ${d.temperature_c > 65 ? 'text-rose-600' : 'text-slate-700'}">${d.temperature_c} °C</span>
            <div class="text-[10px] text-slate-400">${d.power_mode}</div>
          </td>
          <td class="py-3 px-4 font-mono text-[10px]">
            ${d.active_models.map(m => `<span class="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 mr-1 mb-0.5">${m}</span>`).join("") || '<span class="text-slate-400">None</span>'}
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap" onclick="event.stopPropagation()">
            <div class="flex items-center justify-end gap-1.5">
              <button class="btn-dev-cfg p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Configure Node" data-id="${d.id}">
                <span class="material-symbols-outlined text-[16px]">tune</span>
              </button>
              <button class="btn-dev-logs p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="View Hardware Logs" data-id="${d.id}">
                <span class="material-symbols-outlined text-[16px]">terminal</span>
              </button>
              <button class="btn-dev-ping p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Ping Device" data-id="${d.id}">
                <span class="material-symbols-outlined text-[16px]">satellite_alt</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Wire buttons
    tbody.querySelectorAll(".btn-dev-cfg").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const dev = this.edgeDevicesList.find(x => x.id === id);
        if (dev) {
          window.aeroDrawer?.openDeviceConfigModal(dev, async (devId, cfg) => {
            await window.aeroAPI.updateEdgeDeviceConfig(devId, cfg);
            this.loadEdgeDevices();
            this.showToast("Edge device configuration updated and synchronized!", "success");
          });
        }
      });
    });

    tbody.querySelectorAll(".btn-dev-logs").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const dev = this.edgeDevicesList.find(x => x.id === id);
        if (dev) {
          const res = await window.aeroAPI.getEdgeDeviceLogs(id);
          window.aeroDrawer?.openDeviceLogsModal(dev, res.logs || []);
        }
      });
    });

    tbody.querySelectorAll(".btn-dev-ping").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const res = await window.aeroAPI.refreshEdgeDevice(id);
        this.showToast(`Ping ${id}: Status ${res.current_status} • CPU ${res.cpu_util_pct}%`, "info");
        this.loadEdgeDevices();
      });
    });
  }

  renderEdgePipeline(pipeline) {
    const container = document.getElementById("edge-pipeline-cards");
    if (!container || !pipeline || !pipeline.stages) return;

    container.innerHTML = pipeline.stages.map(s => `
      <div class="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 space-y-1 transition-all cursor-pointer" data-stage-id="${s.stage_id}">
        <div class="flex items-center justify-between text-xs font-mono">
          <span class="text-slate-400">STAGE ${s.stage_id}</span>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${s.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${s.status}</span>
        </div>
        <div class="font-bold text-slate-800 text-xs font-mono truncate" title="${s.name}">${s.name}</div>
        <div class="text-[11px] text-sky-700 font-mono font-semibold">${s.latency_us ? `${s.latency_us} µs` : `${s.latency_ms} ms`}</div>
        <div class="text-[10px] text-slate-400 font-mono">${s.rate}</div>
      </div>
    `).join("");

    container.querySelectorAll("[data-stage-id]").forEach(card => {
      card.addEventListener("click", () => {
        const sid = parseInt(card.getAttribute("data-stage-id"), 10);
        const stage = pipeline.stages.find(x => x.stage_id === sid);
        const inspector = document.getElementById("edge-stage-inspector");
        if (stage && inspector) {
          inspector.innerHTML = `
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <strong class="text-slate-900 text-xs uppercase">STAGE ${stage.stage_id}: ${stage.name}</strong>
                <span class="text-emerald-700 font-bold">${stage.status}</span>
              </div>
              <p class="text-slate-600 font-sans">${stage.description}</p>
              <div class="flex gap-4 text-slate-500 pt-1 text-[11px]">
                <span>Processing Rate: <strong class="text-slate-800">${stage.rate}</strong></span>
                <span>Latency Budget: <strong class="text-sky-700">${stage.latency_us ? `${stage.latency_us} µs` : `${stage.latency_ms} ms`}</strong></span>
              </div>
            </div>
          `;
          this.showToast(`Inspecting Stage ${stage.stage_id}: ${stage.name}`, "info");
        }
      });
    });
  }

  renderEdgeModelsGrid() {
    const container = document.getElementById("edge-models-grid");
    if (!container || !this.edgeModelsList) return;

    container.innerHTML = this.edgeModelsList.map(m => `
      <div class="bg-surface-container-lowest border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-3">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold">${m.precision}</span>
            <span class="text-[10px] font-mono text-emerald-700 font-bold">${m.accuracy_pct}% ACC</span>
          </div>
          <h4 class="font-bold text-slate-900 text-xs mt-2 font-mono">${m.id}</h4>
          <p class="text-xs text-slate-500 font-sans mt-0.5 leading-snug">${m.name}</p>
        </div>
        <div class="space-y-1 text-xs font-mono text-slate-600 border-t border-slate-100 pt-2">
          <div class="flex justify-between"><span>Execution Time:</span><strong>${m.latency_ms} ms</strong></div>
          <div class="flex justify-between"><span>Package Size:</span><strong>${m.size_mb} MB</strong></div>
          <div class="flex justify-between"><span>Deployed On:</span><span class="text-slate-800">${m.deployed_devices.length} Nodes</span></div>
        </div>
        <button class="btn-model-deploy w-full py-2 bg-primary hover:bg-slate-800 text-white font-semibold text-xs rounded transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer" data-model-id="${m.id}">
          <span class="material-symbols-outlined text-[15px]">rocket_launch</span>
          <span>Deploy / Update OTA</span>
        </button>
      </div>
    `).join("");

    container.querySelectorAll(".btn-model-deploy").forEach(btn => {
      btn.addEventListener("click", () => {
        const mid = btn.getAttribute("data-model-id");
        const model = this.edgeModelsList.find(x => x.id === mid);
        if (model) {
          window.aeroDrawer?.openDeployModelModal(
            model,
            this.edgeDevicesList,
            async (payload) => {
              const res = await window.aeroAPI.deployAIModel(payload);
              this.loadEdgeDevices();
              this.showToast(`Deployed ${model.id} to ${payload.target_device_id}`, "success");
              return res;
            }
          );
        }
      });
    });
  }

  /* =============================================================
   * MODULE 4: SENSOR DATA QUALITY CONTROLLER
   * ============================================================= */
  initDataQualityModule() {
    document.getElementById("dq-btn-revalidate")?.addEventListener("click", async () => {
      const summary = await window.aeroAPI.getDataQualitySummary();
      this.loadDataQuality();
      this.showToast(`Validation cycle finished. Completeness: ${summary.completeness_score_pct}%`, "success");
    });

    document.getElementById("dq-sensor-search")?.addEventListener("input", (e) => {
      this.dqSearchQuery = e.target.value.trim().toLowerCase();
      this.renderSensorMatrixTable();
    });

    document.getElementById("dq-status-filter")?.addEventListener("change", (e) => {
      this.dqStatusFilter = e.target.value;
      this.loadDataQuality();
    });

    document.getElementById("dq-compare-sensor-select")?.addEventListener("change", (e) => {
      this.loadRawVsValidatedComparison(e.target.value);
    });

    document.getElementById("dq-incident-status-filter")?.addEventListener("change", (e) => {
      this.dqIncidentStatusFilter = e.target.value;
      this.loadQualityIncidents();
    });

    // KPI Clicks
    document.getElementById("dq-kpi-card-comp")?.addEventListener("click", () => {
      this.dqStatusFilter = "ALL";
      const sel = document.getElementById("dq-status-filter");
      if (sel) sel.value = "ALL";
      this.loadDataQuality();
      this.showToast("Data completeness nominal: 99.2% zero frame-loss verified", "success");
    });

    document.getElementById("dq-kpi-card-miss")?.addEventListener("click", () => {
      this.dqStatusFilter = "ALL";
      this.loadDataQuality();
      this.showToast("Showing sensors with recorded missing frames", "info");
    });

    document.getElementById("dq-kpi-card-inv")?.addEventListener("click", () => {
      this.dqStatusFilter = "FLAGGED";
      const sel = document.getElementById("dq-status-filter");
      if (sel) sel.value = "FLAGGED";
      this.loadDataQuality();
      this.showToast("Filtered: Sensors with active physics validation violations", "warning");
    });

    document.getElementById("dq-kpi-card-stale")?.addEventListener("click", () => {
      this.dqStatusFilter = "STALE";
      const sel = document.getElementById("dq-status-filter");
      if (sel) sel.value = "STALE";
      this.loadDataQuality();
      this.showToast("Filtered: Sensors with zero-variance frozen readings", "error");
    });

    document.getElementById("dq-kpi-card-grade")?.addEventListener("click", () => {
      this.showToast("Overall Quality: Grade A- (93.8%) Airworthiness certified under STANAG 4586", "info");
    });

    this.dqStatusFilter = "ALL";
    this.dqSearchQuery = "";
    this.dqIncidentStatusFilter = "ALL";
    this.sensorsList = [];
  }

  async loadDataQuality() {
    try {
      const statusParam = (this.dqStatusFilter && this.dqStatusFilter !== "ALL") ? this.dqStatusFilter : null;
      const [sensors, summary] = await Promise.all([
        window.aeroAPI.listSensorQualityMatrix(statusParam),
        window.aeroAPI.getDataQualitySummary()
      ]);

      this.sensorsList = sensors;

      if (summary) {
        const compEl = document.getElementById("dq-kpi-completeness");
        const missEl = document.getElementById("dq-kpi-missing");
        const invEl = document.getElementById("dq-kpi-invalid");
        const staleEl = document.getElementById("dq-kpi-stale");
        const gradeEl = document.getElementById("dq-kpi-grade");
        if (compEl) compEl.textContent = `${summary.completeness_score_pct}%`;
        if (missEl) missEl.textContent = summary.missing_readings_count;
        if (invEl) invEl.textContent = summary.invalid_readings_count;
        if (staleEl) staleEl.textContent = summary.stale_sensors_count;
        if (gradeEl) gradeEl.textContent = summary.overall_quality_grade;
      }

      this.renderSensorMatrixTable();
      this.loadRawVsValidatedComparison(document.getElementById("dq-compare-sensor-select")?.value || "CHT-03");
      this.loadQualityIncidents();
    } catch (err) {
      console.warn("Failed to load Data Quality data:", err.message);
    }
  }

  renderSensorMatrixTable() {
    const tbody = document.getElementById("dq-sensors-tbody");
    if (!tbody) return;

    let list = this.sensorsList || [];
    if (this.dqSearchQuery) {
      list = list.filter(s => 
        s.sensor_id.toLowerCase().includes(this.dqSearchQuery) ||
        s.channel_name.toLowerCase().includes(this.dqSearchQuery) ||
        s.subsystem.toLowerCase().includes(this.dqSearchQuery)
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400 font-sans">No matching sensors found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(s => {
      const statusBadges = {
        HEALTHY: "bg-emerald-100 text-emerald-800 border-emerald-300",
        DRIFTING: "bg-amber-100 text-amber-800 border-amber-300",
        FLAGGED: "bg-rose-100 text-rose-800 border-rose-300",
        STALE: "bg-purple-100 text-purple-800 border-purple-300"
      };

      return `
        <tr class="hover:bg-slate-50/70 transition-colors cursor-pointer" data-sensor-id="${s.sensor_id}">
          <td class="py-3 px-4 font-mono">
            <span class="font-bold text-slate-900 block">${s.sensor_id}</span>
            <span class="text-[11px] text-slate-500 font-sans">${s.channel_name}</span>
          </td>
          <td class="py-3 px-4 text-xs font-sans text-slate-700">${s.subsystem}</td>
          <td class="py-3 px-4 font-mono text-xs">${s.sample_rate_hz} Hz</td>
          <td class="py-3 px-4 font-mono text-xs">σ = ${s.noise_sigma}</td>
          <td class="py-3 px-4 font-mono text-xs ${s.drift_score > 0.5 ? 'text-amber-600 font-bold' : 'text-slate-600'}">${s.drift_score}</td>
          <td class="py-3 px-4 font-mono text-xs ${s.error_count_24h > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}">${s.error_count_24h}</td>
          <td class="py-3 px-4 font-mono text-xs">
            <div class="flex items-center gap-2">
              <span class="font-bold">${s.quality_score}%</span>
              <div class="w-12 bg-slate-200 h-1.5 rounded overflow-hidden">
                <div class="${s.quality_score < 85 ? 'bg-rose-500' : (s.quality_score < 92 ? 'bg-amber-500' : 'bg-emerald-500')} h-full" style="width: ${s.quality_score}%"></div>
              </div>
            </div>
          </td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${statusBadges[s.status] || statusBadges.HEALTHY}">${s.status}</span>
          </td>
          <td class="py-3 px-4 text-right font-mono text-xs text-slate-700 whitespace-nowrap">${s.last_reading}</td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("tr[data-sensor-id]").forEach(tr => {
      tr.addEventListener("click", () => {
        const sid = tr.getAttribute("data-sensor-id");
        const s = this.sensorsList.find(x => x.sensor_id === sid);
        if (s) {
          window.aeroDrawer?.openSensorDrawer(s.sensor_id, s.channel_name, s.unit, s.last_reading.split(" ")[0]);
        }
      });
    });
  }

  async loadRawVsValidatedComparison(sensorId) {
    try {
      const data = await window.aeroAPI.getRawVsValidatedComparison(sensorId);
      if (!data || !data.observations) return;

      const canvas = document.getElementById("dq-comparison-canvas");
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * (window.devicePixelRatio || 1);
        canvas.height = rect.height * (window.devicePixelRatio || 1);
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        ctx.clearRect(0, 0, rect.width, rect.height);

        const w = rect.width;
        const h = rect.height;
        const obs = data.observations;

        const allVals = obs.flatMap(o => [o.raw_value, o.validated_value]);
        const minVal = Math.min(...allVals) - 2;
        const maxVal = Math.max(...allVals) + 2;
        const range = maxVal - minVal || 1;

        // Draw Raw line (Red/Orange)
        ctx.beginPath();
        obs.forEach((o, idx) => {
          const x = 40 + (idx / (obs.length - 1)) * (w - 70);
          const y = h - 30 - ((o.raw_value - minVal) / range) * (h - 50);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Validated line (Cyan)
        ctx.beginPath();
        obs.forEach((o, idx) => {
          const x = 40 + (idx / (obs.length - 1)) * (w - 70);
          const y = h - 30 - ((o.validated_value - minVal) / range) * (h - 50);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        obs.forEach((o, idx) => {
          const x = 40 + (idx / (obs.length - 1)) * (w - 70);
          const yRaw = h - 30 - ((o.raw_value - minVal) / range) * (h - 50);
          ctx.fillStyle = o.outcome === "FLAGGED_SPIKE" ? "#ef4444" : "#f43f5e";
          ctx.beginPath();
          ctx.arc(x, yRaw, o.outcome === "FLAGGED_SPIKE" ? 5 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Render Observations Table (last 6)
      const tbody = document.getElementById("dq-observations-tbody");
      if (tbody) {
        tbody.innerHTML = data.observations.slice(-6).map(o => `
          <tr class="hover:bg-slate-50/60 font-mono text-xs">
            <td class="py-2 px-3 text-slate-500">${o.timestamp}</td>
            <td class="py-2 px-3 text-slate-800 font-bold">${o.raw_value} ${o.unit}</td>
            <td class="py-2 px-3 text-cyan-700 font-bold">${o.validated_value} ${o.unit}</td>
            <td class="py-2 px-3 ${Math.abs(o.delta) > 2 ? 'text-rose-600 font-bold' : 'text-slate-500'}">${o.delta > 0 ? '+' : ''}${o.delta}</td>
            <td class="py-2 px-3 text-right">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${o.outcome === 'FLAGGED_SPIKE' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">${o.outcome}</span>
            </td>
          </tr>
        `).join("");
      }
    } catch (err) {
      console.warn("Failed to load raw vs validated comparison:", err.message);
    }
  }

  async loadQualityIncidents() {
    try {
      const statusParam = (this.dqIncidentStatusFilter && this.dqIncidentStatusFilter !== "ALL") ? this.dqIncidentStatusFilter : null;
      const incidents = await window.aeroAPI.listQualityIncidents(statusParam);
      const tbody = document.getElementById("dq-incidents-tbody");
      if (!tbody) return;

      if (!incidents || incidents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400 font-sans">No matching incidents.</td></tr>`;
        return;
      }

      tbody.innerHTML = incidents.map(inc => `
        <tr class="hover:bg-slate-50/70 transition-colors cursor-pointer" data-inc-id="${inc.id}">
          <td class="py-3 px-4 font-mono font-bold text-sky-700">${inc.id}</td>
          <td class="py-3 px-4 font-mono text-xs">
            <span class="font-bold text-slate-800 block">${inc.sensor_id}</span>
            <span class="text-[11px] text-slate-500 font-sans">${inc.parameter}</span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${inc.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : (inc.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')}">${inc.severity}</span>
          </td>
          <td class="py-3 px-4 text-xs font-sans text-slate-700">${inc.rule_broken}</td>
          <td class="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">${new Date(inc.detected_at).toLocaleTimeString()}</td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${inc.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : (inc.status === 'INVESTIGATING' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800')}">${inc.status}</span>
          </td>
          <td class="py-3 px-4 text-xs font-sans text-slate-700 whitespace-nowrap">${inc.assigned_to}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap" onclick="event.stopPropagation()">
            <button class="btn-inc-edit px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 cursor-pointer" data-id="${inc.id}">
              Inspect / Edit
            </button>
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll("tr[data-inc-id], .btn-inc-edit").forEach(el => {
        el.addEventListener("click", () => {
          const iid = el.getAttribute("data-inc-id") || el.getAttribute("data-id");
          const inc = incidents.find(x => x.id === iid);
          if (inc) {
            window.aeroDrawer?.openIncidentModal(
              inc,
              async (id, data) => {
                await window.aeroAPI.updateQualityIncident(id, data);
                this.loadQualityIncidents();
                this.showToast("Incident updated successfully", "success");
              },
              async (id, notes) => {
                await window.aeroAPI.resolveQualityIncident(id, notes);
                this.loadQualityIncidents();
                this.showToast("Incident resolved and archived!", "success");
              }
            );
          }
        });
      });
    } catch (err) {
      console.warn("Failed to load quality incidents:", err.message);
    }
  }

  /* =============================================================
   * MODULE 5: FLEET OPERATIONS CONTROLLER
   * ============================================================= */
  initFleetModule() {
    document.getElementById("fleet-refresh-btn")?.addEventListener("click", () => {
      this.loadFleet();
      this.showToast("Fleet operations status synchronized from global theater", "info");
    });

    document.getElementById("fleet-search-input")?.addEventListener("input", (e) => {
      this.fleetSearchQuery = e.target.value.trim().toLowerCase();
      this.renderFleetTable();
    });

    document.getElementById("fleet-status-filter")?.addEventListener("change", (e) => {
      this.fleetStatusFilter = e.target.value;
      this.loadFleet();
    });

    document.getElementById("fleet-kpi-total")?.addEventListener("click", () => {
      this.fleetStatusFilter = "ALL";
      const sel = document.getElementById("fleet-status-filter");
      if (sel) sel.value = "ALL";
      this.loadFleet();
      this.showToast("Showing all 8 registered fleet aircraft", "info");
    });

    document.getElementById("fleet-kpi-operational")?.addEventListener("click", () => {
      this.fleetStatusFilter = "OPERATIONAL";
      const sel = document.getElementById("fleet-status-filter");
      if (sel) sel.value = "OPERATIONAL";
      this.loadFleet();
      this.showToast("Filtered: Operational flight-ready airframes", "info");
    });

    document.getElementById("fleet-kpi-offline")?.addEventListener("click", () => {
      this.fleetStatusFilter = "MAINTENANCE";
      const sel = document.getElementById("fleet-status-filter");
      if (sel) sel.value = "MAINTENANCE";
      this.loadFleet();
      this.showToast("Filtered: Depot maintenance airframes", "warning");
    });

    document.getElementById("fleet-kpi-standby")?.addEventListener("click", () => {
      this.fleetStatusFilter = "STANDBY";
      const sel = document.getElementById("fleet-status-filter");
      if (sel) sel.value = "STANDBY";
      this.loadFleet();
      this.showToast("Filtered: Standby alert aircraft", "info");
    });

    this.fleetStatusFilter = "ALL";
    this.fleetSearchQuery = "";
    this.fleetAssetsList = [];
    this.fleetAlertsList = [];
  }

  async loadFleet() {
    try {
      const statusParam = (this.fleetStatusFilter && this.fleetStatusFilter !== "ALL") ? this.fleetStatusFilter : null;
      const [assets, summary, comparison, alerts] = await Promise.all([
        window.aeroAPI.listFleetAssets(statusParam),
        window.aeroAPI.getFleetSummary(),
        window.aeroAPI.getFleetComparison("UAV-01,UAV-03,UAV-07"),
        window.aeroAPI.listFleetAlerts()
      ]);

      this.fleetAssetsList = assets;
      this.fleetAlertsList = alerts;

      if (summary) {
        const totEl = document.getElementById("fleet-kpi-val-total");
        const opEl = document.getElementById("fleet-kpi-val-operational");
        const offEl = document.getElementById("fleet-kpi-val-offline");
        const stEl = document.getElementById("fleet-kpi-val-standby");
        if (totEl) totEl.textContent = summary.total_assets;
        if (opEl) opEl.textContent = summary.operational_assets;
        if (offEl) offEl.textContent = summary.offline_maintenance_assets;
        if (stEl) stEl.textContent = summary.standby_assets;
      }

      this.renderTacticalFleetGrid();
      this.renderFleetTable();
      this.renderFleetComparison(comparison);
      this.renderFleetAlerts();
    } catch (err) {
      console.warn("Failed to load Fleet data:", err.message);
    }
  }

  renderTacticalFleetGrid() {
    const container = document.getElementById("fleet-tactical-grid");
    if (!container || !this.fleetAssetsList) return;

    container.innerHTML = this.fleetAssetsList.map(a => {
      const isLive = a.id === "UAV-07";
      return `
        <div class="p-3.5 bg-slate-50 hover:bg-white rounded-xl border ${isLive ? 'border-primary ring-1 ring-primary/40' : 'border-slate-200'} shadow-xs hover:shadow-md transition-all cursor-pointer space-y-2" data-asset-id="${a.id}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${a.operational_status === 'OPERATIONAL' ? 'bg-emerald-500' : (a.operational_status === 'MAINTENANCE' ? 'bg-rose-500' : 'bg-slate-400')}"></span>
              <strong class="text-xs font-mono text-slate-900">${a.id}</strong>
              <span class="text-[10px] text-slate-500 font-sans">(${a.callsign})</span>
            </div>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${a.health_index < 93 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${a.health_index}%</span>
          </div>
          <div class="text-[11px] font-mono text-slate-600">
            <div>${a.latitude.toFixed(2)}°N, ${Math.abs(a.longitude).toFixed(2)}°W</div>
            <div class="text-[10px] text-slate-400">${a.altitude_ft.toLocaleString()} ft • ${a.base_station}</div>
          </div>
          <div class="flex items-center justify-between text-[10px] font-mono border-t border-slate-200 pt-1.5 text-slate-500">
            <span>TTSN: ${a.flight_hours_ttsn}h</span>
            <span class="text-sky-700 font-semibold">${a.active_mission || 'STANDBY'}</span>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-asset-id]").forEach(card => {
      card.addEventListener("click", () => {
        const aid = card.getAttribute("data-asset-id");
        const asset = this.fleetAssetsList.find(x => x.id === aid);
        if (asset) {
          window.aeroDrawer?.openAssetDetailsDrawer(asset, (a) => {
            window.aeroDrawer?.openEditAssetModal(a, async (id, data) => {
              await window.aeroAPI.updateFleetAsset(id, data);
              this.loadFleet();
              this.showToast(`Updated metadata for ${id}`, "success");
            });
          });
        }
      });
    });
  }

  renderFleetTable() {
    const tbody = document.getElementById("fleet-assets-tbody");
    if (!tbody) return;

    let list = this.fleetAssetsList || [];
    if (this.fleetSearchQuery) {
      list = list.filter(a => 
        a.id.toLowerCase().includes(this.fleetSearchQuery) ||
        a.callsign.toLowerCase().includes(this.fleetSearchQuery) ||
        a.base_station.toLowerCase().includes(this.fleetSearchQuery) ||
        a.tail_number.toLowerCase().includes(this.fleetSearchQuery)
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400 font-sans">No matching fleet aircraft.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(a => {
      const statusBadges = {
        OPERATIONAL: "bg-emerald-100 text-emerald-800 border-emerald-300",
        STANDBY: "bg-sky-100 text-sky-800 border-sky-300",
        MAINTENANCE: "bg-rose-100 text-rose-800 border-rose-300",
        OFFLINE: "bg-slate-100 text-slate-600 border-slate-300"
      };

      return `
        <tr class="hover:bg-slate-50/70 transition-colors cursor-pointer" data-asset-id="${a.id}">
          <td class="py-3 px-4 font-mono">
            <span class="font-bold text-slate-900 block">${a.id} (${a.callsign})</span>
            <span class="text-[10px] text-slate-400">${a.tail_number}</span>
          </td>
          <td class="py-3 px-4 text-xs font-sans text-slate-700">
            <div>${a.airframe_model}</div>
            <div class="text-[10px] text-slate-400 font-mono">${a.engine_model}</div>
          </td>
          <td class="py-3 px-4 text-xs font-sans text-slate-600">${a.base_station}</td>
          <td class="py-3 px-4 font-mono text-xs font-bold text-slate-800">${a.flight_hours_ttsn} h</td>
          <td class="py-3 px-4 font-mono text-xs">
            <span class="font-bold ${a.health_index < 93 ? 'text-amber-600' : 'text-emerald-700'}">${a.health_index}%</span>
          </td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${statusBadges[a.operational_status] || statusBadges.OPERATIONAL}">${a.operational_status}</span>
          </td>
          <td class="py-3 px-4 text-xs font-sans text-slate-700 whitespace-nowrap">${a.pilot_in_command}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap" onclick="event.stopPropagation()">
            <div class="flex items-center justify-end gap-1.5">
              <button class="btn-flt-twin px-2 py-1 text-xs font-bold bg-primary text-white hover:bg-slate-800 rounded flex items-center gap-1 shadow-xs cursor-pointer" data-id="${a.id}">
                <span class="material-symbols-outlined text-[14px]">model_training</span> Twin
              </button>
              <button class="btn-flt-edit p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Edit Metadata" data-id="${a.id}">
                <span class="material-symbols-outlined text-[16px]">edit</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("tr[data-asset-id]").forEach(tr => {
      tr.addEventListener("click", () => {
        const aid = tr.getAttribute("data-asset-id");
        const asset = this.fleetAssetsList.find(x => x.id === aid);
        if (asset) {
          window.aeroDrawer?.openAssetDetailsDrawer(asset, (a) => {
            window.aeroDrawer?.openEditAssetModal(a, async (id, data) => {
              await window.aeroAPI.updateFleetAsset(id, data);
              this.loadFleet();
            });
          });
        }
      });
    });

    tbody.querySelectorAll(".btn-flt-twin").forEach(btn => {
      btn.addEventListener("click", () => {
        this.navigateTo("digital-twin");
      });
    });

    tbody.querySelectorAll(".btn-flt-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const aid = btn.getAttribute("data-id");
        const asset = this.fleetAssetsList.find(x => x.id === aid);
        if (asset) {
          window.aeroDrawer?.openEditAssetModal(asset, async (id, data) => {
            await window.aeroAPI.updateFleetAsset(id, data);
            this.loadFleet();
            this.showToast(`Updated metadata for ${id}`, "success");
          });
        }
      });
    });
  }

  renderFleetComparison(comparison) {
    const selector = document.getElementById("fleet-compare-selector");
    if (selector) {
      const allAssets = ["UAV-01", "UAV-02", "UAV-03", "UAV-04", "UAV-05", "UAV-06", "UAV-07", "UAV-08"];
      if (!this.selectedCompareAssets) {
        this.selectedCompareAssets = ["UAV-01", "UAV-03", "UAV-07"];
      }
      selector.innerHTML = allAssets.map(id => {
        const isSelected = this.selectedCompareAssets.includes(id);
        return `<button class="btn-flt-comp-pill px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${isSelected ? 'bg-primary text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}" data-asset-id="${id}">${id}</button>`;
      }).join("");

      selector.querySelectorAll(".btn-flt-comp-pill").forEach(pill => {
        pill.addEventListener("click", async () => {
          const aid = pill.getAttribute("data-asset-id");
          if (this.selectedCompareAssets.includes(aid)) {
            if (this.selectedCompareAssets.length > 1) {
              this.selectedCompareAssets = this.selectedCompareAssets.filter(x => x !== aid);
            } else {
              this.showToast("At least one airframe must be selected for comparison", "warning");
              return;
            }
          } else {
            if (this.selectedCompareAssets.length >= 4) {
              this.showToast("Max 4 airframes can be compared concurrently", "warning");
              return;
            }
            this.selectedCompareAssets.push(aid);
          }
          const comp = await window.aeroAPI.getFleetComparison(this.selectedCompareAssets.join(","));
          this.renderFleetComparison(comp);
          this.showToast(`Updated comparison matrix for ${this.selectedCompareAssets.join(", ")}`, "info");
        });
      });
    }

    const container = document.getElementById("fleet-comparison-cards");
    if (!container || !comparison || !comparison.comparison_metrics) return;

    container.innerHTML = comparison.comparison_metrics.map(m => `
      <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 font-mono text-xs">
        <div class="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <strong class="text-sm font-bold text-slate-900 block">${m.asset_id}</strong>
            <span class="text-[10px] text-slate-500 font-sans">${m.callsign} • ${m.engine}</span>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.health_score < 93 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${m.health_score}%</span>
        </div>
        <div class="space-y-1.5 text-slate-600">
          <div class="flex justify-between"><span>Thermal Headroom:</span><strong class="text-slate-800">+${m.thermal_headroom_c}°C</strong></div>
          <div class="flex justify-between"><span>Vibration RMS:</span><strong class="text-slate-800">${m.vibration_rms} g</strong></div>
          <div class="flex justify-between"><span>Fuel Burn Rate:</span><strong class="text-slate-800">${m.fuel_burn_lph} L/h</strong></div>
          <div class="flex justify-between"><span>Prognostic RUL:</span><strong class="text-sky-700">${m.rul_estimated_hours} hrs</strong></div>
        </div>
      </div>
    `).join("");
  }

  renderFleetAlerts() {
    const tbody = document.getElementById("fleet-alerts-tbody");
    if (!tbody || !this.fleetAlertsList) return;

    tbody.innerHTML = this.fleetAlertsList.map(alt => `
      <tr class="hover:bg-slate-50/70 font-mono text-xs">
        <td class="py-3 px-4 font-bold text-sky-700">${alt.id}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${alt.asset_id}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${alt.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : (alt.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')}">${alt.severity}</span>
        </td>
        <td class="py-3 px-4 font-sans text-slate-800">
          <strong>${alt.title}:</strong> ${alt.message}
        </td>
        <td class="py-3 px-4 text-slate-500 whitespace-nowrap">${alt.timestamp}</td>
        <td class="py-3 px-4 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${alt.acknowledged ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${alt.acknowledged ? 'ACKED' : 'UNACKED'}</span>
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <button class="btn-flt-ack px-2.5 py-1 text-xs font-bold rounded ${alt.acknowledged ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-primary text-white hover:bg-slate-800 cursor-pointer shadow-xs'}" ${alt.acknowledged ? 'disabled' : ''} data-id="${alt.id}">
            ${alt.acknowledged ? 'Signed' : 'Acknowledge'}
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".btn-flt-ack:not([disabled])").forEach(btn => {
      btn.addEventListener("click", async () => {
        const aid = btn.getAttribute("data-id");
        await window.aeroAPI.acknowledgeFleetAlert(aid);
        this.loadFleet();
        this.showToast(`Fleet alert ${aid} acknowledged and certified`, "success");
      });
    });
  }

  /* =============================================================
   * MODULE 6: MACHINE LEARNING LIFECYCLE & SENSOR CONTRACT
   * ============================================================= */
  initMLSystemModule() {
    const btnDemo = document.getElementById("btn-mode-demo");
    const btnLive = document.getElementById("btn-mode-live");

    const updateSourceUI = (mode, isStale = false, freshness = "LIVE / RECENT") => {
      const sourceText = document.getElementById("header-source-text");
      const freshnessText = document.getElementById("telemetry-status-text");
      const telemetryBadge = document.getElementById("telemetry-status-badge");
      const dot = document.getElementById("telemetry-dot");

      if (mode === "LIVE_SENSOR") {
        if (btnLive) {
          btnLive.className = "px-2.5 py-1 bg-primary text-white font-label-caps text-[11px] font-bold rounded shadow-xs flex items-center gap-1.5 transition-all cursor-pointer";
          btnLive.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>LIVE SENSOR';
        }
        if (btnDemo) {
          btnDemo.className = "px-2.5 py-1 text-slate-600 hover:text-slate-900 font-label-caps text-[11px] font-medium transition-all cursor-pointer";
          btnDemo.innerHTML = 'DEMO DATA';
        }
        if (sourceText) sourceText.textContent = "SOURCE: LIVE SENSOR";

        if (isStale || (freshness && freshness.includes("WAITING"))) {
          if (freshnessText) freshnessText.textContent = "WAITING FOR REAL SENSOR DATA";
          if (telemetryBadge) telemetryBadge.className = "telemetry-status-badge flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-300 font-label-caps text-[11px] font-bold shadow-xs";
          if (dot) dot.className = "w-2 h-2 rounded-full bg-amber-500 animate-ping";
        } else {
          if (freshnessText) freshnessText.textContent = freshness || "LIVE / RECENT";
          if (telemetryBadge) telemetryBadge.className = "telemetry-status-badge flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 font-label-caps text-[11px] font-bold shadow-xs";
          if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
        }
      } else {
        if (btnDemo) {
          btnDemo.className = "px-2.5 py-1 bg-primary text-white font-label-caps text-[11px] font-bold rounded shadow-xs flex items-center gap-1.5 transition-all cursor-pointer";
          btnDemo.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>DEMO DATA';
        }
        if (btnLive) {
          btnLive.className = "px-2.5 py-1 text-slate-600 hover:text-slate-900 font-label-caps text-[11px] font-medium transition-all cursor-pointer";
          btnLive.innerHTML = 'LIVE SENSOR';
        }
        if (sourceText) sourceText.textContent = "SOURCE: DEMO DATA";
        if (freshnessText) freshnessText.textContent = "LIVE / RECENT";
        if (telemetryBadge) telemetryBadge.className = "telemetry-status-badge flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 font-label-caps text-[11px] font-bold shadow-xs";
        if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
      }
    };

    btnDemo?.addEventListener("click", async () => {
      if (confirm("Switch telemetry pipeline to DEMO DATA mode? This activates synthetic high-fidelity physics generator.")) {
        try {
          await window.aeroAPI.setDataSource("DEMO");
          updateSourceUI("DEMO");
          this.showToast("Operational mode switched to DEMO DATA", "info");
        } catch (e) {
          this.showToast("Failed to switch source mode: " + e.message, "error");
        }
      }
    });

    btnLive?.addEventListener("click", async () => {
      if (confirm("Switch to LIVE SENSOR mode? The system will wait for authenticated hardware telemetry (ESP32/IoT gateway) and display 'WAITING FOR REAL SENSOR DATA' until packets arrive.")) {
        try {
          await window.aeroAPI.setDataSource("LIVE_SENSOR");
          updateSourceUI("LIVE_SENSOR", true, "WAITING FOR REAL SENSOR DATA");
          this.showToast("Operational mode switched to LIVE SENSOR — Waiting for hardware packets...", "warning");
        } catch (e) {
          this.showToast("Failed to switch source mode: " + e.message, "error");
        }
      }
    });

    // Retrain ML Models Button
    const btnRetrain = document.getElementById("btn-retrain-models");
    const jobBanner = document.getElementById("ml-job-banner");
    const jobText = document.getElementById("ml-job-text");
    const jobIdSpan = document.getElementById("ml-job-id");

    btnRetrain?.addEventListener("click", async () => {
      if (!confirm("Start Machine Learning retraining run on latest sensor datasets? This fits Isolation Forest and Gradient Boosting models and evaluates on held-out test data.")) return;

      try {
        btnRetrain.disabled = true;
        btnRetrain.classList.add("opacity-60");
        if (jobBanner) {
          jobBanner.classList.remove("hidden");
          jobBanner.className = "p-3 rounded-lg border border-sky-300 bg-sky-50 text-sky-800 text-xs font-mono flex items-center justify-between";
          if (jobText) jobText.textContent = "Training models on held-out test partitions...";
        }

        const res = await window.aeroAPI.triggerModelTraining();
        const jobId = res.job_id;
        if (jobIdSpan) jobIdSpan.textContent = jobId;
        this.showToast(`Training Job ${jobId} initiated`, "info");

        // Poll job status
        const pollTimer = setInterval(async () => {
          try {
            const jobStatus = await window.aeroAPI.getTrainingJobStatus(jobId);
            if (jobStatus.status === "COMPLETED") {
              clearInterval(pollTimer);
              btnRetrain.disabled = false;
              btnRetrain.classList.remove("opacity-60");
              if (jobBanner) {
                jobBanner.className = "p-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-mono flex items-center justify-between";
                if (jobText) jobText.textContent = `Training completed successfully. Model version: ${jobStatus.model_version}`;
              }
              this.loadMLMetrics();
              this.showToast(`Model retraining finished: ${jobStatus.model_version}`, "success");
            } else if (jobStatus.status === "FAILED") {
              clearInterval(pollTimer);
              btnRetrain.disabled = false;
              btnRetrain.classList.remove("opacity-60");
              if (jobBanner) {
                jobBanner.className = "p-3 rounded-lg border border-error bg-red-50 text-error text-xs font-mono flex items-center justify-between";
                if (jobText) jobText.textContent = `Training failed: ${jobStatus.error_details || "Unknown error"}`;
              }
              this.showToast(`Training failed: ${jobStatus.error_details}`, "error");
            }
          } catch (err) {
            console.warn("Polling training job error:", err);
          }
        }, 2000);
      } catch (err) {
        btnRetrain.disabled = false;
        btnRetrain.classList.remove("opacity-60");
        this.showToast("Failed to initiate training: " + err.message, "error");
      }
    });

    // Generate Demo Benchmark Data Button
    const btnGenDemo = document.getElementById("btn-generate-demo-data");
    btnGenDemo?.addEventListener("click", async () => {
      try {
        btnGenDemo.disabled = true;
        btnGenDemo.classList.add("opacity-60");
        this.showToast("Generating 60m multi-regime demo flight benchmark...", "info");
        const res = await window.aeroAPI.generateDemoData({ duration_minutes: 60.0, seed: 42 });
        this.showToast(`Generated ${res.metadata.total_records} benchmark observations`, "success");
        this.loadMLMetrics();
        btnGenDemo.disabled = false;
        btnGenDemo.classList.remove("opacity-60");
      } catch (e) {
        btnGenDemo.disabled = false;
        btnGenDemo.classList.remove("opacity-60");
        this.showToast("Failed to generate demo data: " + e.message, "error");
      }
    });

    // Initial load of ML metrics and system source
    this.loadMLMetrics();
  }

  async loadMLMetrics() {
    try {
      const [statusRes, metricsRes, sourceRes] = await Promise.all([
        window.aeroAPI.getMLStatus().catch(() => null),
        window.aeroAPI.getMLMetrics().catch(() => null),
        window.aeroAPI.getDataSource().catch(() => null)
      ]);

      if (statusRes) {
        const badge = document.getElementById("ml-model-badge");
        if (badge) {
          if (statusRes.is_loaded) {
            badge.className = "px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300";
            badge.textContent = "TRAINED";
          } else {
            badge.className = "px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300";
            badge.textContent = "MODEL NOT TRAINED";
          }
        }
        const vSpan = document.getElementById("ml-metric-version");
        if (vSpan && statusRes.model_version) vSpan.textContent = statusRes.model_version;
      }

      if (metricsRes && metricsRes.supervised_classification) {
        const sc = metricsRes.supervised_classification;
        const anom = metricsRes.anomaly_detection;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setVal("ml-metric-accuracy", (sc.accuracy * 100).toFixed(1) + "%");
        setVal("ml-metric-macro-f1", sc.macro_f1.toFixed(4));
        setVal("ml-metric-roc-auc", anom.roc_auc.toFixed(4));
        setVal("ml-metric-anom-f1", anom.f1_score.toFixed(4));
        setVal("ml-metric-dataset-size", `${metricsRes.test_sample_count * 4} rows`);
      }
    } catch (e) {
      console.warn("Failed to load ML metrics:", e);
    }
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
