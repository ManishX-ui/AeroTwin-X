/**
 * AeroTwin-X Interactive Three.js 3D Aero-Piston Engine CAD Explorer
 * High-precision assembly, OrbitControls, raycasting selection, thermal heatmap, and inspector drawer.
 */

class AeroEngine3D {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.engineGroup = null;
    this.components = new Map();
    this.selectedComponent = null;
    this.hoveredComponent = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.viewMode = "METALLIC"; // METALLIC, THERMAL, WIREFRAME
    this.isInitialized = false;

    // Component Metadata & Health Mapping
    this.componentRegistry = {
      "cyl_1": {
        name: "Cylinder #1 Assembly (Port Front)",
        subsystem: "Combustion & Cylinder",
        channel: "cht_cylinders",
        channelIndex: 0,
        unit: "°C",
        nominalRange: "135 - 150°C",
        desc: "Forged aluminum cylinder head with dual spark plugs and nikasil-coated bore."
      },
      "cyl_2": {
        name: "Cylinder #2 Assembly (Port Rear)",
        subsystem: "Combustion & Cylinder",
        channel: "cht_cylinders",
        channelIndex: 1,
        unit: "°C",
        nominalRange: "135 - 150°C",
        desc: "Port rear combustion chamber monitored via FADEC CAN node A thermocouple."
      },
      "cyl_3": {
        name: "Cylinder #3 Assembly (Starboard Front)",
        subsystem: "Combustion & Cylinder",
        channel: "cht_cylinders",
        channelIndex: 2,
        unit: "°C",
        nominalRange: "135 - 150°C",
        desc: "Starboard front cylinder head; primary subject of active thermal anomaly detection."
      },
      "cyl_4": {
        name: "Cylinder #4 Assembly (Starboard Rear)",
        subsystem: "Combustion & Cylinder",
        channel: "cht_cylinders",
        channelIndex: 3,
        unit: "°C",
        nominalRange: "135 - 150°C",
        desc: "Starboard rear combustion chamber with integrated exhaust valve temperature telemetry."
      },
      "crankcase": {
        name: "Engine Crankcase & Oil Sump",
        subsystem: "Lubrication System",
        channel: "oil_pressure",
        unit: "bar",
        nominalRange: "3.5 - 4.2 bar",
        desc: "Split-type aluminum alloy crankcase with dry sump lubrication return lines."
      },
      "prgb": {
        name: "Propeller Reduction Gearbox (PRGB)",
        subsystem: "Mechanical & PRGB Gearbox",
        channel: "vibration",
        unit: "g",
        nominalRange: "0.20 - 0.60 g",
        desc: "Integrated torsional shock overload clutch with 2.43:1 gear reduction ratio."
      },
      "turbo": {
        name: "Turbocharger & Wastegate",
        subsystem: "Turbocharger & Boost",
        channel: "manifold_pressure",
        unit: "inHg",
        nominalRange: "26.0 - 39.0 inHg",
        desc: "Exhaust gas turbocharger with electronic wastegate actuator for altitude compensation."
      },
      "fuel_rail": {
        name: "Dual Fuel Injection Rail",
        subsystem: "Fuel & Injection",
        channel: "fuel_flow",
        unit: "L/h",
        nominalRange: "18.0 - 32.0 L/h",
        desc: "High-pressure multi-point sequential electronic fuel injection rail."
      },
      "fadec": {
        name: "Dual FADEC Engine Control Unit",
        subsystem: "Avionics & FADEC",
        channel: "battery_voltage",
        unit: "V",
        nominalRange: "27.5 - 28.5 V",
        desc: "Redundant dual-channel Full Authority Digital Engine Control compute unit."
      }
    };
  }

  init(containerSelector = "#view-digital-twin canvas, #threejs-engine-container") {
    if (this.isInitialized || typeof THREE === "undefined") return;

    const canvases = document.querySelectorAll(containerSelector);
    let targetCanvas = null;
    canvases.forEach(c => {
      if (c && c.offsetParent !== null) targetCanvas = c;
    });
    if (!targetCanvas && canvases.length > 0) targetCanvas = canvases[0];
    if (!targetCanvas) return;

    this.canvas = targetCanvas;
    const parent = targetCanvas.parentElement;
    const width = parent.clientWidth || 640;
    const height = parent.clientHeight || 420;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1320);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.defaultCamPos = new THREE.Vector3(0, 16, 28);
    this.camera.position.copy(this.defaultCamPos);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: targetCanvas, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== "undefined") {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxDistance = 60;
      this.controls.minDistance = 8;
      this.controls.target.set(0, 2, 0);
    }

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight1.position.set(15, 25, 20);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.6);
    dirLight2.position.set(-15, -10, -15);
    this.scene.add(dirLight2);

    // Ground Grid
    const grid = new THREE.GridHelper(30, 30, 0x1e293b, 0x0f172a);
    grid.position.y = -4;
    this.scene.add(grid);

    // 6. Build CAD Engine Model
    this.buildAssembly();

    // 7. Event Listeners (Hover, Click, Resize)
    this.initInteractionEvents();

    // 8. Animation Loop
    this.isInitialized = true;
    this.animate();
    console.log("[AeroTwin-X 3D] Engine CAD Explorer successfully initialized with Raycaster and OrbitControls.");
  }

  buildAssembly() {
    this.engineGroup = new THREE.Group();
    this.components.clear();

    // Material Library
    this.materials = {
      crankcase: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.8 }),
      cylinderNominal: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.75 }),
      cylinderWarning: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.75 }),
      cylinderCritical: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.75, emissive: 0x7f1d1d, emissiveIntensity: 0.4 }),
      prgb: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.2, metalness: 0.9 }),
      turbo: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.85 }),
      fuelRail: new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, metalness: 0.7 }),
      fadec: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5 }),
      exhaust: new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.6, metalness: 0.7 })
    };

    // --- CRANKCASE ---
    const crankGeo = new THREE.BoxGeometry(9.5, 4.5, 8.5);
    const crankMesh = new THREE.Mesh(crankGeo, this.materials.crankcase);
    crankMesh.position.y = 0;
    crankMesh.userData = { id: "crankcase" };
    this.engineGroup.add(crankMesh);
    this.components.set("crankcase", crankMesh);

    // --- 4 CYLINDERS (Rotax Boxer Configuration) ---
    const cylPositions = [
      { id: "cyl_1", pos: [-3.4, 2.5, -2.4] },
      { id: "cyl_2", pos: [-3.4, 2.5, 2.4] },
      { id: "cyl_3", pos: [3.4, 2.5, -2.4] },
      { id: "cyl_4", pos: [3.4, 2.5, 2.4] }
    ];

    cylPositions.forEach(c => {
      const group = new THREE.Group();
      // Cylinder Barrel
      const barrelGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.8, 20);
      const barrel = new THREE.Mesh(barrelGeo, this.materials.cylinderNominal.clone());
      group.add(barrel);

      // Cooling Fins
      for (let i = -1.2; i <= 1.2; i += 0.6) {
        const finGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.1, 20);
        const fin = new THREE.Mesh(finGeo, barrel.material);
        fin.position.y = i;
        group.add(fin);
      }

      // Cylinder Head Cap
      const headGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.8, 20);
      const head = new THREE.Mesh(headGeo, barrel.material);
      head.position.y = 2.1;
      group.add(head);

      group.position.set(c.pos[0], c.pos[1], c.pos[2]);
      group.userData = { id: c.id };
      this.engineGroup.add(group);
      this.components.set(c.id, group);
    });

    // --- PRGB GEARBOX ---
    const prgbGeo = new THREE.CylinderGeometry(2.0, 2.4, 3.2, 24);
    const prgbMesh = new THREE.Mesh(prgbGeo, this.materials.prgb);
    prgbMesh.rotation.x = Math.PI / 2;
    prgbMesh.position.set(0, 0.2, 5.8);
    prgbMesh.userData = { id: "prgb" };
    this.engineGroup.add(prgbMesh);
    this.components.set("prgb", prgbMesh);

    // Propeller Flange
    const flangeGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.8, 16);
    const flange = new THREE.Mesh(flangeGeo, this.materials.prgb);
    flange.rotation.x = Math.PI / 2;
    flange.position.set(0, 0.2, 7.6);
    this.engineGroup.add(flange);

    // --- TURBOCHARGER HOUSING ---
    const turboGeo = new THREE.TorusGeometry(1.6, 0.65, 16, 28);
    const turboMesh = new THREE.Mesh(turboGeo, this.materials.turbo);
    turboMesh.rotation.y = Math.PI / 2;
    turboMesh.position.set(0, -2.4, -3.8);
    turboMesh.userData = { id: "turbo" };
    this.engineGroup.add(turboMesh);
    this.components.set("turbo", turboMesh);

    // --- DUAL FUEL RAIL ---
    const railGeo1 = new THREE.CylinderGeometry(0.2, 0.2, 7.5, 12);
    const fuelRailMesh = new THREE.Mesh(railGeo1, this.materials.fuelRail);
    fuelRailMesh.rotation.x = Math.PI / 2;
    fuelRailMesh.position.set(-3.4, 4.2, 0);
    fuelRailMesh.userData = { id: "fuel_rail" };
    this.engineGroup.add(fuelRailMesh);

    const railGeo2 = new THREE.CylinderGeometry(0.2, 0.2, 7.5, 12);
    const rail2 = new THREE.Mesh(railGeo2, this.materials.fuelRail);
    rail2.rotation.x = Math.PI / 2;
    rail2.position.set(3.4, 4.2, 0);
    this.engineGroup.add(rail2);
    this.components.set("fuel_rail", fuelRailMesh);

    // --- DUAL FADEC BOX ---
    const fadecGeo = new THREE.BoxGeometry(3.5, 1.4, 2.5);
    const fadecMesh = new THREE.Mesh(fadecGeo, this.materials.fadec);
    fadecMesh.position.set(0, 3.2, -1.0);
    fadecMesh.userData = { id: "fadec" };
    this.engineGroup.add(fadecMesh);
    this.components.set("fadec", fadecMesh);

    this.scene.add(this.engineGroup);
  }

  initInteractionEvents() {
    const canvas = this.canvas;
    if (!canvas) return;

    // Mouse Move (Raycasting Hover)
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.checkHover();
    });

    // Mouse Click (Raycasting Selection)
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.checkClick();
    });

    // Tooltip Element
    let tooltip = document.getElementById("threejs-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "threejs-tooltip";
      tooltip.className = "fixed pointer-events-none z-50 bg-slate-900/90 text-white font-mono text-xs px-2.5 py-1.5 rounded shadow-lg border border-cyan-500/40 hidden backdrop-blur-sm";
      document.body.appendChild(tooltip);
    }
    this.tooltip = tooltip;
  }

  checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.engineGroup.children, true);

    if (intersects.length > 0) {
      let rootObj = intersects[0].object;
      while (rootObj.parent && rootObj.parent !== this.engineGroup) {
        rootObj = rootObj.parent;
      }
      const compId = rootObj.userData ? rootObj.userData.id : null;
      if (compId && this.componentRegistry[compId]) {
        this.canvas.style.cursor = "pointer";
        this.hoveredComponent = compId;
        const info = this.componentRegistry[compId];
        this.tooltip.innerHTML = `
          <div class="font-bold text-cyan-300">${info.name}</div>
          <div class="text-[10px] text-slate-300">${info.subsystem}</div>
        `;
        this.tooltip.style.left = (event.clientX + 14) + "px";
        this.tooltip.style.top = (event.clientY + 14) + "px";
        this.tooltip.classList.remove("hidden");
        return;
      }
    }

    this.canvas.style.cursor = "default";
    this.hoveredComponent = null;
    this.tooltip.classList.add("hidden");
  }

  checkClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.engineGroup.children, true);

    if (intersects.length > 0) {
      let rootObj = intersects[0].object;
      while (rootObj.parent && rootObj.parent !== this.engineGroup) {
        rootObj = rootObj.parent;
      }
      const compId = rootObj.userData ? rootObj.userData.id : null;
      if (compId && this.componentRegistry[compId]) {
        this.selectComponent(compId);
      }
    }
  }

  selectComponent(compId) {
    this.selectedComponent = compId;
    const meta = this.componentRegistry[compId];
    console.log(`[AeroTwin-X 3D] Selected Component: ${meta.name}`);

    // Highlight selected component pulse
    this.highlightComponent(compId);

    // Update right inspector panel in DOM if present
    this.updateInspectorDOM(compId, meta);

    // Open Unified Detail Drawer
    if (window.aeroDrawer) {
      window.aeroDrawer.openComponentDrawer(compId, meta);
    }
  }

  updateInspectorDOM(compId, meta) {
    const inspectorTitle = document.querySelector("#view-digital-twin .lg\\:col-span-4 h2");
    if (inspectorTitle) {
      inspectorTitle.textContent = meta.name.toUpperCase();
    }
  }

  highlightComponent(compId) {
    this.components.forEach((obj, id) => {
      const isTarget = id === compId;
      obj.traverse(child => {
        if (child.isMesh) {
          if (isTarget) {
            child.material.emissive = new THREE.Color(0x0284c7);
            child.material.emissiveIntensity = 0.5;
          } else {
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0.0;
          }
        }
      });
    });
  }

  zoomIn() {
    if (!this.camera || !this.controls) return;
    this.camera.position.multiplyScalar(0.85);
    this.controls.update();
  }

  zoomOut() {
    if (!this.camera || !this.controls) return;
    this.camera.position.multiplyScalar(1.15);
    this.controls.update();
  }

  returnToFullEngine() {
    this.selectedComponent = null;
    this.components.forEach(obj => {
      obj.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.emissive = new THREE.Color(0x000000);
          child.material.emissiveIntensity = 0.0;
        }
      });
    });
    this.resetCamera();
    window.aeroDrawer?.closeDrawer();
  }

  toggleSensorOverlays() {
    this.sensorOverlaysActive = !this.sensorOverlaysActive;
    window.aeroApp?.showToast(`3D Sensor Overlays: ${this.sensorOverlaysActive ? 'ENABLED' : 'DISABLED'}`, 'info');
  }

  toggleLabels() {
    this.labelsActive = !this.labelsActive;
    window.aeroApp?.showToast(`Component Labels: ${this.labelsActive ? 'VISIBLE' : 'HIDDEN'}`, 'info');
  }

  resetCamera() {
    if (!this.camera || !this.controls) return;
    this.camera.position.copy(this.defaultCamPos);
    this.controls.target.set(0, 2, 0);
    this.controls.update();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.components.forEach((obj, id) => {
      obj.traverse(child => {
        if (child.isMesh) {
          if (mode === "WIREFRAME") {
            child.material.wireframe = true;
          } else {
            child.material.wireframe = false;
          }
        }
      });
    });
    window.aeroApp?.showToast(`CAD Viewport Mode: ${mode}`, 'info');
  }

  updateThermalState(telemetry, prediction) {
    if (!this.components || this.viewMode === "WIREFRAME") return;
    const chts = (telemetry && telemetry.cht_cylinders) ? telemetry.cht_cylinders : [144, 146, 148, 145];
    const isOverheat = prediction && prediction.fault && prediction.fault.fault === "OVERHEATING";

    // Update Cylinder Thermal Colors
    chts.forEach((temp, i) => {
      const cyl = this.components.get(`cyl_${i + 1}`);
      if (cyl) {
        let hexColor = 0x0284c7; // Nominal cyan/blue
        if (temp > 170 || (isOverheat && i === 2)) {
          hexColor = 0xef4444; // Critical Red
        } else if (temp > 155) {
          hexColor = 0xf59e0b; // Amber Warning
        }

        cyl.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.color.setHex(hexColor);
          }
        });
      }
    });

    // Update PRGB Gearbox if high vibration
    const vib = telemetry ? telemetry.vibration : 0.42;
    const prgb = this.components.get("prgb");
    if (prgb) {
      prgb.material.color.setHex(vib > 1.2 ? 0xef4444 : 0x475569);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

window.aeroEngine3D = new AeroEngine3D();
