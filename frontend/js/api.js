/**
 * AeroTwin-X Centralized API Client Service
 * Handles all REST endpoints, configurable gateway URLs, timeouts, and fallback resilience.
 */

class AeroTwinAPI {
  constructor() {
    this.initGateway();
  }

  initGateway() {
    // 1. URL Query parameter override (?api=http://...)
    const urlParams = new URLSearchParams(window.location.search);
    const queryApi = urlParams.get("api");

    // 2. LocalStorage override
    const storedApi = localStorage.getItem("aerotwin_gateway");

    // 3. Environment/Host detection
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    
    if (queryApi) {
      this.baseUrl = this.normalizeUrl(queryApi);
      localStorage.setItem("aerotwin_gateway", this.baseUrl);
    } else if (storedApi) {
      this.baseUrl = this.normalizeUrl(storedApi);
    } else if (isLocalhost) {
      this.baseUrl = "http://127.0.0.1:8000/api/v1";
    } else {
      // Cloud deployment (Vercel / Production) - use relative path or configured backend
      this.baseUrl = "/api/v1";
    }

    console.log(`[AeroTwin-X API] Active Base Gateway URL: ${this.baseUrl}`);
  }

  normalizeUrl(url) {
    let clean = url.trim().replace(/\/$/, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = (window.location.protocol === "https:" ? "https://" : "http://") + clean;
    }
    if (!clean.endsWith("/api/v1")) {
      clean = clean + "/api/v1";
    }
    return clean;
  }

  setGateway(newUrl) {
    if (newUrl && newUrl.trim()) {
      this.baseUrl = this.normalizeUrl(newUrl);
      localStorage.setItem("aerotwin_gateway", this.baseUrl);
    } else {
      localStorage.removeItem("aerotwin_gateway");
      this.initGateway();
    }
  }

  getGateway() {
    return this.baseUrl;
  }

  async request(endpoint, options = {}, timeoutMs = 4500) {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const config = {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[AeroTwin-X API] Request to ${url} failed:`, err.message);
      throw err;
    }
  }

  /* -------------------------------------------------------------
   * ENDPOINT METHODS
   * ------------------------------------------------------------- */

  async getHealth() {
    return this.request("/health");
  }

  async getServiceDiagnostics() {
    return this.request("/diagnostics/services");
  }

  async getTelemetry() {
    return this.request("/telemetry");
  }

  async getTelemetryHistory(limit = 60) {
    return this.request(`/telemetry/history?limit=${limit}`);
  }

  async getEngineState(engineId = "AE-03") {
    return this.request(`/engine/${engineId}/state`);
  }

  async getEngineTelemetry(engineId = "AE-03") {
    return this.request(`/engine/${engineId}/telemetry`);
  }

  async getEngineHealth(engineId = "AE-03") {
    return this.request(`/engine/${engineId}/health`);
  }

  async getEnginePredictions(engineId = "AE-03") {
    return this.request(`/engine/${engineId}/predictions`);
  }

  async getAllPredictions() {
    return this.request("/predictions");
  }

  async listAlerts() {
    return this.request("/alerts");
  }

  async acknowledgeAlert(alertId) {
    return this.request(`/alerts/${alertId}/ack`, { method: "POST" });
  }

  async listMissions() {
    return this.request("/missions");
  }

  async createMission(missionData) {
    return this.request("/missions", {
      method: "POST",
      body: JSON.stringify(missionData)
    });
  }

  async getMissionReplay(missionId = "MSN-ISR-0814", frameIndex = null) {
    const q = frameIndex !== null ? `?frame_index=${frameIndex}` : "";
    return this.request(`/missions/${missionId}/replay${q}`);
  }

  async listSimulationScenarios() {
    return this.request("/simulation/scenarios");
  }

  async startSimulation() {
    return this.request("/simulation/start", { method: "POST" });
  }

  async stopSimulation() {
    return this.request("/simulation/stop", { method: "POST" });
  }

  async pauseSimulation() {
    return this.request("/simulation/pause", { method: "POST" });
  }

  async resumeSimulation() {
    return this.request("/simulation/resume", { method: "POST" });
  }

  async setMissionPhase(phase) {
    return this.request("/simulation/phase", {
      method: "POST",
      body: JSON.stringify({ phase })
    });
  }

  async injectFault(faultType, severity = 1.2) {
    return this.request("/faults/inject", {
      method: "POST",
      body: JSON.stringify({ fault_type: faultType, severity })
    });
  }

  async resetSimulation() {
    return this.request("/simulation/reset", { method: "POST" });
  }

  async listMaintenanceTasks() {
    return this.request("/maintenance");
  }

  async createMaintenanceTask(taskData) {
    return this.request("/maintenance", {
      method: "POST",
      body: JSON.stringify(taskData)
    });
  }

  async completeMaintenanceTask(taskId) {
    return this.request(`/maintenance/${taskId}/complete`, { method: "POST" });
  }

  async listModels() {
    return this.request("/models");
  }
}

// Global API Singleton instance
window.aeroAPI = new AeroTwinAPI();
