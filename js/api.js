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

  /* Maintenance Module API */
  async getMaintenanceSummary() {
    return this.request("/maintenance/summary");
  }

  async listMaintenanceTasks(filters = {}) {
    let q = [];
    if (filters.status) q.push(`status=${encodeURIComponent(filters.status)}`);
    if (filters.subsystem) q.push(`subsystem=${encodeURIComponent(filters.subsystem)}`);
    if (filters.priority) q.push(`priority=${encodeURIComponent(filters.priority)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return this.request(`/maintenance${qs}`);
  }

  async createMaintenanceTask(taskData) {
    return this.request("/maintenance", {
      method: "POST",
      body: JSON.stringify(taskData)
    });
  }

  async updateMaintenanceTask(taskId, data) {
    return this.request(`/maintenance/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async assignMaintenanceTech(taskId, assignedTech) {
    return this.request(`/maintenance/${taskId}/assign`, {
      method: "POST",
      body: JSON.stringify({ assigned_tech: assignedTech })
    });
  }

  async updateMaintenanceStatus(taskId, status) {
    return this.request(`/maintenance/${taskId}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
  }

  async completeMaintenanceTask(taskId) {
    return this.request(`/maintenance/${taskId}/complete`, { method: "POST" });
  }

  async deleteMaintenanceTask(taskId) {
    return this.request(`/maintenance/${taskId}`, { method: "DELETE" });
  }

  getMaintenanceExportUrl() {
    return `${this.baseUrl}/maintenance/export`;
  }

  /* Reports Module API */
  async listReports(reportType = null, search = null) {
    let q = [];
    if (reportType) q.push(`report_type=${encodeURIComponent(reportType)}`);
    if (search) q.push(`search=${encodeURIComponent(search)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return this.request(`/reports${qs}`);
  }

  async generateReport(data) {
    return this.request("/reports/generate", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async getReport(reportId) {
    return this.request(`/reports/${reportId}`);
  }

  getReportDownloadUrl(reportId) {
    return `${this.baseUrl}/reports/${reportId}/download`;
  }

  async deleteReport(reportId) {
    return this.request(`/reports/${reportId}`, { method: "DELETE" });
  }

  async getReportsAnalytics() {
    return this.request("/reports/analytics/summary");
  }

  /* Edge AI Module API */
  async getEdgeAISummary() {
    return this.request("/edge-ai/summary");
  }

  async listEdgeDevices(status = null) {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/edge-ai/devices${q}`);
  }

  async getEdgeDevice(deviceId) {
    return this.request(`/edge-ai/devices/${deviceId}`);
  }

  async updateEdgeDeviceConfig(deviceId, config) {
    return this.request(`/edge-ai/devices/${deviceId}`, {
      method: "PUT",
      body: JSON.stringify(config)
    });
  }

  async refreshEdgeDevice(deviceId) {
    return this.request(`/edge-ai/devices/${deviceId}/refresh`, { method: "POST" });
  }

  async getEdgeDeviceLogs(deviceId) {
    return this.request(`/edge-ai/devices/${deviceId}/logs`);
  }

  async listAIModels() {
    return this.request("/edge-ai/models");
  }

  async deployAIModel(data) {
    return this.request("/edge-ai/deploy", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async getEdgePipeline() {
    return this.request("/edge-ai/pipeline");
  }

  /* Data Quality Module API */
  async getDataQualitySummary() {
    return this.request("/data-quality/summary");
  }

  async listSensorQualityMatrix(status = null, subsystem = null) {
    let q = [];
    if (status) q.push(`status=${encodeURIComponent(status)}`);
    if (subsystem) q.push(`subsystem=${encodeURIComponent(subsystem)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return this.request(`/data-quality/sensors${qs}`);
  }

  async getRawVsValidatedComparison(sensorId = "CHT-03") {
    return this.request(`/data-quality/comparison?sensor_id=${encodeURIComponent(sensorId)}`);
  }

  async listQualityIncidents(status = null) {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/data-quality/incidents${q}`);
  }

  async updateQualityIncident(incidentId, data) {
    return this.request(`/data-quality/incidents/${incidentId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async resolveQualityIncident(incidentId, notes, resolvedBy = "Flight Systems Lead") {
    return this.request(`/data-quality/incidents/${incidentId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution_notes: notes, resolved_by: resolvedBy })
    });
  }

  /* Fleet Management Module API */
  async getFleetSummary() {
    return this.request("/fleet/summary");
  }

  async listFleetAssets(status = null, search = null) {
    let q = [];
    if (status) q.push(`status=${encodeURIComponent(status)}`);
    if (search) q.push(`search=${encodeURIComponent(search)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return this.request(`/fleet/assets${qs}`);
  }

  async getFleetAsset(assetId) {
    return this.request(`/fleet/assets/${assetId}`);
  }

  async updateFleetAsset(assetId, data) {
    return this.request(`/fleet/assets/${assetId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async getFleetComparison(assetIds = "UAV-01,UAV-03,UAV-07") {
    return this.request(`/fleet/comparison?asset_ids=${encodeURIComponent(assetIds)}`);
  }

  async listFleetAlerts() {
    return this.request("/fleet/alerts");
  }

  async acknowledgeFleetAlert(alertId) {
    return this.request(`/fleet/alerts/${alertId}/acknowledge`, { method: "POST" });
  }

  async listModels() {
    return this.request("/models");
  }

  /* Machine Learning System & Training API */
  async getMLStatus() {
    return this.request("/ml/status");
  }

  async getMLMetrics() {
    return this.request("/ml/metrics");
  }

  async triggerModelTraining(payload = { datasets_dir: "datasets" }) {
    return this.request("/ml/train", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async getTrainingJobStatus(jobId) {
    return this.request(`/ml/training-jobs/${encodeURIComponent(jobId)}`);
  }

  async getLatestMLPrediction() {
    return this.request("/ml/predictions/latest");
  }

  async getDeviceStatus(deviceId = "ENGINE-001") {
    return this.request(`/devices/status?device_id=${encodeURIComponent(deviceId)}`);
  }

  async generateDemoData(payload = { duration_minutes: 20.0, seed: 42 }) {
    return this.request("/demo/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async getDataSource() {
    return this.request("/system/data-source");
  }

  async setDataSource(source) {
    return this.request("/system/data-source", {
      method: "POST",
      body: JSON.stringify({ source })
    });
  }
}

// Global API Singleton instance
window.aeroAPI = new AeroTwinAPI();
